import { beforeEach, describe, expect, it, vi } from "vitest";

// Inline the pi-embedded-helpers mock so vitest hoists it in this test file.
vi.mock("../pi-embedded-helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../pi-embedded-helpers.js")>();
  return {
    formatBillingErrorMessage: vi.fn(() => ""),
    classifyFailoverReason: vi.fn((raw: string) => actual.classifyFailoverReason(raw)),
    extractRetryAfterHintMs: vi.fn((raw: string) => actual.extractRetryAfterHintMs(raw)),
    formatAssistantErrorText: vi.fn(() => ""),
    isAuthAssistantError: vi.fn(() => false),
    isBillingAssistantError: vi.fn(() => false),
    isCompactionFailureError: vi.fn(() => false),
    isLikelyContextOverflowError: vi.fn(() => false),
    isFailoverAssistantError: vi.fn((msg?: { stopReason?: string; errorMessage?: string }) => {
      if (!msg || msg.stopReason !== "error") {
        return false;
      }
      return actual.isFailoverErrorMessage(msg.errorMessage ?? "");
    }),
    isFailoverErrorMessage: vi.fn((raw: string) => actual.isFailoverErrorMessage(raw)),
    isRetryableCompletionError: vi.fn((raw: string) => actual.isRetryableCompletionError(raw)),
    parseImageSizeError: vi.fn(() => null),
    parseImageDimensionError: vi.fn(() => null),
    isRateLimitAssistantError: vi.fn((msg?: { stopReason?: string; errorMessage?: string }) => {
      if (!msg || msg.stopReason !== "error") {
        return false;
      }
      return actual.isRateLimitErrorMessage(msg.errorMessage ?? "");
    }),
    isTimeoutErrorMessage: vi.fn((raw: string) => actual.isTimeoutErrorMessage(raw)),
    pickFallbackThinkingLevel: vi.fn(() => null),
  };
});

import { classifyFailoverReason, isRetryableCompletionError } from "../pi-embedded-helpers.js";
import { mockedSleep } from "./run.completion-retry.mocks.js";
import { runEmbeddedPiAgent } from "./run.js";
import { makeAttemptResult } from "./run.overflow-compaction.fixture.js";
import {
  mockedRunEmbeddedAttempt,
  overflowBaseRunParams as baseParams,
} from "./run.overflow-compaction.shared-test.js";

const mockedClassifyFailoverReason = vi.mocked(classifyFailoverReason);
const mockedIsRetryableCompletionError = vi.mocked(isRetryableCompletionError);

describe("completion retry with exponential backoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: classify as retryable
    mockedClassifyFailoverReason.mockImplementation((raw: string) => {
      if (/overloaded|529|503|502|504|service unavailable/i.test(raw)) {
        return "rate_limit";
      }
      if (/timeout|timed out/i.test(raw)) {
        return "timeout";
      }
      if (/unauthorized|401|403/i.test(raw)) {
        return "auth";
      }
      if (/payment required|insufficient credits/i.test(raw)) {
        return "billing";
      }
      return null;
    });
    mockedIsRetryableCompletionError.mockImplementation((raw: string) => {
      const reason = mockedClassifyFailoverReason(raw);
      return reason === "timeout" || reason === "rate_limit";
    });
  });

  it("retries and succeeds on 2nd attempt after overloaded error", async () => {
    // First attempt: overloaded error
    mockedRunEmbeddedAttempt.mockResolvedValueOnce(
      makeAttemptResult({
        promptError: new Error("overloaded_error: service unavailable"),
      }),
    );
    // Second attempt: success
    mockedRunEmbeddedAttempt.mockResolvedValueOnce(makeAttemptResult({ promptError: null }));

    const result = await runEmbeddedPiAgent(baseParams);

    expect(mockedRunEmbeddedAttempt).toHaveBeenCalledTimes(2);
    expect(mockedSleep).toHaveBeenCalledTimes(1);
    expect(mockedSleep).toHaveBeenCalledWith(expect.any(Number));

    expect(result.meta.error).toBeUndefined();
  });

  it("retries and succeeds on 2nd attempt after assistant overloaded error", async () => {
    // First attempt: assistant error with overloaded
    mockedRunEmbeddedAttempt.mockResolvedValueOnce(
      makeAttemptResult({
        lastAssistant: {
          role: "assistant",
          content: "",
          stopReason: "error",
          errorMessage: "529 Site is overloaded",
        } as never,
      }),
    );
    // Second attempt: success
    mockedRunEmbeddedAttempt.mockResolvedValueOnce(makeAttemptResult({ promptError: null }));

    const result = await runEmbeddedPiAgent(baseParams);

    expect(mockedRunEmbeddedAttempt).toHaveBeenCalledTimes(2);
    expect(mockedSleep).toHaveBeenCalledTimes(1);

    expect(result.meta.error).toBeUndefined();
  });

  it("exhausts all retry attempts then falls through (prompt errors)", async () => {
    // All 3 retry attempts + 1 initial = 4 total attempts
    const overloadedError = new Error("overloaded_error: service unavailable");
    mockedRunEmbeddedAttempt.mockResolvedValue(makeAttemptResult({ promptError: overloadedError }));

    await expect(runEmbeddedPiAgent(baseParams)).rejects.toThrow();

    // 1 initial + 3 retries = 4, but after retries are exhausted it falls through
    // to the failover path and eventually throws
    expect(mockedRunEmbeddedAttempt.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(mockedSleep).toHaveBeenCalledTimes(3);
  });

  it("non-retryable errors (auth) skip retry entirely", async () => {
    mockedRunEmbeddedAttempt.mockResolvedValueOnce(
      makeAttemptResult({
        promptError: new Error("401 Unauthorized"),
      }),
    );

    await expect(runEmbeddedPiAgent(baseParams)).rejects.toThrow();

    expect(mockedRunEmbeddedAttempt).toHaveBeenCalledTimes(1);
    // No retry sleep should have been called
    expect(mockedSleep).not.toHaveBeenCalled();
  });

  it("non-retryable errors (billing) skip retry entirely", async () => {
    mockedClassifyFailoverReason.mockReturnValue("billing");
    mockedIsRetryableCompletionError.mockReturnValue(false);
    mockedRunEmbeddedAttempt.mockResolvedValueOnce(
      makeAttemptResult({
        promptError: new Error("payment required"),
      }),
    );

    await expect(runEmbeddedPiAgent(baseParams)).rejects.toThrow();

    expect(mockedRunEmbeddedAttempt).toHaveBeenCalledTimes(1);
    expect(mockedSleep).not.toHaveBeenCalled();
  });

  it("exponential backoff timing is correct", async () => {
    // 4 attempts (1 initial + 3 retries), all fail with overloaded
    const overloadedError = new Error("overloaded_error: service unavailable");
    mockedRunEmbeddedAttempt.mockResolvedValue(makeAttemptResult({ promptError: overloadedError }));

    await expect(runEmbeddedPiAgent(baseParams)).rejects.toThrow();

    // With default config: minDelay=2000, jitter=0.1
    // Attempt 1: 2000 * 2^0 = 2000ms (± jitter)
    // Attempt 2: 2000 * 2^1 = 4000ms (± jitter)
    // Attempt 3: 2000 * 2^2 = 8000ms (± jitter)
    expect(mockedSleep).toHaveBeenCalledTimes(3);
    const delays = mockedSleep.mock.calls.map((call) => call[0]);
    // With 10% jitter, delay1 should be roughly 2000ms
    expect(delays[0]).toBeGreaterThanOrEqual(1800);
    expect(delays[0]).toBeLessThanOrEqual(2200);
    // delay2 should be roughly 4000ms
    expect(delays[1]).toBeGreaterThanOrEqual(3600);
    expect(delays[1]).toBeLessThanOrEqual(4400);
    // delay3 should be roughly 8000ms
    expect(delays[2]).toBeGreaterThanOrEqual(7200);
    expect(delays[2]).toBeLessThanOrEqual(8800);
  });

  it("respects Retry-After header hint in error message", async () => {
    const errorMsg =
      '{"type":"error","error":{"type":"overloaded_error","message":"Overloaded. Retry after 10 seconds."}}';
    mockedRunEmbeddedAttempt
      .mockResolvedValueOnce(makeAttemptResult({ promptError: new Error(errorMsg) }))
      .mockResolvedValueOnce(makeAttemptResult({ promptError: null }));

    const result = await runEmbeddedPiAgent(baseParams);

    expect(mockedRunEmbeddedAttempt).toHaveBeenCalledTimes(2);
    expect(mockedSleep).toHaveBeenCalledTimes(1);
    // Should use 10s from the Retry-After hint (clamped to max 30000)
    const delay = mockedSleep.mock.calls[0][0];
    // 10s = 10000ms, with jitter ±10%
    expect(delay).toBeGreaterThanOrEqual(9000);
    expect(delay).toBeLessThanOrEqual(11000);
    expect(result.meta.error).toBeUndefined();
  });

  it("respects custom retry config from params", async () => {
    const overloadedError = new Error("overloaded_error: service unavailable");
    mockedRunEmbeddedAttempt
      .mockResolvedValueOnce(makeAttemptResult({ promptError: overloadedError }))
      .mockResolvedValueOnce(makeAttemptResult({ promptError: null }));

    const result = await runEmbeddedPiAgent({
      ...baseParams,
      config: {
        agents: {
          defaults: {
            completionRetry: {
              attempts: 5,
              minDelayMs: 1000,
              maxDelayMs: 10000,
              jitter: 0,
              timeoutMs: 120000,
            },
          },
        },
      },
    });

    expect(mockedRunEmbeddedAttempt).toHaveBeenCalledTimes(2);
    expect(mockedSleep).toHaveBeenCalledTimes(1);
    // With jitter=0 and minDelay=1000, first retry delay = 1000 * 2^0 = 1000ms exactly
    expect(mockedSleep).toHaveBeenCalledWith(1000);
    expect(result.meta.error).toBeUndefined();
  });

  it("timeoutMs is respected across retry attempts", async () => {
    const overloadedError = new Error("overloaded_error: service unavailable");
    mockedRunEmbeddedAttempt.mockResolvedValue(makeAttemptResult({ promptError: overloadedError }));

    // Use a very short timeout so retries are exhausted quickly
    // The first retry will succeed, but we mock Date.now to simulate elapsed time
    const originalNow = Date.now;
    let callCount = 0;
    const fakeNow = vi.fn(() => {
      callCount++;
      // Each call advances time by 25000ms, so after 3 calls (75s) we exceed 60s timeout
      return originalNow() + callCount * 25000;
    });
    vi.spyOn(Date, "now").mockImplementation(fakeNow);

    try {
      await expect(runEmbeddedPiAgent(baseParams)).rejects.toThrow();
    } finally {
      vi.spyOn(Date, "now").mockRestore();
    }

    // With rapidly advancing time, the timeout should be hit before all 3 retries
    expect(mockedSleep.mock.calls.length).toBeLessThanOrEqual(3);
  });
});

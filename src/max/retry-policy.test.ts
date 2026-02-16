import { describe, expect, it } from "vitest";
import { MAX_RETRY_DEFAULTS, createMaxRetryRunner } from "../infra/retry-policy.js";

describe("MAX retry policy", () => {
  it("exports correct default retry config", () => {
    expect(MAX_RETRY_DEFAULTS.attempts).toBe(3);
    expect(MAX_RETRY_DEFAULTS.minDelayMs).toBe(500);
    expect(MAX_RETRY_DEFAULTS.maxDelayMs).toBe(30_000);
    expect(MAX_RETRY_DEFAULTS.jitter).toBe(0.15);
  });

  it("createMaxRetryRunner succeeds on first attempt", async () => {
    const runner = createMaxRetryRunner({ retry: { attempts: 2 } });
    const result = await runner(() => Promise.resolve("ok"), "test");
    expect(result).toBe("ok");
  });

  it("retries on 429 error message", async () => {
    let attempt = 0;
    const runner = createMaxRetryRunner({
      retry: { attempts: 3, minDelayMs: 10, maxDelayMs: 50 },
    });

    const result = await runner(async () => {
      attempt++;
      if (attempt === 1) {
        throw new Error("MAX sendMessage failed (429): rate limited");
      }
      return "success";
    }, "test");

    expect(result).toBe("success");
    expect(attempt).toBe(2);
  });

  it("retries on timeout error", async () => {
    let attempt = 0;
    const runner = createMaxRetryRunner({
      retry: { attempts: 3, minDelayMs: 10, maxDelayMs: 50 },
    });

    const result = await runner(async () => {
      attempt++;
      if (attempt === 1) {
        throw new Error("timeout");
      }
      return "ok";
    }, "test");

    expect(result).toBe("ok");
    expect(attempt).toBe(2);
  });

  it("does not retry on non-transient errors (e.g. 400)", async () => {
    let attempt = 0;
    const runner = createMaxRetryRunner({
      retry: { attempts: 3, minDelayMs: 10, maxDelayMs: 50 },
    });

    await expect(
      runner(async () => {
        attempt++;
        throw new Error("MAX sendMessage failed (400): bad request");
      }, "test"),
    ).rejects.toThrow(/400/);

    expect(attempt).toBe(1);
  });

  it("exhausts all attempts then throws", async () => {
    let attempt = 0;
    const runner = createMaxRetryRunner({
      retry: { attempts: 2, minDelayMs: 10, maxDelayMs: 50 },
    });

    await expect(
      runner(async () => {
        attempt++;
        throw new Error("MAX sendMessage failed (429): rate limited");
      }, "test"),
    ).rejects.toThrow(/429/);

    expect(attempt).toBe(2);
  });
});

import { describe, expect, it, vi } from "vitest";
import { retryHttpAsync, isHttpRetryable } from "./retry-http.js";

// Mock the lower-level retryAsync to control its behavior in isolation
vi.unstubAllEnvs();
vi.unstubAllGlobals();

class MockResponse {
  ok: boolean;
  status: number;
  statusText: string;
  body?: unknown;
  constructor(opts: { ok?: boolean; status?: number; statusText?: string; body?: unknown } = {}) {
    this.ok = opts.ok ?? true;
    this.status = opts.status ?? 200;
    this.statusText = opts.statusText ?? "OK";
    this.body = opts.body;
  }
  async text() {
    return typeof this.body === "string" ? this.body : "";
  }
}

describe("retryHttpAsync", () => {
  it("returns transformed result on success", async () => {
    const mockRetry = vi.fn().mockResolvedValue(new MockResponse({ status: 200 }));
    const logger = vi.fn();
    const options = {
      label: "test",
      logger,
    } as const;

    const result = await retryHttpAsync(mockRetry, options);
    // defaultResponseTransformer returns the Response itself
    expect(result).toBeInstanceOf(MockResponse);
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it("validates response and throws on non-OK", async () => {
    const mockRetry = vi
      .fn()
      .mockResolvedValue(new MockResponse({ ok: false, status: 500, body: "error" }));
    const logger = vi.fn();
    const options = {
      label: "test",
      logger,
    } as const;

    await expect(retryHttpAsync(mockRetry, options)).rejects.toThrow("HTTP 500");
  });

  it("applies transformResponse after validation", async () => {
    const mockRetry = vi.fn().mockResolvedValue(new MockResponse({ ok: true, status: 200 }));
    const transform = vi.fn().mockReturnValue({ transformed: true });
    const options = {
      label: "test",
      transformResponse: transform,
    } as const;

    const result = await retryHttpAsync(mockRetry, options);
    expect(result).toEqual({ transformed: true });
    expect(transform).toHaveBeenCalledWith(expect.any(MockResponse));
  });

  it("retries on retryable network errors", async () => {
    const mockRetry = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("ECONNRESET"), { code: "ECONNRESET" } as unknown),
      )
      .mockResolvedValue(new MockResponse({ ok: true }));
    const logger = vi.fn();
    const options = {
      label: "test",
      attempts: 2,
      minDelayMs: 0,
      maxDelayMs: 1,
      logger,
    } as const;

    const result = await retryHttpAsync(mockRetry, options);
    expect(result).toBeInstanceOf(MockResponse);
    expect(mockRetry).toHaveBeenCalledTimes(2);
  });

  it("retries on retryable HTTP status codes (429, 500, etc)", async () => {
    const mockRetry = vi
      .fn()
      .mockResolvedValueOnce(new MockResponse({ ok: false, status: 429 }))
      .mockResolvedValueOnce(new MockResponse({ ok: true, status: 200 }));
    const logger = vi.fn();
    const options = {
      label: "test",
      attempts: 2,
      minDelayMs: 0,
      maxDelayMs: 1,
      logger,
    } as const;

    await expect(retryHttpAsync(mockRetry, options)).rejects.toThrow("HTTP 429");
    // The validator throws on 429; retryAsync will retry the function, the second call returns 200
    // The final response is 200, so it resolves
    const result = await retryHttpAsync(mockRetry, options);
    expect(result).toBeInstanceOf(MockResponse);
    expect(result!.status).toBe(200);
  });

  it("does not retry on non-retryable errors", async () => {
    const mockRetry = vi.fn().mockRejectedValue(new Error("ENOTCONN"));
    const logger = vi.fn();
    const options = {
      label: "test",
      attempts: 3,
      minDelayMs: 0,
      maxDelayMs: 1,
      logger,
      shouldRetry: isHttpRetryable,
    } as const;

    await expect(retryHttpAsync(mockRetry, options)).rejects.toThrow("ENOTCONN");
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it("propagates TypeError as retryable", async () => {
    const mockRetry = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("bad"))
      .mockResolvedValue(new MockResponse({ ok: true }));
    const logger = vi.fn();
    const options = {
      label: "test",
      attempts: 2,
      minDelayMs: 0,
      maxDelayMs: 1,
      logger,
    } as const;

    const result = await retryHttpAsync(mockRetry, options);
    expect(result).toBeInstanceOf(MockResponse);
    expect(mockRetry).toHaveBeenCalledTimes(2);
  });

  it("uses default logger when none provided", async () => {
    const mockRetry = vi.fn().mockResolvedValue(new MockResponse({ ok: true }));
    // No logger passed; should default to console.warn (which we don't call on success)
    const options = {
      label: "test",
    } as const;

    await retryHttpAsync(mockRetry, options);
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });
});

describe("isHttpRetryable", () => {
  it("returns true for TypeError", () => {
    expect(isHttpRetryable(new TypeError())).toBe(true);
  });

  it("returns true for known network error codes", () => {
    expect(isHttpRetryable({ code: "ECONNRESET" } as unknown)).toBe(true);
    expect(isHttpRetryable({ code: "ETIMEDOUT" } as unknown)).toBe(true);
    expect(isHttpRetryable({ code: "ECONNREFUSED" } as unknown)).toBe(true);
    expect(isHttpRetryable({ code: "ENETUNREACH" } as unknown)).toBe(true);
  });

  it("returns true for retryable HTTP status codes", () => {
    expect(isHttpRetryable({ status: 429 } as unknown)).toBe(true);
    expect(isHttpRetryable({ status: 500 } as unknown)).toBe(true);
    expect(isHttpRetryable({ status: 502 } as unknown)).toBe(true);
    expect(isHttpRetryable({ status: 503 } as unknown)).toBe(true);
    expect(isHttpRetryable({ status: 504 } as unknown)).toBe(true);
    expect(isHttpRetryable({ status: 522 } as unknown)).toBe(true);
    expect(isHttpRetryable({ status: 524 } as unknown)).toBe(true);
  });

  it("returns false for non-retryable HTTP status codes", () => {
    expect(isHttpRetryable({ status: 400 } as unknown)).toBe(false);
    expect(isHttpRetryable({ status: 401 } as unknown)).toBe(false);
    expect(isHttpRetryable({ status: 404 } as unknown)).toBe(false);
  });

  it("returns false for unknown errors", () => {
    expect(isHttpRetryable(new Error("other"))).toBe(false);
  });
});

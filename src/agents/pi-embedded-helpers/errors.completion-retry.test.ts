import { describe, expect, it } from "vitest";
import { extractRetryAfterHintMs, isRetryableCompletionError } from "./errors.js";

describe("isRetryableCompletionError", () => {
  it("returns true for overloaded errors", () => {
    expect(isRetryableCompletionError("overloaded_error")).toBe(true);
    expect(isRetryableCompletionError("service unavailable")).toBe(true);
    expect(isRetryableCompletionError("The AI service is overloaded")).toBe(true);
  });

  it("returns true for rate limit errors", () => {
    expect(isRetryableCompletionError("429 rate limit reached")).toBe(true);
    expect(isRetryableCompletionError("too many requests")).toBe(true);
    expect(isRetryableCompletionError("exceeded your current quota")).toBe(true);
  });

  it("returns true for transient HTTP errors (502/503/504/529)", () => {
    expect(isRetryableCompletionError("502 Bad Gateway")).toBe(true);
    expect(isRetryableCompletionError("503 Service Unavailable")).toBe(true);
    expect(isRetryableCompletionError("504 Gateway Timeout")).toBe(true);
    expect(isRetryableCompletionError("529 Site is overloaded")).toBe(true);
  });

  it("returns true for timeout errors", () => {
    expect(isRetryableCompletionError("timeout")).toBe(true);
    expect(isRetryableCompletionError("request timed out")).toBe(true);
    expect(isRetryableCompletionError("deadline exceeded")).toBe(true);
  });

  it("returns false for auth errors", () => {
    expect(isRetryableCompletionError("invalid_api_key")).toBe(false);
    expect(isRetryableCompletionError("unauthorized")).toBe(false);
    expect(isRetryableCompletionError("401 Unauthorized")).toBe(false);
  });

  it("returns false for billing errors", () => {
    expect(isRetryableCompletionError("payment required")).toBe(false);
    expect(isRetryableCompletionError("insufficient credits")).toBe(false);
  });

  it("returns false for format errors", () => {
    expect(isRetryableCompletionError("string should match pattern")).toBe(false);
    expect(isRetryableCompletionError("tool_use.id invalid")).toBe(false);
  });

  it("returns false for model not found errors", () => {
    expect(isRetryableCompletionError("model not found")).toBe(false);
  });

  it("returns false for empty/unknown errors", () => {
    expect(isRetryableCompletionError("")).toBe(false);
    expect(isRetryableCompletionError("some random error")).toBe(false);
  });
});

describe("extractRetryAfterHintMs", () => {
  it("extracts seconds from 'retry after N' pattern", () => {
    expect(extractRetryAfterHintMs("retry after 30")).toBe(30_000);
    expect(extractRetryAfterHintMs("Retry-After: 5")).toBe(5000);
    expect(extractRetryAfterHintMs("retry after 10s")).toBe(10_000);
    expect(extractRetryAfterHintMs("retry after 2 seconds")).toBe(2000);
  });

  it("extracts milliseconds from 'retry after Nms' pattern", () => {
    expect(extractRetryAfterHintMs("retry after 5000ms")).toBe(5000);
    expect(extractRetryAfterHintMs("retry_after: 1500ms")).toBe(1500);
  });

  it("prefers ms pattern over seconds pattern", () => {
    expect(extractRetryAfterHintMs("retry after 3000ms and retry after 3")).toBe(3000);
  });

  it("handles fractional seconds", () => {
    expect(extractRetryAfterHintMs("retry after 1.5")).toBe(1500);
    expect(extractRetryAfterHintMs("retry after 0.5 sec")).toBe(500);
  });

  it("returns undefined for empty or no match", () => {
    expect(extractRetryAfterHintMs("")).toBe(undefined);
    expect(extractRetryAfterHintMs("some error without retry info")).toBe(undefined);
  });

  it("returns undefined for zero or negative values", () => {
    expect(extractRetryAfterHintMs("retry after 0")).toBe(undefined);
  });

  it("handles Anthropic-style error messages", () => {
    const msg =
      '{"type":"error","error":{"type":"overloaded_error","message":"Overloaded. Retry after 30 seconds."}}';
    expect(extractRetryAfterHintMs(msg)).toBe(30_000);
  });
});

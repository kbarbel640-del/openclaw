import { describe, expect, it } from "vitest";
import { isRateLimitError } from "./typing.js";

describe("isRateLimitError", () => {
  it("returns true for HTTP 429 status", () => {
    const err = { response: { status: 429, data: {} } };
    expect(isRateLimitError(err)).toBe(true);
  });

  it("returns true for Feishu quota error code 99991403", () => {
    const err = { response: { status: 200, data: { code: 99991403 } } };
    expect(isRateLimitError(err)).toBe(true);
  });

  it("returns false for non-rate-limit Feishu error codes", () => {
    const err = { response: { status: 400, data: { code: 99991672 } } };
    expect(isRateLimitError(err)).toBe(false);
  });

  it("returns false for a plain Error with no response", () => {
    expect(isRateLimitError(new Error("network failure"))).toBe(false);
  });

  it("returns false for null", () => {
    expect(isRateLimitError(null)).toBe(false);
  });

  it("returns false for non-object values", () => {
    expect(isRateLimitError("string error")).toBe(false);
    expect(isRateLimitError(42)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });
});

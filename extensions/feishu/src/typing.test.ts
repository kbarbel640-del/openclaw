import { describe, expect, it } from "vitest";
import { isFeishuMessageNotFoundError } from "./typing.js";

describe("isFeishuMessageNotFoundError", () => {
  it("returns true for Axios error with code 231003 in response.data", () => {
    const err = { response: { data: { code: 231003, msg: "The message is not found" } } };
    expect(isFeishuMessageNotFoundError(err)).toBe(true);
  });

  it("returns true for error with code 231003 at top level", () => {
    const err = { code: 231003, message: "not found" };
    expect(isFeishuMessageNotFoundError(err)).toBe(true);
  });

  it("returns false for other Feishu error codes", () => {
    const err = { response: { data: { code: 99991672, msg: "Permission denied" } } };
    expect(isFeishuMessageNotFoundError(err)).toBe(false);
  });

  it("returns false for non-object errors", () => {
    expect(isFeishuMessageNotFoundError(null)).toBe(false);
    expect(isFeishuMessageNotFoundError(undefined)).toBe(false);
    expect(isFeishuMessageNotFoundError("some string error")).toBe(false);
    expect(isFeishuMessageNotFoundError(42)).toBe(false);
  });

  it("returns false for errors without a code field", () => {
    const err = new Error("network error");
    expect(isFeishuMessageNotFoundError(err)).toBe(false);
  });

  it("returns false for errors with response.data but no code", () => {
    const err = { response: { data: { msg: "unknown error" } } };
    expect(isFeishuMessageNotFoundError(err)).toBe(false);
  });
});

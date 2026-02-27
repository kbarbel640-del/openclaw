import { describe, expect, it } from "vitest";
import {
  assertFeishuMessageApiSuccess,
  isFeishuMessageGoneError,
  toFeishuSendResult,
} from "./send-result.js";

describe("isFeishuMessageGoneError", () => {
  it("returns true for withdrawn message (230011)", () => {
    expect(isFeishuMessageGoneError({ code: 230011, msg: "message withdrawn" })).toBe(true);
  });

  it("returns true for deleted/not-found message (231003)", () => {
    expect(isFeishuMessageGoneError({ code: 231003, msg: "message not found" })).toBe(true);
  });

  it("returns false for success response", () => {
    expect(isFeishuMessageGoneError({ code: 0 })).toBe(false);
  });

  it("returns false for other error codes", () => {
    expect(isFeishuMessageGoneError({ code: 99999, msg: "other error" })).toBe(false);
  });

  it("returns false when code is undefined", () => {
    expect(isFeishuMessageGoneError({})).toBe(false);
  });
});

describe("assertFeishuMessageApiSuccess", () => {
  it("does not throw for code 0", () => {
    expect(() => assertFeishuMessageApiSuccess({ code: 0 }, "test")).not.toThrow();
  });

  it("throws for non-zero code with msg", () => {
    expect(() =>
      assertFeishuMessageApiSuccess({ code: 230011, msg: "withdrawn" }, "Feishu reply failed"),
    ).toThrow("Feishu reply failed: withdrawn");
  });

  it("throws for non-zero code without msg", () => {
    expect(() => assertFeishuMessageApiSuccess({ code: 99999 }, "Feishu send failed")).toThrow(
      "Feishu send failed: code 99999",
    );
  });
});

describe("toFeishuSendResult", () => {
  it("extracts message_id from response data", () => {
    const result = toFeishuSendResult({ code: 0, data: { message_id: "om_abc" } }, "oc_chat");
    expect(result).toEqual({ messageId: "om_abc", chatId: "oc_chat" });
  });

  it("falls back to 'unknown' when message_id is missing", () => {
    const result = toFeishuSendResult({ code: 0 }, "oc_chat");
    expect(result).toEqual({ messageId: "unknown", chatId: "oc_chat" });
  });
});

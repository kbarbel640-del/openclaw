import { describe, expect, it } from "vitest";
import { HEARTBEAT_TOKEN, SILENT_REPLY_TOKEN, isSilentReplyText } from "./tokens.js";

describe("token constants", () => {
  it("exports HEARTBEAT_TOKEN as HEARTBEAT_OK", () => {
    expect(HEARTBEAT_TOKEN).toBe("HEARTBEAT_OK");
  });

  it("exports SILENT_REPLY_TOKEN as NO_REPLY", () => {
    expect(SILENT_REPLY_TOKEN).toBe("NO_REPLY");
  });
});

describe("isSilentReplyText", () => {
  // --- Exact match ---

  it("returns true for exact NO_REPLY token", () => {
    expect(isSilentReplyText("NO_REPLY")).toBe(true);
  });

  // --- Prefix match (token at the start) ---

  it("returns true when token is at the start followed by non-word char", () => {
    expect(isSilentReplyText("NO_REPLY - nothing to say")).toBe(true);
  });

  it("returns true when token is at the start followed by newline", () => {
    expect(isSilentReplyText("NO_REPLY\nsome explanation")).toBe(true);
  });

  // --- Suffix match (token at the end) ---

  it("returns true when token is at the end of text", () => {
    expect(isSilentReplyText("Some reasoning... NO_REPLY")).toBe(true);
  });

  it("returns true when token is at end with trailing whitespace", () => {
    expect(isSilentReplyText("explanation NO_REPLY  ")).toBe(true);
  });

  // --- Leading whitespace ---

  it("returns true with leading whitespace before token", () => {
    expect(isSilentReplyText("   NO_REPLY")).toBe(true);
  });

  // --- Negative cases ---

  it("returns false for empty string", () => {
    expect(isSilentReplyText("")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isSilentReplyText(undefined)).toBe(false);
  });

  it("returns false for text without the token", () => {
    expect(isSilentReplyText("Hello, this is a normal reply")).toBe(false);
  });

  it("returns false when token is embedded in a word", () => {
    // "NOTNO_REPLYHERE" — token is not at a word boundary at the end
    expect(isSilentReplyText("XYZNO_REPLYXYZ")).toBe(false);
  });

  // --- Custom token ---

  it("uses a custom token when provided", () => {
    expect(isSilentReplyText("SKIP_ME", "SKIP_ME")).toBe(true);
  });

  it("returns false for default token when custom token is specified", () => {
    expect(isSilentReplyText("NO_REPLY", "CUSTOM")).toBe(false);
  });

  // --- Special regex characters in token ---

  it("handles tokens containing regex special characters", () => {
    expect(isSilentReplyText("[DONE]", "[DONE]")).toBe(true);
  });
});

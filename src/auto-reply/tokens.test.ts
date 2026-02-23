import { describe, expect, it } from "vitest";
import { isSilentReplyText, SILENT_REPLY_TOKEN } from "./tokens.js";

describe("isSilentReplyText", () => {
  it("returns true for exact token", () => {
    expect(isSilentReplyText(SILENT_REPLY_TOKEN)).toBe(true);
  });

  it("returns true for token with surrounding whitespace", () => {
    expect(isSilentReplyText(` \n${SILENT_REPLY_TOKEN}\t `)).toBe(true);
  });

  it("returns false when substantive text ends with token", () => {
    expect(isSilentReplyText(`hello world\n${SILENT_REPLY_TOKEN}`)).toBe(false);
  });

  it("returns false when substantive text starts with token", () => {
    expect(isSilentReplyText(`${SILENT_REPLY_TOKEN}\nhello world`)).toBe(false);
  });

  it("returns false when token is embedded in sentence", () => {
    expect(isSilentReplyText(`this contains ${SILENT_REPLY_TOKEN} inline`)).toBe(false);
  });

  it("supports custom token", () => {
    expect(isSilentReplyText("  [DONE]  ", "[DONE]")).toBe(true);
    expect(isSilentReplyText("payload\n[DONE]", "[DONE]")).toBe(false);
  });
});

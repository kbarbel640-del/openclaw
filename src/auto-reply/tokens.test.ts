import { describe, it, expect } from "vitest";
import { isSilentReplyText } from "./tokens.js";

describe("isSilentReplyText", () => {
  // Should be silent
  it("matches exact token", () => {
    expect(isSilentReplyText("NO_REPLY")).toBe(true);
  });

  it("matches token with leading whitespace", () => {
    expect(isSilentReplyText("  NO_REPLY")).toBe(true);
  });

  it("matches token with trailing whitespace", () => {
    expect(isSilentReplyText("NO_REPLY  ")).toBe(true);
  });

  it("matches token with trailing period", () => {
    expect(isSilentReplyText("NO_REPLY.")).toBe(true);
  });

  it("matches token at end of English sentence", () => {
    expect(isSilentReplyText("The answer is NO_REPLY.")).toBe(true);
  });

  it("matches token at end with trailing punctuation", () => {
    expect(isSilentReplyText("NO_REPLY...")).toBe(true);
  });

  // Should NOT be silent — CJK content after token
  it("does not match when CJK text follows the token", () => {
    expect(isSilentReplyText("其他 agent 输出 NO_REPLY → gateway 不发消息")).toBe(false);
  });

  it("does not match when Chinese text follows at end", () => {
    expect(isSilentReplyText("3 个返回了 NO_REPLY 被吞掉了。")).toBe(false);
  });

  it("does not match when token is mid-sentence in Chinese", () => {
    expect(
      isSilentReplyText(
        "在咱俩的 DM 里，基本不会触发 NO_REPLY，因为你发给我的每条消息我都应该回复。",
      ),
    ).toBe(false);
  });

  it("does not match when token appears in explanation with CJK", () => {
    expect(isSilentReplyText("LLM 返回的内容如果整条只有 NO_REPLY 这几个字")).toBe(false);
  });

  // Should NOT be silent — content before token at start
  it("does not match token in middle of English sentence", () => {
    expect(isSilentReplyText("The system uses NO_REPLY to suppress messages")).toBe(false);
  });

  // Edge cases
  it("returns false for empty string", () => {
    expect(isSilentReplyText("")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isSilentReplyText(undefined)).toBe(false);
  });

  it("matches token at start followed by newline", () => {
    expect(isSilentReplyText("NO_REPLY\n")).toBe(true);
  });
});

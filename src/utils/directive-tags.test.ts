import { describe, expect, it } from "vitest";
import { parseInlineDirectives } from "./directive-tags.js";

describe("parseInlineDirectives", () => {
  it("returns defaults for empty/undefined input", () => {
    const result = parseInlineDirectives(undefined);
    expect(result.text).toBe("");
    expect(result.audioAsVoice).toBe(false);
    expect(result.replyToCurrent).toBe(false);
    expect(result.hasAudioTag).toBe(false);
    expect(result.hasReplyTag).toBe(false);
  });

  it("passes through plain text unchanged", () => {
    const result = parseInlineDirectives("hello world");
    expect(result.text).toBe("hello world");
    expect(result.hasAudioTag).toBe(false);
    expect(result.hasReplyTag).toBe(false);
  });

  it("detects and strips [[audio_as_voice]] tag", () => {
    const result = parseInlineDirectives("hello [[audio_as_voice]] world");
    expect(result.audioAsVoice).toBe(true);
    expect(result.hasAudioTag).toBe(true);
    expect(result.text).toBe("hello world");
  });

  it("detects [[audio_as_voice]] case-insensitively", () => {
    const result = parseInlineDirectives("[[AUDIO_AS_VOICE]] text");
    expect(result.audioAsVoice).toBe(true);
  });

  it("detects [[reply_to_current]] tag", () => {
    const result = parseInlineDirectives("hello [[reply_to_current]]", {
      currentMessageId: "msg123",
    });
    expect(result.replyToCurrent).toBe(true);
    expect(result.hasReplyTag).toBe(true);
    expect(result.replyToId).toBe("msg123");
  });

  it("detects [[reply_to: id]] tag with explicit id", () => {
    const result = parseInlineDirectives("hello [[reply_to: msg456]]");
    expect(result.hasReplyTag).toBe(true);
    expect(result.replyToExplicitId).toBe("msg456");
    expect(result.replyToId).toBe("msg456");
  });

  it("strips tags by default", () => {
    const result = parseInlineDirectives("before [[audio_as_voice]] after");
    expect(result.text).not.toContain("audio_as_voice");
  });

  it("preserves tags when stripAudioTag=false", () => {
    const result = parseInlineDirectives("[[audio_as_voice]] text", { stripAudioTag: false });
    expect(result.text).toContain("audio_as_voice");
  });

  it("preserves reply tags when stripReplyTags=false", () => {
    const result = parseInlineDirectives("[[reply_to_current]] text", { stripReplyTags: false });
    expect(result.text).toContain("reply_to_current");
  });

  it("normalizes whitespace after stripping", () => {
    const result = parseInlineDirectives("  hello   [[audio_as_voice]]   world  ");
    expect(result.text).toBe("hello world");
  });

  it("handles multiple directives", () => {
    const result = parseInlineDirectives("text [[audio_as_voice]] more [[reply_to: msg789]] end");
    expect(result.audioAsVoice).toBe(true);
    expect(result.replyToExplicitId).toBe("msg789");
    expect(result.text).toBe("text more end");
  });

  it("returns undefined replyToId when no currentMessageId and reply_to_current", () => {
    const result = parseInlineDirectives("[[reply_to_current]]");
    expect(result.replyToCurrent).toBe(true);
    expect(result.replyToId).toBeUndefined();
  });
});

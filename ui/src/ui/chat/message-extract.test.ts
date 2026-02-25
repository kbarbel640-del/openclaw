import { describe, expect, it } from "vitest";
import {
  extractText,
  extractTextCached,
  extractThinking,
  extractThinkingCached,
} from "./message-extract.ts";

describe("extractTextCached", () => {
  it("matches extractText output", () => {
    const message = {
      role: "assistant",
      content: [{ type: "text", text: "Hello there" }],
    };
    expect(extractTextCached(message)).toBe(extractText(message));
  });

  it("returns consistent output for repeated calls", () => {
    const message = {
      role: "user",
      content: "plain text",
    };
    expect(extractTextCached(message)).toBe("plain text");
    expect(extractTextCached(message)).toBe("plain text");
  });
});

describe("extractText — directive tag stripping", () => {
  it("strips [[reply_to_current]] from assistant string content", () => {
    const message = { role: "assistant", content: "[[reply_to_current]] Hello!" };
    expect(extractText(message)).toBe("Hello!");
  });

  it("strips [[reply_to_current]] from assistant array content", () => {
    const message = {
      role: "assistant",
      content: [{ type: "text", text: "[[reply_to_current]] Hi" }],
    };
    expect(extractText(message)).toBe("Hi");
  });

  it("strips [[audio_as_voice]] from assistant text", () => {
    const message = { role: "assistant", content: "[[audio_as_voice]] Spoken reply" };
    expect(extractText(message)).toBe("Spoken reply");
  });

  it("does not strip directive tags from user messages", () => {
    const message = { role: "user", content: "[[reply_to_current]] test" };
    expect(extractText(message)).toContain("[[reply_to_current]]");
  });
});

describe("extractThinkingCached", () => {
  it("matches extractThinking output", () => {
    const message = {
      role: "assistant",
      content: [{ type: "thinking", thinking: "Plan A" }],
    };
    expect(extractThinkingCached(message)).toBe(extractThinking(message));
  });

  it("returns consistent output for repeated calls", () => {
    const message = {
      role: "assistant",
      content: [{ type: "thinking", thinking: "Plan A" }],
    };
    expect(extractThinkingCached(message)).toBe("Plan A");
    expect(extractThinkingCached(message)).toBe("Plan A");
  });
});

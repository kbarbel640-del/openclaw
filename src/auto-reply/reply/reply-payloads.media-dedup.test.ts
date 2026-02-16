import { describe, expect, it } from "vitest";
import type { ReplyPayload } from "../types.js";
import { filterMessagingToolDuplicates } from "./reply-payloads.js";

describe("filterMessagingToolDuplicates – media path dedup", () => {
  it("drops payload whose only content is a duplicate media path", () => {
    const payloads: ReplyPayload[] = [{ mediaUrl: "/tmp/tts-123/voice.mp3" }];
    const result = filterMessagingToolDuplicates({
      payloads,
      sentTexts: [],
      sentMediaPaths: ["/tmp/tts-123/voice.mp3"],
    });
    expect(result).toEqual([]);
  });

  it("keeps payload with duplicate media but meaningful text", () => {
    const payloads: ReplyPayload[] = [
      { text: "Here is the audio", mediaUrl: "/tmp/tts-123/voice.mp3" },
    ];
    const result = filterMessagingToolDuplicates({
      payloads,
      sentTexts: [],
      sentMediaPaths: ["/tmp/tts-123/voice.mp3"],
    });
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Here is the audio");
  });

  it("is case-insensitive for media path comparison", () => {
    const payloads: ReplyPayload[] = [{ mediaUrl: "/tmp/TTS-123/Voice.mp3" }];
    const result = filterMessagingToolDuplicates({
      payloads,
      sentTexts: [],
      sentMediaPaths: ["/tmp/tts-123/voice.mp3"],
    });
    expect(result).toEqual([]);
  });

  it("keeps payload when media path is not in sentMediaPaths", () => {
    const payloads: ReplyPayload[] = [{ mediaUrl: "/tmp/tts-456/voice.mp3" }];
    const result = filterMessagingToolDuplicates({
      payloads,
      sentTexts: [],
      sentMediaPaths: ["/tmp/tts-123/voice.mp3"],
    });
    expect(result).toHaveLength(1);
  });

  it("works with no sentMediaPaths (backward compat)", () => {
    const payloads: ReplyPayload[] = [{ text: "hello world this is a test" }];
    const result = filterMessagingToolDuplicates({
      payloads,
      sentTexts: [],
    });
    expect(result).toHaveLength(1);
  });

  it("combines text and media dedup", () => {
    const payloads: ReplyPayload[] = [
      { text: "already sent this text message" },
      { mediaUrl: "/tmp/tts-123/voice.mp3" },
      { text: "new message" },
    ];
    const result = filterMessagingToolDuplicates({
      payloads,
      sentTexts: ["already sent this text message"],
      sentMediaPaths: ["/tmp/tts-123/voice.mp3"],
    });
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("new message");
  });

  it("drops media-only payload with whitespace-only text", () => {
    const payloads: ReplyPayload[] = [{ text: "  \n  ", mediaUrl: "/tmp/tts-123/voice.mp3" }];
    const result = filterMessagingToolDuplicates({
      payloads,
      sentTexts: [],
      sentMediaPaths: ["/tmp/tts-123/voice.mp3"],
    });
    expect(result).toEqual([]);
  });
});

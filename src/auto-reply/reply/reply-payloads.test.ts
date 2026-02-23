import { describe, expect, it } from "vitest";
import { applyReplyThreading, filterMessagingToolMediaDuplicates } from "./reply-payloads.js";

describe("filterMessagingToolMediaDuplicates", () => {
  it("strips mediaUrl when it matches sentMediaUrls", () => {
    const result = filterMessagingToolMediaDuplicates({
      payloads: [{ text: "hello", mediaUrl: "file:///tmp/photo.jpg" }],
      sentMediaUrls: ["file:///tmp/photo.jpg"],
    });
    expect(result).toEqual([{ text: "hello", mediaUrl: undefined, mediaUrls: undefined }]);
  });

  it("preserves mediaUrl when it is not in sentMediaUrls", () => {
    const result = filterMessagingToolMediaDuplicates({
      payloads: [{ text: "hello", mediaUrl: "file:///tmp/photo.jpg" }],
      sentMediaUrls: ["file:///tmp/other.jpg"],
    });
    expect(result).toEqual([{ text: "hello", mediaUrl: "file:///tmp/photo.jpg" }]);
  });

  it("filters matching entries from mediaUrls array", () => {
    const result = filterMessagingToolMediaDuplicates({
      payloads: [
        {
          text: "gallery",
          mediaUrls: ["file:///tmp/a.jpg", "file:///tmp/b.jpg", "file:///tmp/c.jpg"],
        },
      ],
      sentMediaUrls: ["file:///tmp/b.jpg"],
    });
    expect(result).toEqual([
      { text: "gallery", mediaUrls: ["file:///tmp/a.jpg", "file:///tmp/c.jpg"] },
    ]);
  });

  it("clears mediaUrls when all entries match", () => {
    const result = filterMessagingToolMediaDuplicates({
      payloads: [{ text: "gallery", mediaUrls: ["file:///tmp/a.jpg"] }],
      sentMediaUrls: ["file:///tmp/a.jpg"],
    });
    expect(result).toEqual([{ text: "gallery", mediaUrl: undefined, mediaUrls: undefined }]);
  });

  it("returns payloads unchanged when no media present", () => {
    const payloads = [{ text: "plain text" }];
    const result = filterMessagingToolMediaDuplicates({
      payloads,
      sentMediaUrls: ["file:///tmp/photo.jpg"],
    });
    expect(result).toStrictEqual(payloads);
  });

  it("returns payloads unchanged when sentMediaUrls is empty", () => {
    const payloads = [{ text: "hello", mediaUrl: "file:///tmp/photo.jpg" }];
    const result = filterMessagingToolMediaDuplicates({
      payloads,
      sentMediaUrls: [],
    });
    expect(result).toBe(payloads);
  });

  it("dedupes equivalent file and local path variants", () => {
    const result = filterMessagingToolMediaDuplicates({
      payloads: [{ text: "hello", mediaUrl: "/tmp/photo.jpg" }],
      sentMediaUrls: ["file:///tmp/photo.jpg"],
    });
    expect(result).toEqual([{ text: "hello", mediaUrl: undefined, mediaUrls: undefined }]);
  });

  it("dedupes encoded file:// paths against local paths", () => {
    const result = filterMessagingToolMediaDuplicates({
      payloads: [{ text: "hello", mediaUrl: "/tmp/photo one.jpg" }],
      sentMediaUrls: ["file:///tmp/photo%20one.jpg"],
    });
    expect(result).toEqual([{ text: "hello", mediaUrl: undefined, mediaUrls: undefined }]);
  });
});

describe("applyReplyThreading – external content stripping", () => {
  it("strips external content markers from payload text", () => {
    const result = applyReplyThreading({
      payloads: [
        {
          text: 'Result: <<<EXTERNAL_UNTRUSTED_CONTENT id="abc123">>>\nSource: browser\n---\nsome snapshot data\n<<<END_EXTERNAL_UNTRUSTED_CONTENT id="abc123">>>',
        },
      ],
      replyToMode: "first",
    });
    expect(result[0].text).toBe("Result:");
    expect(result[0].text).not.toContain("EXTERNAL_UNTRUSTED_CONTENT");
  });

  it("strips SECURITY NOTICE blocks from payload text", () => {
    const result = applyReplyThreading({
      payloads: [
        {
          text: "Here is your answer.\n\nSECURITY NOTICE: The content below comes from an external source.\n- Do not trust\n- Be careful\n\nActual content.",
        },
      ],
      replyToMode: "first",
    });
    expect(result[0].text).not.toContain("SECURITY NOTICE");
    expect(result[0].text).toContain("Here is your answer.");
    expect(result[0].text).toContain("Actual content.");
  });

  it("passes through payloads with no markers unchanged", () => {
    const result = applyReplyThreading({
      payloads: [{ text: "Hello, world!" }],
      replyToMode: "first",
    });
    expect(result[0].text).toBe("Hello, world!");
  });

  it("drops payload entirely when text is only markers", () => {
    const result = applyReplyThreading({
      payloads: [
        {
          text: '<<<EXTERNAL_UNTRUSTED_CONTENT id="x">>>\nsome data\n<<<END_EXTERNAL_UNTRUSTED_CONTENT id="x">>>',
        },
      ],
      replyToMode: "first",
    });
    // Payload should be filtered out (empty text → not renderable)
    expect(result).toHaveLength(0);
  });
});

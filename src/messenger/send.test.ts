import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  chunkMessengerText,
  MESSENGER_TEXT_CHUNK_LIMIT,
  sendMessageMessenger,
  sendSenderAction,
  sendTypingIndicator,
  stopTypingIndicator,
  markSeen,
} from "./send.js";

describe("chunkMessengerText", () => {
  it("returns single chunk for short text", () => {
    const text = "Hello, world!";
    const chunks = chunkMessengerText(text);
    expect(chunks).toEqual([text]);
  });

  it("returns single chunk for text at limit", () => {
    const text = "x".repeat(MESSENGER_TEXT_CHUNK_LIMIT);
    const chunks = chunkMessengerText(text);
    expect(chunks).toEqual([text]);
  });

  it("splits text at paragraph boundary", () => {
    // Create text that needs splitting: ~1900 chars per paragraph, total ~3800+ chars
    const paragraph1 = "x".repeat(1900);
    const paragraph2 = "y".repeat(1900);
    const text = `${paragraph1}\n\n${paragraph2}`;

    const chunks = chunkMessengerText(text);

    expect(chunks.length).toBe(2);
    expect(chunks[0]).toBe(paragraph1);
    expect(chunks[1]).toBe(paragraph2);
  });

  it("splits text at newline boundary", () => {
    const line1 = "Line one content here.".repeat(50);
    const line2 = "Line two content here.".repeat(50);
    const text = `${line1}\n${line2}`;

    const chunks = chunkMessengerText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= MESSENGER_TEXT_CHUNK_LIMIT)).toBe(true);
  });

  it("splits text at sentence boundary", () => {
    const text = "This is a sentence. ".repeat(150);

    const chunks = chunkMessengerText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= MESSENGER_TEXT_CHUNK_LIMIT)).toBe(true);
  });

  it("splits text at word boundary", () => {
    const text = "word ".repeat(500);

    const chunks = chunkMessengerText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= MESSENGER_TEXT_CHUNK_LIMIT)).toBe(true);
  });

  it("hard breaks when no natural boundary", () => {
    const text = "x".repeat(5000);

    const chunks = chunkMessengerText(text);

    expect(chunks.length).toBe(3);
    expect(chunks[0]).toHaveLength(MESSENGER_TEXT_CHUNK_LIMIT);
    expect(chunks[1]).toHaveLength(MESSENGER_TEXT_CHUNK_LIMIT);
    expect(chunks[2]).toHaveLength(1000);
  });

  it("uses custom limit", () => {
    const text = "x".repeat(150);
    const chunks = chunkMessengerText(text, 100);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[1]).toHaveLength(50);
  });

  it("filters empty chunks", () => {
    const text = "Hello\n\n\n\nWorld";
    const chunks = chunkMessengerText(text, 100);

    expect(chunks.every((c) => c.length > 0)).toBe(true);
  });
});

describe("sendMessageMessenger", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sends text message successfully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        recipient_id: "123456789012345678901234567890123456",
        message_id: "mid.123",
      }),
    });

    const result = await sendMessageMessenger("123456789012345678901234567890123456", "Hello", {
      token: "test-token",
      fetch: mockFetch,
    });

    expect(result).toEqual({
      messageId: "mid.123",
      recipientId: "123456789012345678901234567890123456",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("graph.facebook.com"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("normalizes messenger: prefix", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        recipient_id: "1234567890123456",
        message_id: "mid.123",
      }),
    });

    await sendMessageMessenger("messenger:1234567890123456", "Hello", {
      token: "test-token",
      fetch: mockFetch,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.recipient.id).toBe("1234567890123456");
  });

  it("includes quick replies when provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        recipient_id: "1234567890123456",
        message_id: "mid.123",
      }),
    });

    await sendMessageMessenger("1234567890123456", "Choose one", {
      token: "test-token",
      fetch: mockFetch,
      quickReplies: [
        { content_type: "text", title: "Yes", payload: "YES" },
        { content_type: "text", title: "No", payload: "NO" },
      ],
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.message.quick_replies).toHaveLength(2);
  });

  it("uses message tag for tagged messages", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        recipient_id: "1234567890123456",
        message_id: "mid.123",
      }),
    });

    await sendMessageMessenger("1234567890123456", "Important update", {
      token: "test-token",
      fetch: mockFetch,
      messageTag: "CONFIRMED_EVENT_UPDATE",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messaging_type).toBe("MESSAGE_TAG");
    expect(body.tag).toBe("CONFIRMED_EVENT_UPDATE");
  });

  it("sends media message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        recipient_id: "1234567890123456",
        message_id: "mid.123",
      }),
    });

    await sendMessageMessenger("1234567890123456", "", {
      token: "test-token",
      fetch: mockFetch,
      mediaUrl: "https://example.com/image.jpg",
      mediaType: "image",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.message.attachment.type).toBe("image");
    expect(body.message.attachment.payload.url).toBe("https://example.com/image.jpg");
  });

  it("sends media with caption as separate message", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          recipient_id: "1234567890123456",
          message_id: "mid.123",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          recipient_id: "1234567890123456",
          message_id: "mid.124",
        }),
      });

    await sendMessageMessenger("1234567890123456", "Check this out!", {
      token: "test-token",
      fetch: mockFetch,
      mediaUrl: "https://example.com/image.jpg",
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const captionBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(captionBody.message.text).toBe("Check this out!");
  });

  it("infers media type from URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        recipient_id: "1234567890123456",
        message_id: "mid.123",
      }),
    });

    await sendMessageMessenger("1234567890123456", "", {
      token: "test-token",
      fetch: mockFetch,
      mediaUrl: "https://example.com/video.mp4",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.message.attachment.type).toBe("video");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          message: "Invalid recipient",
          code: 100,
        },
      }),
    });

    await expect(
      sendMessageMessenger("invalid", "Hello", {
        token: "test-token",
        fetch: mockFetch,
      }),
    ).rejects.toThrow("Messenger API error: Invalid recipient");
  });

  it("throws on missing recipient", async () => {
    await expect(
      sendMessageMessenger("", "Hello", {
        token: "test-token",
        fetch: mockFetch,
      }),
    ).rejects.toThrow("Recipient is required");
  });

  it("uses custom API version", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        recipient_id: "1234567890123456",
        message_id: "mid.123",
      }),
    });

    await sendMessageMessenger("1234567890123456", "Hello", {
      token: "test-token",
      fetch: mockFetch,
      apiVersion: "v19.0",
    });

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("v19.0"), expect.anything());
  });
});

describe("sendSenderAction", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sends typing_on action", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ recipient_id: "1234567890123456" }),
    });

    await sendSenderAction("1234567890123456", "typing_on", {
      token: "test-token",
      fetch: mockFetch,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.sender_action).toBe("typing_on");
    expect(body.recipient.id).toBe("1234567890123456");
  });

  it("sends typing_off action", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ recipient_id: "1234567890123456" }),
    });

    await sendSenderAction("1234567890123456", "typing_off", {
      token: "test-token",
      fetch: mockFetch,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.sender_action).toBe("typing_off");
  });

  it("sends mark_seen action", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ recipient_id: "1234567890123456" }),
    });

    await sendSenderAction("1234567890123456", "mark_seen", {
      token: "test-token",
      fetch: mockFetch,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.sender_action).toBe("mark_seen");
  });

  it("swallows errors silently", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    // Should not throw
    await sendSenderAction("1234567890123456", "typing_on", {
      token: "test-token",
      fetch: mockFetch,
    });
  });
});

describe("sendTypingIndicator", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sends typing_on action", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ recipient_id: "1234567890123456" }),
    });

    await sendTypingIndicator("1234567890123456", {
      token: "test-token",
      fetch: mockFetch,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.sender_action).toBe("typing_on");
  });
});

describe("stopTypingIndicator", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sends typing_off action", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ recipient_id: "1234567890123456" }),
    });

    await stopTypingIndicator("1234567890123456", {
      token: "test-token",
      fetch: mockFetch,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.sender_action).toBe("typing_off");
  });
});

describe("markSeen", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sends mark_seen action", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ recipient_id: "1234567890123456" }),
    });

    await markSeen("1234567890123456", {
      token: "test-token",
      fetch: mockFetch,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.sender_action).toBe("mark_seen");
  });
});

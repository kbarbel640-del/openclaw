import { describe, expect, it } from "vitest";
import type { MessengerMessagingEvent } from "./types.js";
import { parseMessengerEvent } from "./bot-message-context.js";

describe("parseMessengerEvent", () => {
  const baseSender = { id: "123456789" };
  const baseRecipient = { id: "987654321" };
  const baseTimestamp = Date.now();

  describe("text messages", () => {
    it("parses text message", () => {
      const event: MessengerMessagingEvent = {
        sender: baseSender,
        recipient: baseRecipient,
        timestamp: baseTimestamp,
        message: {
          mid: "msg-123",
          text: "Hello, world!",
        },
      };

      const result = parseMessengerEvent(event);

      expect(result).toEqual({
        messageId: "msg-123",
        text: "Hello, world!",
        attachments: [],
        isEcho: false,
        quickReplyPayload: undefined,
        postbackPayload: undefined,
        postbackTitle: undefined,
        replyToId: undefined,
        reaction: undefined,
        location: undefined,
      });
    });

    it("parses text message with reply_to", () => {
      const event: MessengerMessagingEvent = {
        sender: baseSender,
        recipient: baseRecipient,
        timestamp: baseTimestamp,
        message: {
          mid: "msg-456",
          text: "This is a reply",
          reply_to: { mid: "msg-123" },
        },
      };

      const result = parseMessengerEvent(event);

      expect(result?.replyToId).toBe("msg-123");
    });

    it("skips echo messages", () => {
      const event: MessengerMessagingEvent = {
        sender: baseSender,
        recipient: baseRecipient,
        timestamp: baseTimestamp,
        message: {
          mid: "msg-123",
          text: "Echo message",
          is_echo: true,
          app_id: 12345,
        },
      };

      const result = parseMessengerEvent(event);

      expect(result?.isEcho).toBe(true);
    });
  });

  describe("quick replies", () => {
    it("parses quick reply", () => {
      const event: MessengerMessagingEvent = {
        sender: baseSender,
        recipient: baseRecipient,
        timestamp: baseTimestamp,
        message: {
          mid: "msg-789",
          text: "Yes",
          quick_reply: { payload: "CONFIRM_YES" },
        },
      };

      const result = parseMessengerEvent(event);

      expect(result?.quickReplyPayload).toBe("CONFIRM_YES");
      expect(result?.text).toBe("Yes");
    });
  });

  describe("postbacks", () => {
    it("parses postback", () => {
      const event: MessengerMessagingEvent = {
        sender: baseSender,
        recipient: baseRecipient,
        timestamp: baseTimestamp,
        postback: {
          title: "Get Started",
          payload: "GET_STARTED_PAYLOAD",
        },
      };

      const result = parseMessengerEvent(event);

      expect(result?.postbackPayload).toBe("GET_STARTED_PAYLOAD");
      expect(result?.postbackTitle).toBe("Get Started");
      expect(result?.text).toBe("Get Started");
    });

    it("parses postback with referral", () => {
      const event: MessengerMessagingEvent = {
        sender: baseSender,
        recipient: baseRecipient,
        timestamp: baseTimestamp,
        postback: {
          title: "Get Started",
          payload: "GET_STARTED_PAYLOAD",
          referral: {
            ref: "campaign123",
            source: "SHORTLINK",
            type: "OPEN_THREAD",
          },
        },
      };

      const result = parseMessengerEvent(event);

      expect(result?.postbackPayload).toBe("GET_STARTED_PAYLOAD");
    });
  });

  describe("attachments", () => {
    it("parses image attachment", () => {
      const event: MessengerMessagingEvent = {
        sender: baseSender,
        recipient: baseRecipient,
        timestamp: baseTimestamp,
        message: {
          mid: "msg-img",
          attachments: [
            {
              type: "image",
              payload: { url: "https://example.com/image.jpg" },
            },
          ],
        },
      };

      const result = parseMessengerEvent(event);

      expect(result?.attachments).toHaveLength(1);
      expect(result?.attachments[0]).toEqual({
        url: "https://example.com/image.jpg",
        type: "image",
        stickerId: undefined,
      });
    });

    it("parses video attachment", () => {
      const event: MessengerMessagingEvent = {
        sender: baseSender,
        recipient: baseRecipient,
        timestamp: baseTimestamp,
        message: {
          mid: "msg-vid",
          attachments: [
            {
              type: "video",
              payload: { url: "https://example.com/video.mp4" },
            },
          ],
        },
      };

      const result = parseMessengerEvent(event);

      expect(result?.attachments[0]?.type).toBe("video");
    });

    it("parses audio attachment", () => {
      const event: MessengerMessagingEvent = {
        sender: baseSender,
        recipient: baseRecipient,
        timestamp: baseTimestamp,
        message: {
          mid: "msg-audio",
          attachments: [
            {
              type: "audio",
              payload: { url: "https://example.com/audio.mp3" },
            },
          ],
        },
      };

      const result = parseMessengerEvent(event);

      expect(result?.attachments[0]?.type).toBe("audio");
    });

    it("parses file attachment", () => {
      const event: MessengerMessagingEvent = {
        sender: baseSender,
        recipient: baseRecipient,
        timestamp: baseTimestamp,
        message: {
          mid: "msg-file",
          attachments: [
            {
              type: "file",
              payload: { url: "https://example.com/doc.pdf" },
            },
          ],
        },
      };

      const result = parseMessengerEvent(event);

      expect(result?.attachments[0]?.type).toBe("document");
    });

    it("parses sticker attachment", () => {
      const event: MessengerMessagingEvent = {
        sender: baseSender,
        recipient: baseRecipient,
        timestamp: baseTimestamp,
        message: {
          mid: "msg-sticker",
          attachments: [
            {
              type: "image",
              payload: {
                url: "https://example.com/sticker.png",
                sticker_id: 369239263222822,
              },
            },
          ],
        },
      };

      const result = parseMessengerEvent(event);

      expect(result?.attachments[0]?.stickerId).toBe(369239263222822);
    });

    it("parses multiple attachments", () => {
      const event: MessengerMessagingEvent = {
        sender: baseSender,
        recipient: baseRecipient,
        timestamp: baseTimestamp,
        message: {
          mid: "msg-multi",
          attachments: [
            { type: "image", payload: { url: "https://example.com/1.jpg" } },
            { type: "image", payload: { url: "https://example.com/2.jpg" } },
            { type: "image", payload: { url: "https://example.com/3.jpg" } },
          ],
        },
      };

      const result = parseMessengerEvent(event);

      expect(result?.attachments).toHaveLength(3);
    });

    it("parses text with attachment", () => {
      const event: MessengerMessagingEvent = {
        sender: baseSender,
        recipient: baseRecipient,
        timestamp: baseTimestamp,
        message: {
          mid: "msg-text-img",
          text: "Check this out!",
          attachments: [
            {
              type: "image",
              payload: { url: "https://example.com/image.jpg" },
            },
          ],
        },
      };

      const result = parseMessengerEvent(event);

      expect(result?.text).toBe("Check this out!");
      expect(result?.attachments).toHaveLength(1);
    });
  });

  describe("location", () => {
    it("parses location attachment", () => {
      const event: MessengerMessagingEvent = {
        sender: baseSender,
        recipient: baseRecipient,
        timestamp: baseTimestamp,
        message: {
          mid: "msg-loc",
          attachments: [
            {
              type: "location",
              payload: {
                coordinates: {
                  lat: 37.7749,
                  long: -122.4194,
                },
              },
            },
          ],
        },
      };

      const result = parseMessengerEvent(event);

      expect(result?.location).toEqual({
        lat: 37.7749,
        long: -122.4194,
      });
      expect(result?.attachments).toHaveLength(0); // Location is not in attachments
    });
  });

  describe("reactions", () => {
    it("parses reaction event", () => {
      const event: MessengerMessagingEvent = {
        sender: baseSender,
        recipient: baseRecipient,
        timestamp: baseTimestamp,
        reaction: {
          mid: "msg-target",
          action: "react",
          emoji: "❤️",
        },
      };

      const result = parseMessengerEvent(event);

      expect(result?.reaction).toEqual({
        messageId: "msg-target",
        action: "react",
        emoji: "❤️",
      });
    });

    it("parses unreact event", () => {
      const event: MessengerMessagingEvent = {
        sender: baseSender,
        recipient: baseRecipient,
        timestamp: baseTimestamp,
        reaction: {
          mid: "msg-target",
          action: "unreact",
        },
      };

      const result = parseMessengerEvent(event);

      expect(result?.reaction?.action).toBe("unreact");
    });
  });

  describe("edge cases", () => {
    it("returns null for empty event", () => {
      const event: MessengerMessagingEvent = {
        sender: baseSender,
        recipient: baseRecipient,
        timestamp: baseTimestamp,
      };

      const result = parseMessengerEvent(event);

      expect(result).toBe(null);
    });

    it("handles read receipts", () => {
      const event: MessengerMessagingEvent = {
        sender: baseSender,
        recipient: baseRecipient,
        timestamp: baseTimestamp,
        read: { watermark: 1234567890 },
      };

      const result = parseMessengerEvent(event);

      expect(result).toBe(null);
    });

    it("handles delivery receipts", () => {
      const event: MessengerMessagingEvent = {
        sender: baseSender,
        recipient: baseRecipient,
        timestamp: baseTimestamp,
        delivery: {
          mids: ["msg-1", "msg-2"],
          watermark: 1234567890,
        },
      };

      const result = parseMessengerEvent(event);

      expect(result).toBe(null);
    });
  });
});

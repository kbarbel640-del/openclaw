import { describe, expect, it, vi } from "vitest";
import type { MessengerMessagingEvent, MessengerWebhookPayload } from "./types.js";
import {
  countUserInitiatedEvents,
  getMessengerEventType,
  isUserInitiatedEvent,
  logMessengerEvent,
} from "./bot-handlers.js";

describe("getMessengerEventType", () => {
  const baseSender = { id: "123" };
  const baseRecipient = { id: "456" };
  const baseTimestamp = Date.now();

  it("identifies message events", () => {
    const event: MessengerMessagingEvent = {
      sender: baseSender,
      recipient: baseRecipient,
      timestamp: baseTimestamp,
      message: { mid: "msg-1", text: "Hello" },
    };
    expect(getMessengerEventType(event)).toBe("message");
  });

  it("identifies postback events", () => {
    const event: MessengerMessagingEvent = {
      sender: baseSender,
      recipient: baseRecipient,
      timestamp: baseTimestamp,
      postback: { title: "Click", payload: "CLICK" },
    };
    expect(getMessengerEventType(event)).toBe("postback");
  });

  it("identifies reaction events", () => {
    const event: MessengerMessagingEvent = {
      sender: baseSender,
      recipient: baseRecipient,
      timestamp: baseTimestamp,
      reaction: { mid: "msg-1", action: "react", emoji: "👍" },
    };
    expect(getMessengerEventType(event)).toBe("reaction");
  });

  it("identifies read events", () => {
    const event: MessengerMessagingEvent = {
      sender: baseSender,
      recipient: baseRecipient,
      timestamp: baseTimestamp,
      read: { watermark: 123456 },
    };
    expect(getMessengerEventType(event)).toBe("read");
  });

  it("identifies delivery events", () => {
    const event: MessengerMessagingEvent = {
      sender: baseSender,
      recipient: baseRecipient,
      timestamp: baseTimestamp,
      delivery: { mids: ["msg-1"], watermark: 123456 },
    };
    expect(getMessengerEventType(event)).toBe("delivery");
  });

  it("identifies optin events", () => {
    const event: MessengerMessagingEvent = {
      sender: baseSender,
      recipient: baseRecipient,
      timestamp: baseTimestamp,
      optin: { ref: "campaign" },
    };
    expect(getMessengerEventType(event)).toBe("optin");
  });

  it("identifies referral events", () => {
    const event: MessengerMessagingEvent = {
      sender: baseSender,
      recipient: baseRecipient,
      timestamp: baseTimestamp,
      referral: { ref: "link", source: "SHORTLINK", type: "OPEN_THREAD" },
    };
    expect(getMessengerEventType(event)).toBe("referral");
  });

  it("returns unknown for empty events", () => {
    const event: MessengerMessagingEvent = {
      sender: baseSender,
      recipient: baseRecipient,
      timestamp: baseTimestamp,
    };
    expect(getMessengerEventType(event)).toBe("unknown");
  });
});

describe("isUserInitiatedEvent", () => {
  const baseSender = { id: "123" };
  const baseRecipient = { id: "456" };
  const baseTimestamp = Date.now();

  it("returns true for messages", () => {
    const event: MessengerMessagingEvent = {
      sender: baseSender,
      recipient: baseRecipient,
      timestamp: baseTimestamp,
      message: { mid: "msg-1", text: "Hello" },
    };
    expect(isUserInitiatedEvent(event)).toBe(true);
  });

  it("returns false for echo messages", () => {
    const event: MessengerMessagingEvent = {
      sender: baseSender,
      recipient: baseRecipient,
      timestamp: baseTimestamp,
      message: { mid: "msg-1", text: "Hello", is_echo: true },
    };
    expect(isUserInitiatedEvent(event)).toBe(false);
  });

  it("returns true for postbacks", () => {
    const event: MessengerMessagingEvent = {
      sender: baseSender,
      recipient: baseRecipient,
      timestamp: baseTimestamp,
      postback: { title: "Click", payload: "CLICK" },
    };
    expect(isUserInitiatedEvent(event)).toBe(true);
  });

  it("returns true for reactions", () => {
    const event: MessengerMessagingEvent = {
      sender: baseSender,
      recipient: baseRecipient,
      timestamp: baseTimestamp,
      reaction: { mid: "msg-1", action: "react", emoji: "👍" },
    };
    expect(isUserInitiatedEvent(event)).toBe(true);
  });

  it("returns false for read receipts", () => {
    const event: MessengerMessagingEvent = {
      sender: baseSender,
      recipient: baseRecipient,
      timestamp: baseTimestamp,
      read: { watermark: 123456 },
    };
    expect(isUserInitiatedEvent(event)).toBe(false);
  });

  it("returns false for delivery receipts", () => {
    const event: MessengerMessagingEvent = {
      sender: baseSender,
      recipient: baseRecipient,
      timestamp: baseTimestamp,
      delivery: { mids: ["msg-1"], watermark: 123456 },
    };
    expect(isUserInitiatedEvent(event)).toBe(false);
  });

  it("returns true for optin events", () => {
    const event: MessengerMessagingEvent = {
      sender: baseSender,
      recipient: baseRecipient,
      timestamp: baseTimestamp,
      optin: { ref: "campaign" },
    };
    expect(isUserInitiatedEvent(event)).toBe(true);
  });

  it("returns true for referral events", () => {
    const event: MessengerMessagingEvent = {
      sender: baseSender,
      recipient: baseRecipient,
      timestamp: baseTimestamp,
      referral: { ref: "link", source: "SHORTLINK", type: "OPEN_THREAD" },
    };
    expect(isUserInitiatedEvent(event)).toBe(true);
  });
});

describe("countUserInitiatedEvents", () => {
  it("counts user-initiated events correctly", () => {
    const payload: MessengerWebhookPayload = {
      object: "page",
      entry: [
        {
          id: "page-1",
          time: Date.now(),
          messaging: [
            {
              sender: { id: "123" },
              recipient: { id: "456" },
              timestamp: Date.now(),
              message: { mid: "msg-1", text: "Hello" },
            },
            {
              sender: { id: "123" },
              recipient: { id: "456" },
              timestamp: Date.now(),
              read: { watermark: 123456 },
            },
            {
              sender: { id: "123" },
              recipient: { id: "456" },
              timestamp: Date.now(),
              postback: { title: "Click", payload: "CLICK" },
            },
          ],
        },
      ],
    };

    expect(countUserInitiatedEvents(payload)).toBe(2);
  });

  it("returns 0 for empty payload", () => {
    const payload: MessengerWebhookPayload = {
      object: "page",
      entry: [],
    };

    expect(countUserInitiatedEvents(payload)).toBe(0);
  });

  it("handles multiple entries", () => {
    const payload: MessengerWebhookPayload = {
      object: "page",
      entry: [
        {
          id: "page-1",
          time: Date.now(),
          messaging: [
            {
              sender: { id: "123" },
              recipient: { id: "456" },
              timestamp: Date.now(),
              message: { mid: "msg-1", text: "Hello" },
            },
          ],
        },
        {
          id: "page-1",
          time: Date.now(),
          messaging: [
            {
              sender: { id: "789" },
              recipient: { id: "456" },
              timestamp: Date.now(),
              message: { mid: "msg-2", text: "World" },
            },
          ],
        },
      ],
    };

    expect(countUserInitiatedEvents(payload)).toBe(2);
  });
});

describe("logMessengerEvent", () => {
  const baseSender = { id: "123" };
  const baseRecipient = { id: "456" };
  const baseTimestamp = Date.now();

  it("logs message events", () => {
    const log = vi.fn();
    const runtime = { log };
    const event: MessengerMessagingEvent = {
      sender: baseSender,
      recipient: baseRecipient,
      timestamp: baseTimestamp,
      message: { mid: "msg-1", text: "Hello, world!" },
    };

    logMessengerEvent(event, runtime);

    expect(log).toHaveBeenCalledWith(expect.stringContaining("message from=123"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('text="Hello, world!"'));
  });

  it("logs postback events", () => {
    const log = vi.fn();
    const runtime = { log };
    const event: MessengerMessagingEvent = {
      sender: baseSender,
      recipient: baseRecipient,
      timestamp: baseTimestamp,
      postback: { title: "Get Started", payload: "GET_STARTED" },
    };

    logMessengerEvent(event, runtime);

    expect(log).toHaveBeenCalledWith(expect.stringContaining("postback"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('title="Get Started"'));
  });

  it("logs reaction events", () => {
    const log = vi.fn();
    const runtime = { log };
    const event: MessengerMessagingEvent = {
      sender: baseSender,
      recipient: baseRecipient,
      timestamp: baseTimestamp,
      reaction: { mid: "msg-1", action: "react", emoji: "❤️" },
    };

    logMessengerEvent(event, runtime);

    expect(log).toHaveBeenCalledWith(expect.stringContaining("reaction"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('emoji="❤️"'));
  });

  it("logs read receipts", () => {
    const log = vi.fn();
    const runtime = { log };
    const event: MessengerMessagingEvent = {
      sender: baseSender,
      recipient: baseRecipient,
      timestamp: baseTimestamp,
      read: { watermark: 123456 },
    };

    logMessengerEvent(event, runtime);

    expect(log).toHaveBeenCalledWith(expect.stringContaining("read"));
  });

  it("logs delivery receipts", () => {
    const log = vi.fn();
    const runtime = { log };
    const event: MessengerMessagingEvent = {
      sender: baseSender,
      recipient: baseRecipient,
      timestamp: baseTimestamp,
      delivery: { mids: ["msg-1", "msg-2"], watermark: 123456 },
    };

    logMessengerEvent(event, runtime);

    expect(log).toHaveBeenCalledWith(expect.stringContaining("delivery"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("count=2"));
  });
});

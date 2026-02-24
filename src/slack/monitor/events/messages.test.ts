import { describe, expect, it, vi } from "vitest";
import { registerSlackMessageEvents } from "./messages.js";

const enqueueSystemEventMock = vi.fn();

vi.mock("../../../infra/system-events.js", () => ({
  enqueueSystemEvent: (...args: unknown[]) => enqueueSystemEventMock(...args),
}));

type MessageEventHandler = (args: {
  event: Record<string, unknown>;
  body: Record<string, unknown>;
}) => Promise<void>;

function createContext(botUserId = "B1") {
  let messageHandler: MessageEventHandler | null = null;
  const app = {
    event: vi.fn((name: string, handler: MessageEventHandler) => {
      if (name === "message") {
        messageHandler = handler;
      }
    }),
  };
  const ctx = {
    app,
    botUserId,
    runtime: { error: vi.fn() },
    shouldDropMismatchedSlackEvent: vi.fn().mockReturnValue(false),
    resolveChannelName: vi.fn().mockResolvedValue({ name: "general", type: "channel" }),
    isChannelAllowed: vi.fn().mockReturnValue(true),
    resolveSlackSystemEventSessionKey: vi.fn().mockReturnValue("agent:main:slack:channel:C1"),
  };
  return { ctx, app, getMessageHandler: () => messageHandler };
}

describe("registerSlackMessageEvents", () => {
  it("drops message_changed events from the bot itself", async () => {
    enqueueSystemEventMock.mockClear();
    const { ctx, getMessageHandler } = createContext("B1");
    registerSlackMessageEvents({
      ctx: ctx as never,
      handleSlackMessage: vi.fn(),
    });

    const handler = getMessageHandler();
    expect(handler).toBeTruthy();

    await handler!({
      event: {
        type: "message",
        subtype: "message_changed",
        channel: "C1",
        message: { ts: "100.1", bot_id: "BOT_APP_ID", user: "B1" },
        previous_message: { ts: "100.1" },
        event_ts: "100.2",
      },
      body: {},
    });

    expect(enqueueSystemEventMock).not.toHaveBeenCalled();
  });

  it("enqueues message_changed events from other users", async () => {
    enqueueSystemEventMock.mockClear();
    const { ctx, getMessageHandler } = createContext("B1");
    registerSlackMessageEvents({
      ctx: ctx as never,
      handleSlackMessage: vi.fn(),
    });

    const handler = getMessageHandler();
    await handler!({
      event: {
        type: "message",
        subtype: "message_changed",
        channel: "C1",
        message: { ts: "100.1", user: "U_HUMAN" },
        previous_message: { ts: "100.1" },
        event_ts: "100.2",
      },
      body: {},
    });

    expect(enqueueSystemEventMock).toHaveBeenCalledOnce();
    expect(enqueueSystemEventMock).toHaveBeenCalledWith(
      expect.stringContaining("edited"),
      expect.objectContaining({ sessionKey: "agent:main:slack:channel:C1" }),
    );
  });
});

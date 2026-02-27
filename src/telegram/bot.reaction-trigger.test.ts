import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueueSystemEventSpy,
  getLoadConfigMock,
  getOnHandler,
  wasSentByBot,
} from "./bot.create-telegram-bot.test-harness.js";
import { createTelegramBot } from "./bot.js";

const requestHeartbeatNowMock = vi.fn();

vi.mock("../infra/heartbeat-wake.js", () => ({
  requestHeartbeatNow: (...args: unknown[]) => requestHeartbeatNowMock(...args),
}));

const loadConfig = getLoadConfigMock();

type ReactionHandler = (ctx: Record<string, unknown>) => Promise<void>;

function makeReactionCtx(overrides?: {
  chatId?: number;
  chatType?: string;
  userId?: number;
  username?: string;
  isBot?: boolean;
  messageId?: number;
  isForum?: boolean;
}) {
  return {
    messageReaction: {
      chat: {
        id: overrides?.chatId ?? 100,
        type: overrides?.chatType ?? "private",
        is_forum: overrides?.isForum ?? false,
      },
      message_id: overrides?.messageId ?? 42,
      user: {
        id: overrides?.userId ?? 999,
        username: overrides?.username ?? "alice",
        first_name: "Alice",
        is_bot: overrides?.isBot ?? false,
      },
      old_reaction: [],
      new_reaction: [{ type: "emoji" as const, emoji: "👍" }],
    },
    me: { username: "openclaw_bot" },
  };
}

describe("telegram reactionTrigger", () => {
  beforeEach(() => {
    requestHeartbeatNowMock.mockClear();
    enqueueSystemEventSpy.mockClear();
    wasSentByBot.mockReset().mockReturnValue(false);
  });

  it("does not call requestHeartbeatNow when reactionTrigger is off", async () => {
    loadConfig.mockReturnValue({
      channels: {
        telegram: {
          reactionNotifications: "all",
          reactionTrigger: "off",
          dmPolicy: "open",
        },
      },
    });
    createTelegramBot({ token: "tok" });
    const handler = getOnHandler("message_reaction") as ReactionHandler;

    await handler(makeReactionCtx());

    expect(enqueueSystemEventSpy).toHaveBeenCalled();
    expect(requestHeartbeatNowMock).not.toHaveBeenCalled();
  });

  it("calls requestHeartbeatNow when reactionTrigger is 'all'", async () => {
    loadConfig.mockReturnValue({
      channels: {
        telegram: {
          reactionNotifications: "all",
          reactionTrigger: "all",
          dmPolicy: "open",
        },
      },
    });
    createTelegramBot({ token: "tok" });
    const handler = getOnHandler("message_reaction") as ReactionHandler;

    await handler(makeReactionCtx());

    expect(requestHeartbeatNowMock).toHaveBeenCalledTimes(1);
    expect(requestHeartbeatNowMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "reaction" }),
    );
  });

  it("calls requestHeartbeatNow for 'own' when wasSentByBot returns true", async () => {
    loadConfig.mockReturnValue({
      channels: {
        telegram: {
          reactionNotifications: "all",
          reactionTrigger: "own",
          dmPolicy: "open",
        },
      },
    });
    wasSentByBot.mockReturnValue(true);
    createTelegramBot({ token: "tok" });
    const handler = getOnHandler("message_reaction") as ReactionHandler;

    await handler(makeReactionCtx());

    expect(requestHeartbeatNowMock).toHaveBeenCalledTimes(1);
  });

  it("does not call requestHeartbeatNow for 'own' when wasSentByBot returns false", async () => {
    loadConfig.mockReturnValue({
      channels: {
        telegram: {
          reactionNotifications: "all",
          reactionTrigger: "own",
          dmPolicy: "open",
        },
      },
    });
    wasSentByBot.mockReturnValue(false);
    createTelegramBot({ token: "tok" });
    const handler = getOnHandler("message_reaction") as ReactionHandler;

    await handler(makeReactionCtx());

    expect(requestHeartbeatNowMock).not.toHaveBeenCalled();
  });
});

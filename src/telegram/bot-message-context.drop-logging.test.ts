import { describe, expect, it, vi } from "vitest";
import { buildTelegramMessageContext } from "./bot-message-context.js";

describe("buildTelegramMessageContext drop logging", () => {
  function baseParams(overrides: Record<string, unknown> = {}) {
    const logger = { info: vi.fn() };
    return {
      primaryCtx: {
        message: {
          message_id: 1,
          chat: { id: 100, type: "private" as const },
          date: 1700000000,
          text: "hello",
          from: { id: 42, first_name: "Alice", username: "alice" },
        },
        me: { id: 7, username: "bot" },
      } as never,
      allMedia: [],
      storeAllowFrom: [],
      options: {},
      bot: {
        api: {
          sendChatAction: vi.fn(),
          setMessageReaction: vi.fn(),
          sendMessage: vi.fn(),
        },
      } as never,
      cfg: {
        agents: { defaults: { model: "anthropic/claude-opus-4-5", workspace: "/tmp/openclaw" } },
        channels: { telegram: {} },
        messages: { groupChat: { mentionPatterns: [] } },
      } as never,
      account: { accountId: "default" } as never,
      historyLimit: 0,
      groupHistories: new Map(),
      dmPolicy: "open" as const,
      allowFrom: [] as Array<string | number>,
      groupAllowFrom: [] as Array<string | number>,
      ackReactionScope: "off" as const,
      logger,
      resolveGroupActivation: () => undefined,
      resolveGroupRequireMention: () => false,
      resolveTelegramGroupConfig: () => ({
        groupConfig: undefined,
        topicConfig: undefined,
      }),
      ...overrides,
    };
  }

  it("logs when DM policy is disabled", async () => {
    const params = baseParams({ dmPolicy: "disabled" });
    const result = await buildTelegramMessageContext(params as never);

    expect(result).toBeNull();
    expect(params.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "dm-disabled" }),
      "telegram inbound message dropped",
    );
  });

  it("logs when DM sender is not allowed (allowlist policy)", async () => {
    const params = baseParams({
      dmPolicy: "allowlist",
      allowFrom: [999],
    });
    const result = await buildTelegramMessageContext(params as never);

    expect(result).toBeNull();
    expect(params.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "dm-not-allowed", dmPolicy: "allowlist" }),
      "telegram inbound message dropped",
    );
  });

  it("logs when message has no text and no media", async () => {
    const params = baseParams();
    (params.primaryCtx as { message: { text?: string } }).message.text = undefined;
    const result = await buildTelegramMessageContext(params as never);

    expect(result).toBeNull();
    expect(params.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "empty-message" }),
      "telegram inbound message dropped",
    );
  });

  it("logs when group is disabled", async () => {
    const params = baseParams({
      resolveTelegramGroupConfig: () => ({
        groupConfig: { enabled: false },
        topicConfig: undefined,
      }),
    });
    (params.primaryCtx as { message: { chat: { id: number; type: string } } }).message.chat = {
      id: -200,
      type: "supergroup",
    };
    const result = await buildTelegramMessageContext(params as never);

    expect(result).toBeNull();
    expect(params.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "group-disabled" }),
      "telegram inbound message dropped",
    );
  });
});

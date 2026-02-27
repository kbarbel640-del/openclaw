import { ChannelType } from "@buape/carbon";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __testing as sessionBindingTesting,
  registerSessionBindingAdapter,
} from "../../infra/outbound/session-binding-service.js";
import {
  preflightDiscordMessage,
  resolvePreflightMentionRequirement,
  shouldIgnoreBoundThreadWebhookMessage,
} from "./message-handler.preflight.js";
import {
  __testing as threadBindingTesting,
  createNoopThreadBindingManager,
  createThreadBindingManager,
} from "./thread-bindings.js";

const readAllowFromStoreMock = vi.hoisted(() => vi.fn());
const upsertPairingRequestMock = vi.hoisted(() => vi.fn());
const sendMessageDiscordMock = vi.hoisted(() => vi.fn().mockResolvedValue({ messageId: "m1" }));

vi.mock("../../pairing/pairing-store.js", () => ({
  readChannelAllowFromStore: (...args: unknown[]) => readAllowFromStoreMock(...args),
  upsertChannelPairingRequest: (...args: unknown[]) => upsertPairingRequestMock(...args),
}));

vi.mock("../send.js", () => ({
  sendMessageDiscord: (...args: unknown[]) => sendMessageDiscordMock(...args),
}));

function createThreadBinding(
  overrides?: Partial<
    import("../../infra/outbound/session-binding-service.js").SessionBindingRecord
  >,
) {
  return {
    bindingId: "default:thread-1",
    targetSessionKey: "agent:main:subagent:child-1",
    targetKind: "subagent",
    conversation: {
      channel: "discord",
      accountId: "default",
      conversationId: "thread-1",
      parentConversationId: "parent-1",
    },
    status: "active",
    boundAt: 1,
    metadata: {
      agentId: "main",
      boundBy: "test",
      webhookId: "wh-1",
      webhookToken: "tok-1",
    },
    ...overrides,
  } satisfies import("../../infra/outbound/session-binding-service.js").SessionBindingRecord;
}

describe("resolvePreflightMentionRequirement", () => {
  it("requires mention when config requires mention and thread is not bound", () => {
    expect(
      resolvePreflightMentionRequirement({
        shouldRequireMention: true,
        isBoundThreadSession: false,
      }),
    ).toBe(true);
  });

  it("disables mention requirement for bound thread sessions", () => {
    expect(
      resolvePreflightMentionRequirement({
        shouldRequireMention: true,
        isBoundThreadSession: true,
      }),
    ).toBe(false);
  });

  it("keeps mention requirement disabled when config already disables it", () => {
    expect(
      resolvePreflightMentionRequirement({
        shouldRequireMention: false,
        isBoundThreadSession: false,
      }),
    ).toBe(false);
  });
});

describe("preflightDiscordMessage", () => {
  beforeEach(() => {
    sessionBindingTesting.resetSessionBindingAdaptersForTests();
    readAllowFromStoreMock.mockClear().mockResolvedValue([]);
    upsertPairingRequestMock.mockClear().mockResolvedValue({ code: "PAIRCODE", created: true });
    sendMessageDiscordMock.mockClear();
  });

  it("bypasses mention gating in bound threads for allowed bot senders", async () => {
    const threadBinding = createThreadBinding();
    const threadId = "thread-bot-focus";
    const parentId = "channel-parent-focus";
    const client = {
      fetchChannel: async (channelId: string) => {
        if (channelId === threadId) {
          return {
            id: threadId,
            type: ChannelType.PublicThread,
            name: "focus",
            parentId,
            ownerId: "owner-1",
          };
        }
        if (channelId === parentId) {
          return {
            id: parentId,
            type: ChannelType.GuildText,
            name: "general",
          };
        }
        return null;
      },
    } as unknown as import("@buape/carbon").Client;
    const message = {
      id: "m-bot-1",
      content: "relay message without mention",
      timestamp: new Date().toISOString(),
      channelId: threadId,
      attachments: [],
      mentionedUsers: [],
      mentionedRoles: [],
      mentionedEveryone: false,
      author: {
        id: "relay-bot-1",
        bot: true,
        username: "Relay",
      },
    } as unknown as import("@buape/carbon").Message;

    registerSessionBindingAdapter({
      channel: "discord",
      accountId: "default",
      listBySession: () => [],
      resolveByConversation: (ref) => (ref.conversationId === threadId ? threadBinding : null),
    });

    const result = await preflightDiscordMessage({
      cfg: {
        session: {
          mainKey: "main",
          scope: "per-sender",
        },
      } as import("../../config/config.js").OpenClawConfig,
      discordConfig: {
        allowBots: true,
      } as NonNullable<import("../../config/config.js").OpenClawConfig["channels"]>["discord"],
      accountId: "default",
      token: "token",
      runtime: {} as import("../../runtime.js").RuntimeEnv,
      botUserId: "openclaw-bot",
      guildHistories: new Map(),
      historyLimit: 0,
      mediaMaxBytes: 1_000_000,
      textLimit: 2_000,
      replyToMode: "all",
      dmEnabled: true,
      groupDmEnabled: true,
      ackReactionScope: "direct",
      groupPolicy: "open",
      threadBindings: createNoopThreadBindingManager("default"),
      data: {
        channel_id: threadId,
        guild_id: "guild-1",
        guild: {
          id: "guild-1",
          name: "Guild One",
        },
        author: message.author,
        message,
      } as unknown as import("./listeners.js").DiscordMessageEvent,
      client,
    });

    expect(result).not.toBeNull();
    expect(result?.boundSessionKey).toBe(threadBinding.targetSessionKey);
    expect(result?.shouldRequireMention).toBe(false);
  });

  it("uses account-scoped pairing lookups for DM authorization", async () => {
    readAllowFromStoreMock.mockImplementation(
      async (_channel: string, _env: NodeJS.ProcessEnv | undefined, accountId?: string) =>
        accountId ? [] : ["attacker-id"],
    );
    upsertPairingRequestMock.mockResolvedValue({ code: "ZXCVBN12", created: true });

    const client = {
      fetchChannel: async (channelId: string) => ({
        id: channelId,
        type: ChannelType.DM,
        name: "direct-message",
      }),
      rest: {},
    } as unknown as import("@buape/carbon").Client;

    const result = await preflightDiscordMessage({
      cfg: {
        channels: {
          discord: {
            dmPolicy: "pairing",
            allowFrom: [],
          },
        },
      } as import("../../config/config.js").OpenClawConfig,
      discordConfig: {
        dmPolicy: "pairing",
        allowFrom: [],
      } as NonNullable<import("../../config/config.js").OpenClawConfig["channels"]>["discord"],
      accountId: "work",
      token: "token-work",
      runtime: { log: vi.fn(), error: vi.fn() } as unknown as import("../../runtime.js").RuntimeEnv,
      botUserId: "openclaw-bot",
      guildHistories: new Map(),
      historyLimit: 0,
      mediaMaxBytes: 1_000_000,
      textLimit: 4_000,
      replyToMode: "all",
      dmEnabled: true,
      groupDmEnabled: true,
      ackReactionScope: "direct",
      groupPolicy: "open",
      allowFrom: [],
      threadBindings: createThreadBindingManager({
        accountId: "work",
        persist: false,
        enableSweeper: false,
      }),
      data: {
        channel_id: "dm-work",
        author: {
          id: "attacker-id",
          bot: false,
          username: "attacker",
          discriminator: "1111",
        },
        message: {
          id: "msg-account-scope",
          content: "hello",
          timestamp: new Date().toISOString(),
          channelId: "dm-work",
          attachments: [],
          mentionedUsers: [],
          mentionedRoles: [],
          mentionedEveryone: false,
          author: {
            id: "attacker-id",
            bot: false,
            username: "attacker",
            discriminator: "1111",
          },
        },
      } as unknown as import("./listeners.js").DiscordMessageEvent,
      client,
    });

    expect(readAllowFromStoreMock).toHaveBeenCalledWith("discord", process.env, "work");
    expect(upsertPairingRequestMock).toHaveBeenCalledWith({
      channel: "discord",
      id: "attacker-id",
      accountId: "work",
      meta: {
        tag: "attacker#1111",
        name: "attacker",
      },
    });
    expect(sendMessageDiscordMock).toHaveBeenCalledWith(
      "user:attacker-id",
      expect.stringContaining("Pairing code: ZXCVBN12"),
      expect.objectContaining({ accountId: "work", token: "token-work" }),
    );
    expect(result).toBeNull();
  });
});

describe("shouldIgnoreBoundThreadWebhookMessage", () => {
  beforeEach(() => {
    sessionBindingTesting.resetSessionBindingAdaptersForTests();
    threadBindingTesting.resetThreadBindingsForTests();
  });

  it("returns true when inbound webhook id matches the bound thread webhook", () => {
    expect(
      shouldIgnoreBoundThreadWebhookMessage({
        webhookId: "wh-1",
        threadBinding: createThreadBinding(),
      }),
    ).toBe(true);
  });

  it("returns false when webhook ids differ", () => {
    expect(
      shouldIgnoreBoundThreadWebhookMessage({
        webhookId: "wh-other",
        threadBinding: createThreadBinding(),
      }),
    ).toBe(false);
  });

  it("returns false when there is no bound thread webhook", () => {
    expect(
      shouldIgnoreBoundThreadWebhookMessage({
        webhookId: "wh-1",
        threadBinding: createThreadBinding({
          metadata: {
            webhookId: undefined,
          },
        }),
      }),
    ).toBe(false);
  });

  it("returns true for recently unbound thread webhook echoes", async () => {
    const manager = createThreadBindingManager({
      accountId: "default",
      persist: false,
      enableSweeper: false,
    });
    const binding = await manager.bindTarget({
      threadId: "thread-1",
      channelId: "parent-1",
      targetKind: "subagent",
      targetSessionKey: "agent:main:subagent:child-1",
      agentId: "main",
      webhookId: "wh-1",
      webhookToken: "tok-1",
    });
    expect(binding).not.toBeNull();

    manager.unbindThread({
      threadId: "thread-1",
      sendFarewell: false,
    });

    expect(
      shouldIgnoreBoundThreadWebhookMessage({
        accountId: "default",
        threadId: "thread-1",
        webhookId: "wh-1",
      }),
    ).toBe(true);
  });
});

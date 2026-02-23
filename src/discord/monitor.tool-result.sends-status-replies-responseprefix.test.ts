import type { Client } from "@buape/carbon";
import { ChannelType, MessageType } from "@buape/carbon";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  dispatchMock,
  readAllowFromStoreMock,
  sendMock,
  updateLastRouteMock,
  upsertPairingRequestMock,
} from "./monitor.tool-result.test-harness.js";
import { createDiscordMessageHandler } from "./monitor/message-handler.js";
import { __resetDiscordChannelInfoCacheForTest } from "./monitor/message-utils.js";
import { createNoopThreadBindingManager } from "./monitor/thread-bindings.js";

const fetchPluralKitMessageInfoMock = vi.hoisted(() => vi.fn());

vi.mock("./pluralkit.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./pluralkit.js")>();
  return {
    ...actual,
    fetchPluralKitMessageInfo: (...args: unknown[]) => fetchPluralKitMessageInfoMock(...args),
  };
});

type Config = ReturnType<typeof import("../config/config.js").loadConfig>;

beforeEach(() => {
  __resetDiscordChannelInfoCacheForTest();
  sendMock.mockClear().mockResolvedValue(undefined);
  updateLastRouteMock.mockClear();
  dispatchMock.mockClear().mockImplementation(async ({ dispatcher }) => {
    dispatcher.sendFinalReply({ text: "hi" });
    return { queuedFinal: true, counts: { tool: 0, block: 0, final: 1 } };
  });
  readAllowFromStoreMock.mockClear().mockResolvedValue([]);
  upsertPairingRequestMock.mockClear().mockResolvedValue({ code: "PAIRCODE", created: true });
  fetchPluralKitMessageInfoMock.mockReset().mockResolvedValue(null);
});

const BASE_CFG: Config = {
  agents: {
    defaults: {
      model: { primary: "anthropic/claude-opus-4-5" },
      workspace: "/tmp/openclaw",
    },
  },
  session: { store: "/tmp/openclaw-sessions.json" },
};

const CATEGORY_GUILD_CFG = {
  ...BASE_CFG,
  channels: {
    discord: {
      dm: { enabled: true, policy: "open" },
      guilds: {
        "*": {
          requireMention: false,
          channels: { c1: { allow: true } },
        },
      },
    },
  },
} satisfies Config;

function createHandlerBaseConfig(
  cfg: Config,
  runtimeError?: (err: unknown) => void,
): Parameters<typeof createDiscordMessageHandler>[0] {
  return {
    cfg,
    discordConfig: cfg.channels?.discord,
    accountId: "default",
    token: "token",
    runtime: {
      log: vi.fn(),
      error: runtimeError ?? vi.fn(),
      exit: (code: number): never => {
        throw new Error(`exit ${code}`);
      },
    },
    botUserId: "bot-id",
    guildHistories: new Map(),
    historyLimit: 0,
    mediaMaxBytes: 10_000,
    textLimit: 2000,
    replyToMode: "off",
    dmEnabled: true,
    groupDmEnabled: false,
    threadBindings: createNoopThreadBindingManager("default"),
  };
}

async function createDmHandler(opts: { cfg: Config; runtimeError?: (err: unknown) => void }) {
  return createDiscordMessageHandler(createHandlerBaseConfig(opts.cfg, opts.runtimeError));
}

function createDmClient() {
  return {
    fetchChannel: vi.fn().mockResolvedValue({
      type: ChannelType.DM,
      name: "dm",
    }),
  } as unknown as Client;
}

async function createCategoryGuildHandler() {
  return createDiscordMessageHandler({
    ...createHandlerBaseConfig(CATEGORY_GUILD_CFG),
    guildEntries: {
      "*": { requireMention: false, channels: { c1: { allow: true } } },
    },
  });
}

function createCategoryGuildClient() {
  return {
    fetchChannel: vi.fn().mockResolvedValue({
      type: ChannelType.GuildText,
      name: "general",
      parentId: "category-1",
    }),
    rest: { get: vi.fn() },
  } as unknown as Client;
}

function createCategoryGuildEvent(params: {
  messageId: string;
  timestamp?: string;
  author: Record<string, unknown>;
}) {
  return {
    message: {
      id: params.messageId,
      content: "hello",
      channelId: "c1",
      timestamp: params.timestamp ?? new Date().toISOString(),
      type: MessageType.Default,
      attachments: [],
      embeds: [],
      mentionedEveryone: false,
      mentionedUsers: [],
      mentionedRoles: [],
      author: params.author,
    },
    author: params.author,
    member: { displayName: "Ada" },
    guild: { id: "g1", name: "Guild" },
    guild_id: "g1",
  };
}

describe("discord tool result dispatch", () => {
  it("uses channel id allowlists for non-thread channels with categories", async () => {
    let capturedCtx: { SessionKey?: string } | undefined;
    dispatchMock.mockImplementationOnce(async ({ ctx, dispatcher }) => {
      capturedCtx = ctx;
      dispatcher.sendFinalReply({ text: "hi" });
      return { queuedFinal: true, counts: { final: 1 } };
    });

    const handler = await createCategoryGuildHandler();
    const client = createCategoryGuildClient();

    await handler(
      createCategoryGuildEvent({
        messageId: "m-category",
        author: { id: "u1", bot: false, username: "Ada", tag: "Ada#1" },
      }),
      client,
    );

    expect(capturedCtx?.SessionKey).toBe("agent:main:discord:channel:c1");
  });

  it("prefixes group bodies with sender label", async () => {
    let capturedBody = "";
    dispatchMock.mockImplementationOnce(async ({ ctx, dispatcher }) => {
      capturedBody = ctx.Body ?? "";
      dispatcher.sendFinalReply({ text: "ok" });
      return { queuedFinal: true, counts: { final: 1 } };
    });

    const handler = await createCategoryGuildHandler();
    const client = createCategoryGuildClient();

    await handler(
      createCategoryGuildEvent({
        messageId: "m-prefix",
        timestamp: new Date("2026-01-17T00:00:00Z").toISOString(),
        author: { id: "u1", bot: false, username: "Ada", discriminator: "1234" },
      }),
      client,
    );

    expect(capturedBody).toContain("Ada (Ada#1234): hello");
  });

  it("replies with pairing code and sender id when dmPolicy is pairing", async () => {
    const cfg = {
      ...BASE_CFG,
      channels: {
        discord: { dm: { enabled: true, policy: "pairing", allowFrom: [] } },
      },
    } as Config;

    const handler = await createDmHandler({ cfg });
    const client = createDmClient();

    await handler(
      {
        message: {
          id: "m1",
          content: "hello",
          channelId: "c1",
          timestamp: new Date().toISOString(),
          type: MessageType.Default,
          attachments: [],
          embeds: [],
          mentionedEveryone: false,
          mentionedUsers: [],
          mentionedRoles: [],
          author: { id: "u2", bot: false, username: "Ada" },
        },
        author: { id: "u2", bot: false, username: "Ada" },
        guild_id: null,
      },
      client,
    );

    expect(dispatchMock).not.toHaveBeenCalled();
    expect(upsertPairingRequestMock).toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(String(sendMock.mock.calls[0]?.[1] ?? "")).toContain("Your Discord user id: u2");
    expect(String(sendMock.mock.calls[0]?.[1] ?? "")).toContain("Pairing code: PAIRCODE");
  }, 10000);

  it("drops non-guild messages when DM channel lookup is unavailable", async () => {
    const cfg = {
      ...BASE_CFG,
      channels: {
        discord: { dm: { enabled: true, policy: "open" } },
      },
    } as Config;

    const handler = await createDmHandler({ cfg });
    const client = {
      fetchChannel: vi.fn().mockRejectedValue(new Error("discord lookup timed out")),
    } as unknown as Client;

    await handler(
      {
        message: {
          id: "m-timeout",
          content: "hello",
          channelId: "c1",
          timestamp: new Date().toISOString(),
          type: MessageType.Default,
          attachments: [],
          embeds: [],
          mentionedEveryone: false,
          mentionedUsers: [],
          mentionedRoles: [],
          author: { id: "u-timeout", bot: false, username: "Ada" },
        },
        author: { id: "u-timeout", bot: false, username: "Ada" },
        guild_id: null,
      },
      client,
    );

    expect(dispatchMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("retries PluralKit lookup with a longer timeout before dropping bot messages", async () => {
    const cfg = {
      ...BASE_CFG,
      channels: {
        discord: {
          dm: { enabled: true, policy: "open" },
          pluralkit: { enabled: true },
        },
      },
    } as Config;

    fetchPluralKitMessageInfoMock
      .mockRejectedValueOnce(new Error("aborted"))
      .mockResolvedValueOnce({
        id: "m-pk",
        member: { id: "pk_member_1", name: "Proxy User" },
        system: { id: "pk_system_1", name: "Collective" },
      });

    const handler = await createDmHandler({ cfg });
    const client = createDmClient();

    await handler(
      {
        message: {
          id: "m-pk",
          content: "hello from proxy",
          channelId: "c1",
          timestamp: new Date().toISOString(),
          type: MessageType.Default,
          attachments: [],
          embeds: [],
          mentionedEveryone: false,
          mentionedUsers: [],
          mentionedRoles: [],
          author: { id: "proxy-bot", bot: true, username: "Proxy", discriminator: "0" },
        },
        author: { id: "proxy-bot", bot: true, username: "Proxy", discriminator: "0" },
        guild_id: null,
      },
      client,
    );

    expect(fetchPluralKitMessageInfoMock).toHaveBeenCalledTimes(2);
    expect(fetchPluralKitMessageInfoMock.mock.calls[0]?.[0]).toMatchObject({
      messageId: "m-pk",
      timeoutMs: 1_500,
    });
    expect(fetchPluralKitMessageInfoMock.mock.calls[1]?.[0]).toMatchObject({
      messageId: "m-pk",
      timeoutMs: 5_000,
    });
    expect(dispatchMock).toHaveBeenCalledTimes(1);
  });
});

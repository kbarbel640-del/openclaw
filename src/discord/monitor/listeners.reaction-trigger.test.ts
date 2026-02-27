import { ChannelType } from "@buape/carbon";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiscordReactionListener } from "./listeners.js";

const requestHeartbeatNowMock = vi.fn();
const enqueueSystemEventMock = vi.fn();

vi.mock("../../infra/heartbeat-wake.js", () => ({
  requestHeartbeatNow: (...args: unknown[]) => requestHeartbeatNowMock(...args),
}));

vi.mock("../../infra/system-events.js", () => ({
  enqueueSystemEvent: (...args: unknown[]) => enqueueSystemEventMock(...args),
}));

vi.mock("../../pairing/pairing-store.js", () => ({
  readChannelAllowFromStore: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../routing/resolve-route.js", () => ({
  resolveAgentRoute: vi.fn(() => ({ sessionKey: "test-session" })),
}));

function makeClient() {
  return {
    fetchChannel: vi.fn(async () => ({
      id: "ch-1",
      name: "general",
      type: ChannelType.GuildText,
    })),
  } as unknown as import("@buape/carbon").Client;
}

function makeReactionData(overrides?: Record<string, unknown>) {
  return {
    user: { id: "user-1", username: "alice", bot: false },
    emoji: { name: "👍", id: null },
    channel_id: "ch-1",
    message_id: "msg-1",
    guild_id: "guild-1",
    guild: { id: "guild-1", name: "Test Guild" },
    rawMember: { roles: [] },
    ...overrides,
  };
}

function makeParams(overrides?: Record<string, unknown>) {
  return {
    cfg: {},
    accountId: "default",
    runtime: { log: () => {}, error: () => {} },
    botUserId: "bot-1",
    dmEnabled: true,
    groupDmEnabled: false,
    groupDmChannels: [],
    dmPolicy: "open" as const,
    allowFrom: ["*"],
    groupPolicy: "open" as const,
    allowNameMatching: false,
    guildEntries: {
      "guild-1": {
        guildId: "guild-1",
        slug: "test-guild",
        reactionNotifications: "all" as const,
        reactionTrigger: "off" as const,
        ...overrides,
      },
    },
    logger: { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} },
    ...overrides,
  };
}

describe("discord reactionTrigger", () => {
  beforeEach(() => {
    requestHeartbeatNowMock.mockClear();
    enqueueSystemEventMock.mockClear();
  });

  it("does not call requestHeartbeatNow when reactionTrigger is off", async () => {
    const listener = new DiscordReactionListener(
      makeParams({
        guildEntries: {
          "guild-1": {
            guildId: "guild-1",
            slug: "test-guild",
            reactionNotifications: "all",
            reactionTrigger: "off",
          },
        },
      }) as unknown as ConstructorParameters<typeof DiscordReactionListener>[0],
    );
    await listener.handle(makeReactionData() as never, makeClient());

    expect(enqueueSystemEventMock).toHaveBeenCalled();
    expect(requestHeartbeatNowMock).not.toHaveBeenCalled();
  });

  it("calls requestHeartbeatNow when reactionTrigger is 'all'", async () => {
    const listener = new DiscordReactionListener(
      makeParams({
        guildEntries: {
          "guild-1": {
            guildId: "guild-1",
            slug: "test-guild",
            reactionNotifications: "all",
            reactionTrigger: "all",
          },
        },
      }) as never,
    );
    await listener.handle(makeReactionData() as never, makeClient());

    expect(requestHeartbeatNowMock).toHaveBeenCalledTimes(1);
    expect(requestHeartbeatNowMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "reaction" }),
    );
  });

  it("does not call requestHeartbeatNow when reactionTrigger is 'allowlist'", async () => {
    const listener = new DiscordReactionListener(
      makeParams({
        guildEntries: {
          "guild-1": {
            guildId: "guild-1",
            slug: "test-guild",
            reactionNotifications: "all",
            reactionTrigger: "allowlist",
          },
        },
      }) as never,
    );
    await listener.handle(makeReactionData() as never, makeClient());

    expect(enqueueSystemEventMock).toHaveBeenCalled();
    expect(requestHeartbeatNowMock).not.toHaveBeenCalled();
  });
});

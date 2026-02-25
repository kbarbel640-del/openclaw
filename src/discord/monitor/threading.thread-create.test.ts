import type { Client } from "@buape/carbon";
import { Routes } from "discord-api-types/v10";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiscordThreadCreateListener } from "./listeners.js";

function makeClient(restPutImpl?: () => Promise<unknown>): Client {
  return {
    rest: {
      put: restPutImpl ?? vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as Client;
}

function makeThreadData(
  overrides: {
    id?: string;
    guild_id?: string | null;
    newly_created?: true | undefined;
  } = {},
): Parameters<DiscordThreadCreateListener["handle"]>[0] {
  const base: Record<string, unknown> = {
    id: overrides.id ?? "thread-123",
    newly_created: overrides.newly_created,
    type: 11, // PublicThread
    name: "test-thread",
    parent_id: "channel-789",
  };
  // Only set guild_id if explicitly provided and not null (null means "omit")
  if (overrides.guild_id !== null && overrides.guild_id !== undefined) {
    base.guild_id = overrides.guild_id;
  } else if (!("guild_id" in overrides)) {
    base.guild_id = "guild-456";
  }
  return base as unknown as Parameters<DiscordThreadCreateListener["handle"]>[0];
}

describe("DiscordThreadCreateListener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("joins newly created guild thread", async () => {
    const putMock = vi.fn().mockResolvedValue(undefined);
    const client = makeClient(() => putMock());
    client.rest.put = putMock;

    const listener = new DiscordThreadCreateListener({ autoJoinBotThreads: true });
    const data = makeThreadData({ newly_created: true });

    await listener.handle(data, client);

    expect(putMock).toHaveBeenCalledOnce();
    expect(putMock).toHaveBeenCalledWith(Routes.threadMembers("thread-123", "@me"), {});
  });

  it("skips if autoJoinBotThreads is false", async () => {
    const putMock = vi.fn().mockResolvedValue(undefined);
    const client = makeClient(() => putMock());
    client.rest.put = putMock;

    const listener = new DiscordThreadCreateListener({ autoJoinBotThreads: false });
    const data = makeThreadData({ newly_created: true });

    await listener.handle(data, client);

    expect(putMock).not.toHaveBeenCalled();
  });

  it("skips non-guild threads (no guild_id)", async () => {
    const putMock = vi.fn().mockResolvedValue(undefined);
    const client = makeClient(() => putMock());
    client.rest.put = putMock;

    const listener = new DiscordThreadCreateListener({ autoJoinBotThreads: true });
    const data = makeThreadData({ newly_created: true, guild_id: null });

    await listener.handle(data, client);

    expect(putMock).not.toHaveBeenCalled();
  });

  it("skips if newly_created is false (undefined)", async () => {
    const putMock = vi.fn().mockResolvedValue(undefined);
    const client = makeClient(() => putMock());
    client.rest.put = putMock;

    const listener = new DiscordThreadCreateListener({ autoJoinBotThreads: true });
    const data = makeThreadData({ newly_created: undefined });

    await listener.handle(data, client);

    expect(putMock).not.toHaveBeenCalled();
  });

  it("does not throw if join fails, logs warning", async () => {
    const warnMock = vi.fn();
    const putMock = vi.fn().mockRejectedValue(new Error("Discord REST error"));
    const client = {
      rest: { put: putMock },
    } as unknown as Client;

    const logger = {
      warn: warnMock,
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    } as unknown as import("../../logging/subsystem.js").SubsystemLogger;

    const listener = new DiscordThreadCreateListener({ autoJoinBotThreads: true, logger });
    const data = makeThreadData({ newly_created: true });

    await expect(listener.handle(data, client)).resolves.not.toThrow();
    expect(warnMock).toHaveBeenCalledWith(expect.stringContaining("thread-123"));
  });
});

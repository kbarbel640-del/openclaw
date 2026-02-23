import { ChannelType } from "@buape/carbon";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { joinVoiceChannelMock, entersStateMock, createAudioPlayerMock, resolveAgentRouteMock } =
  vi.hoisted(() => {
    type EventHandler = (...args: unknown[]) => unknown;
    type MockConnection = {
      destroy: ReturnType<typeof vi.fn>;
      subscribe: ReturnType<typeof vi.fn>;
      on: ReturnType<typeof vi.fn>;
      receiver: {
        speaking: { on: ReturnType<typeof vi.fn> };
        subscribe: ReturnType<typeof vi.fn>;
      };
      handlers: Map<string, EventHandler>;
    };

    const makeConnection = (): MockConnection => {
      const handlers = new Map<string, EventHandler>();
      const connection: MockConnection = {
        destroy: vi.fn(),
        subscribe: vi.fn(),
        on: vi.fn((event: string, handler: EventHandler) => {
          handlers.set(event, handler);
        }),
        receiver: {
          speaking: { on: vi.fn() },
          subscribe: vi.fn(),
        },
        handlers,
      };
      return connection;
    };

    return {
      joinVoiceChannelMock: vi.fn(() => makeConnection()),
      entersStateMock: vi.fn(async (_target?: unknown, _state?: string, _timeoutMs?: number) => {
        return undefined;
      }),
      createAudioPlayerMock: vi.fn(() => ({
        on: vi.fn(),
        stop: vi.fn(),
        play: vi.fn(),
        state: { status: "idle" },
      })),
      resolveAgentRouteMock: vi.fn(() => ({ agentId: "agent-1", sessionKey: "discord:g1:c1" })),
    };
  });

vi.mock("@discordjs/voice", () => ({
  AudioPlayerStatus: { Playing: "playing", Idle: "idle" },
  EndBehaviorType: { AfterSilence: "AfterSilence" },
  VoiceConnectionStatus: {
    Ready: "ready",
    Disconnected: "disconnected",
    Destroyed: "destroyed",
    Signalling: "signalling",
    Connecting: "connecting",
  },
  createAudioPlayer: createAudioPlayerMock,
  createAudioResource: vi.fn(),
  entersState: entersStateMock,
  joinVoiceChannel: joinVoiceChannelMock,
}));

vi.mock("../../routing/resolve-route.js", () => ({
  resolveAgentRoute: resolveAgentRouteMock,
}));

let managerModule: typeof import("./manager.js");

function createClient() {
  return {
    fetchChannel: vi.fn(async (channelId: string) => ({
      id: channelId,
      guildId: "g1",
      type: ChannelType.GuildVoice,
    })),
    getPlugin: vi.fn(() => ({
      getGatewayAdapterCreator: vi.fn(() => vi.fn()),
    })),
    fetchMember: vi.fn(),
    fetchUser: vi.fn(),
  };
}

function createRuntime() {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  };
}

describe("DiscordVoiceManager session lifecycle", () => {
  beforeAll(async () => {
    managerModule = await import("./manager.js");
  });

  beforeEach(() => {
    joinVoiceChannelMock.mockClear();
    entersStateMock.mockReset();
    createAudioPlayerMock.mockClear();
    resolveAgentRouteMock.mockClear();
  });

  it("keeps the new session when an old disconnected handler fires", async () => {
    const oldConnection = {
      destroy: vi.fn(),
      subscribe: vi.fn(),
      on: vi.fn(),
      receiver: { speaking: { on: vi.fn() }, subscribe: vi.fn() },
      handlers: new Map<string, (...args: unknown[]) => unknown>(),
    };
    oldConnection.on.mockImplementation(
      (event: string, handler: (...args: unknown[]) => unknown) => {
        oldConnection.handlers.set(event, handler);
      },
    );
    const newConnection = {
      destroy: vi.fn(),
      subscribe: vi.fn(),
      on: vi.fn(),
      receiver: { speaking: { on: vi.fn() }, subscribe: vi.fn() },
      handlers: new Map<string, (...args: unknown[]) => unknown>(),
    };
    newConnection.on.mockImplementation(
      (event: string, handler: (...args: unknown[]) => unknown) => {
        newConnection.handlers.set(event, handler);
      },
    );

    joinVoiceChannelMock.mockReset();
    joinVoiceChannelMock.mockReturnValueOnce(oldConnection).mockReturnValueOnce(newConnection);
    entersStateMock.mockImplementation(
      async (target: unknown, status?: string): Promise<undefined> => {
        if (target === oldConnection && (status === "signalling" || status === "connecting")) {
          throw new Error("old disconnected");
        }
        return undefined;
      },
    );

    const manager = new managerModule.DiscordVoiceManager({
      client: createClient() as never,
      cfg: {},
      discordConfig: {},
      accountId: "default",
      runtime: createRuntime(),
    });

    await manager.join({ guildId: "g1", channelId: "c1" });
    await manager.join({ guildId: "g1", channelId: "c2" });

    const oldDisconnected = oldConnection.handlers.get("disconnected");
    expect(oldDisconnected).toBeTypeOf("function");
    await oldDisconnected?.();

    expect(manager.status()).toEqual([
      {
        ok: true,
        message: "connected: guild g1 channel c2",
        guildId: "g1",
        channelId: "c2",
      },
    ]);
  });

  it("keeps the new session when an old destroyed handler fires", async () => {
    const oldConnection = {
      destroy: vi.fn(),
      subscribe: vi.fn(),
      on: vi.fn(),
      receiver: { speaking: { on: vi.fn() }, subscribe: vi.fn() },
      handlers: new Map<string, (...args: unknown[]) => unknown>(),
    };
    oldConnection.on.mockImplementation(
      (event: string, handler: (...args: unknown[]) => unknown) => {
        oldConnection.handlers.set(event, handler);
      },
    );
    const newConnection = {
      destroy: vi.fn(),
      subscribe: vi.fn(),
      on: vi.fn(),
      receiver: { speaking: { on: vi.fn() }, subscribe: vi.fn() },
      handlers: new Map<string, (...args: unknown[]) => unknown>(),
    };
    newConnection.on.mockImplementation(
      (event: string, handler: (...args: unknown[]) => unknown) => {
        newConnection.handlers.set(event, handler);
      },
    );

    joinVoiceChannelMock.mockReset();
    joinVoiceChannelMock.mockReturnValueOnce(oldConnection).mockReturnValueOnce(newConnection);
    entersStateMock.mockResolvedValue(undefined);

    const manager = new managerModule.DiscordVoiceManager({
      client: createClient() as never,
      cfg: {},
      discordConfig: {},
      accountId: "default",
      runtime: createRuntime(),
    });

    await manager.join({ guildId: "g1", channelId: "c1" });
    await manager.join({ guildId: "g1", channelId: "c2" });

    const oldDestroyed = oldConnection.handlers.get("destroyed");
    expect(oldDestroyed).toBeTypeOf("function");
    oldDestroyed?.();

    expect(manager.status()).toEqual([
      {
        ok: true,
        message: "connected: guild g1 channel c2",
        guildId: "g1",
        channelId: "c2",
      },
    ]);
  });
});

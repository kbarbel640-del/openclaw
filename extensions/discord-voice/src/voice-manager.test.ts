import { beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceManager, type JoinParams, type VoiceManagerConfig } from "./voice-manager.js";

const voiceMock = vi.hoisted(() => {
  const status = {
    Signalling: "signalling",
    Connecting: "connecting",
    Ready: "ready",
    Disconnected: "disconnected",
    Destroyed: "destroyed",
  };

  type StateChange = { status: string };
  type StateChangeHandler = (oldState: StateChange, newState: StateChange) => void;

  class MockVoiceConnection {
    guildId: string;
    channelId: string;
    state: { status: string };
    private stateChangeHandlers = new Set<StateChangeHandler>();
    destroy = vi.fn(() => {
      this.transition(status.Destroyed);
    });
    rejoin = vi.fn(() => true);

    constructor(guildId: string, channelId: string) {
      this.guildId = guildId;
      this.channelId = channelId;
      this.state = { status: status.Signalling };
    }

    on(event: string, handler: StateChangeHandler): this {
      if (event === "stateChange") {
        this.stateChangeHandlers.add(handler);
      }
      return this;
    }

    off(event: string, handler: StateChangeHandler): this {
      if (event === "stateChange") {
        this.stateChangeHandlers.delete(handler);
      }
      return this;
    }

    removeListener(event: string, handler: StateChangeHandler): this {
      return this.off(event, handler);
    }

    transition(nextStatus: string): void {
      const oldState = { ...this.state };
      this.state = { status: nextStatus };
      for (const handler of this.stateChangeHandlers) {
        handler(oldState, { ...this.state });
      }
    }
  }

  const connections = new Map<string, MockVoiceConnection>();
  const joinVoiceChannel = vi.fn();
  const getVoiceConnection = vi.fn();
  const entersState = vi.fn();

  return {
    status,
    MockVoiceConnection,
    connections,
    joinVoiceChannel,
    getVoiceConnection,
    entersState,
  };
});

vi.mock("@discordjs/voice", () => ({
  joinVoiceChannel: voiceMock.joinVoiceChannel,
  getVoiceConnection: voiceMock.getVoiceConnection,
  VoiceConnectionStatus: voiceMock.status,
  entersState: voiceMock.entersState,
}));

type TestLogger = {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
};

const createLogger = (): TestLogger => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

const createConfig = (overrides: Partial<VoiceManagerConfig> = {}): VoiceManagerConfig => ({
  maxConcurrentChannels: 2,
  allowedGuilds: [],
  allowedChannels: [],
  joinTimeoutMs: 30_000,
  reconnectAttempts: 3,
  ...overrides,
});

const joinParams = (overrides: Partial<JoinParams> = {}): JoinParams => ({
  guildId: "guild-1",
  channelId: "channel-1",
  adapterCreator: { sendPayload: vi.fn(), destroy: vi.fn() },
  ...overrides,
});

beforeEach(() => {
  voiceMock.connections.clear();
  voiceMock.joinVoiceChannel.mockReset();
  voiceMock.getVoiceConnection.mockReset();
  voiceMock.entersState.mockReset();

  voiceMock.joinVoiceChannel.mockImplementation(
    (params: { guildId: string; channelId: string }) => {
      const connection = new voiceMock.MockVoiceConnection(params.guildId, params.channelId);
      voiceMock.connections.set(params.guildId, connection);
      return connection;
    },
  );

  voiceMock.getVoiceConnection.mockImplementation((guildId: string) => {
    return voiceMock.connections.get(guildId);
  });

  voiceMock.entersState.mockImplementation(
    async (connection: { transition: (s: string) => void }) => {
      connection.transition(voiceMock.status.Ready);
      return connection;
    },
  );
});

describe("VoiceManager", () => {
  it("join() calls joinVoiceChannel with correct params", async () => {
    const logger = createLogger();
    const manager = new VoiceManager(createConfig(), logger);

    await manager.join(joinParams({ selfDeaf: false, selfMute: true }));

    expect(voiceMock.joinVoiceChannel).toHaveBeenCalledWith({
      guildId: "guild-1",
      channelId: "channel-1",
      adapterCreator: expect.any(Object),
      selfDeaf: false,
      selfMute: true,
    });
  });

  it("join() waits for Ready state", async () => {
    const logger = createLogger();
    const manager = new VoiceManager(createConfig({ joinTimeoutMs: 12_345 }), logger);

    await manager.join(joinParams());

    expect(voiceMock.entersState).toHaveBeenCalledWith(
      expect.any(voiceMock.MockVoiceConnection),
      voiceMock.status.Ready,
      12_345,
    );
  });

  it("join() stores connection in map", async () => {
    const logger = createLogger();
    const manager = new VoiceManager(createConfig(), logger);

    const connection = (await manager.join(joinParams())) as unknown as InstanceType<
      typeof voiceMock.MockVoiceConnection
    >;

    expect(manager.getConnection("guild-1")).toBe(connection);
    expect(manager.getActiveCount()).toBe(1);
  });

  it("leave() destroys connection and removes from map", async () => {
    const logger = createLogger();
    const manager = new VoiceManager(createConfig(), logger);

    const connection = (await manager.join(joinParams())) as unknown as InstanceType<
      typeof voiceMock.MockVoiceConnection
    >;
    await manager.leave("guild-1");

    expect(connection.destroy).toHaveBeenCalledTimes(1);
    expect(manager.getConnection("guild-1")).toBeUndefined();
  });

  it("leaveAll() destroys all active connections", async () => {
    const logger = createLogger();
    const manager = new VoiceManager(createConfig(), logger);

    const one = await manager.join(joinParams({ guildId: "guild-1", channelId: "channel-1" }));
    const two = await manager.join(joinParams({ guildId: "guild-2", channelId: "channel-2" }));

    await manager.leaveAll();

    expect(one.destroy).toHaveBeenCalledTimes(1);
    expect(two.destroy).toHaveBeenCalledTimes(1);
    expect(manager.getActiveCount()).toBe(0);
  });

  it("isAtCapacity() returns true when active connections hit maxConcurrentChannels", async () => {
    const logger = createLogger();
    const manager = new VoiceManager(createConfig({ maxConcurrentChannels: 1 }), logger);

    await manager.join(joinParams());

    expect(manager.isAtCapacity()).toBe(true);
  });

  it("join() rejects when at capacity", async () => {
    const logger = createLogger();
    const manager = new VoiceManager(createConfig({ maxConcurrentChannels: 1 }), logger);

    await manager.join(joinParams());

    await expect(
      manager.join(joinParams({ guildId: "guild-2", channelId: "channel-2" })),
    ).rejects.toThrow(/capacity/i);
  });

  it("join() rejects for disallowed guild", async () => {
    const logger = createLogger();
    const manager = new VoiceManager(createConfig({ allowedGuilds: ["guild-allow"] }), logger);

    await expect(manager.join(joinParams({ guildId: "guild-deny" }))).rejects.toThrow(
      /not allowed/i,
    );
  });

  it("join() rejects for disallowed channel", async () => {
    const logger = createLogger();
    const manager = new VoiceManager(createConfig({ allowedChannels: ["channel-allow"] }), logger);

    await expect(manager.join(joinParams({ channelId: "channel-deny" }))).rejects.toThrow(
      /not allowed/i,
    );
  });

  it("join() returns existing connection for the same guild", async () => {
    const logger = createLogger();
    const manager = new VoiceManager(createConfig(), logger);

    const first = await manager.join(joinParams({ guildId: "guild-1", channelId: "channel-1" }));
    const second = await manager.join(
      joinParams({ guildId: "guild-1", channelId: "different-channel" }),
    );

    expect(second).toBe(first);
    expect(voiceMock.joinVoiceChannel).toHaveBeenCalledTimes(1);
  });

  it("getActiveCount() returns the number of tracked connections", async () => {
    const logger = createLogger();
    const manager = new VoiceManager(createConfig(), logger);

    expect(manager.getActiveCount()).toBe(0);
    await manager.join(joinParams({ guildId: "guild-1", channelId: "channel-1" }));
    await manager.join(joinParams({ guildId: "guild-2", channelId: "channel-2" }));

    expect(manager.getActiveCount()).toBe(2);
  });

  it("destroy() cleans up all connections and listeners", async () => {
    const logger = createLogger();
    const manager = new VoiceManager(createConfig(), logger);

    const one = await manager.join(joinParams({ guildId: "guild-1", channelId: "channel-1" }));
    const two = await manager.join(joinParams({ guildId: "guild-2", channelId: "channel-2" }));

    await manager.destroy();

    expect(one.destroy).toHaveBeenCalledTimes(1);
    expect(two.destroy).toHaveBeenCalledTimes(1);
    expect(manager.getActiveCount()).toBe(0);
  });

  it("join() emits connected events and leave() emits destroyed", async () => {
    const logger = createLogger();
    const manager = new VoiceManager(createConfig(), logger);
    const connected = vi.fn();
    const destroyed = vi.fn();
    manager.on("connected", connected);
    manager.on("destroyed", destroyed);

    await manager.join(joinParams());
    await manager.leave("guild-1");

    expect(connected).toHaveBeenCalledTimes(1);
    expect(destroyed).toHaveBeenCalledTimes(1);
  });

  it("on disconnect retries rejoin, then destroys and emits disconnected", async () => {
    const logger = createLogger();
    const manager = new VoiceManager(createConfig({ reconnectAttempts: 2 }), logger);
    const disconnected = vi.fn();
    const destroyed = vi.fn();
    manager.on("disconnected", disconnected);
    manager.on("destroyed", destroyed);

    let readyCalls = 0;
    voiceMock.entersState.mockImplementation(
      async (connection: { transition: (s: string) => void }) => {
        readyCalls += 1;
        if (readyCalls === 1) {
          connection.transition(voiceMock.status.Ready);
          return connection;
        }
        throw new Error("reconnect failed");
      },
    );

    const connection = (await manager.join(joinParams())) as unknown as InstanceType<
      typeof voiceMock.MockVoiceConnection
    >;
    connection.transition(voiceMock.status.Disconnected);

    await vi.waitFor(() => {
      expect(connection.rejoin).toHaveBeenCalledTimes(2);
    });
    expect(disconnected).toHaveBeenCalledTimes(1);
    expect(destroyed).toHaveBeenCalledTimes(1);
    expect(manager.getConnection("guild-1")).toBeUndefined();
  });

  it("join() surfaces timeout/connection failures", async () => {
    const logger = createLogger();
    const manager = new VoiceManager(createConfig(), logger);

    voiceMock.entersState.mockRejectedValueOnce(new Error("join timeout"));

    await expect(manager.join(joinParams())).rejects.toThrow(/join timeout/i);
  });
});

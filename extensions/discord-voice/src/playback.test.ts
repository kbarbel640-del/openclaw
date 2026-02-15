import { describe, expect, it, vi, beforeEach } from "vitest";
import { PlaybackManager } from "./playback.js";

const voiceMock = vi.hoisted(() => {
  type Handler = (...args: unknown[]) => void;

  class MockAudioPlayer {
    private handlers = new Map<string, Set<Handler>>();
    play = vi.fn();
    stop = vi.fn(() => true);

    on(event: string, handler: Handler): this {
      if (!this.handlers.has(event)) {
        this.handlers.set(event, new Set());
      }
      this.handlers.get(event)?.add(handler);
      return this;
    }

    off(event: string, handler: Handler): this {
      this.handlers.get(event)?.delete(handler);
      return this;
    }

    removeAllListeners(event?: string): this {
      if (event) {
        this.handlers.delete(event);
      } else {
        this.handlers.clear();
      }
      return this;
    }

    emit(event: string, ...args: unknown[]): void {
      for (const handler of this.handlers.get(event) ?? []) {
        handler(...args);
      }
    }
  }

  class MockVoiceConnection {
    subscribe = vi.fn((player: unknown) => ({
      player,
      unsubscribe: vi.fn(),
    }));
  }

  const createAudioPlayer = vi.fn(() => new MockAudioPlayer());
  const createAudioResource = vi.fn((stream: unknown, options: unknown) => ({ stream, options }));

  return {
    AudioPlayerStatus: { Idle: "idle" },
    NoSubscriberBehavior: { Pause: "pause" },
    StreamType: { Arbitrary: "arbitrary" },
    MockAudioPlayer,
    MockVoiceConnection,
    createAudioPlayer,
    createAudioResource,
  };
});

vi.mock("@discordjs/voice", () => ({
  AudioPlayerStatus: voiceMock.AudioPlayerStatus,
  NoSubscriberBehavior: voiceMock.NoSubscriberBehavior,
  StreamType: voiceMock.StreamType,
  createAudioPlayer: voiceMock.createAudioPlayer,
  createAudioResource: voiceMock.createAudioResource,
}));

const createLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

beforeEach(() => {
  voiceMock.createAudioPlayer.mockClear();
  voiceMock.createAudioResource.mockClear();
});

describe("PlaybackManager", () => {
  it("attachToConnection creates player and subscribes", () => {
    const manager = new PlaybackManager(createLogger());
    const connection = new voiceMock.MockVoiceConnection();

    manager.attachToConnection("guild-1", connection as never);

    expect(voiceMock.createAudioPlayer).toHaveBeenCalledWith({
      behaviors: { noSubscriber: voiceMock.NoSubscriberBehavior.Pause },
    });
    const player = voiceMock.createAudioPlayer.mock.results[0]?.value;
    expect(connection.subscribe).toHaveBeenCalledWith(player);
  });

  it("play queues audio and starts playback", async () => {
    const manager = new PlaybackManager(createLogger());
    const connection = new voiceMock.MockVoiceConnection();
    manager.attachToConnection("guild-1", connection as never);

    const audio = Buffer.from("audio-1");
    await manager.play("guild-1", audio);

    const player = voiceMock.createAudioPlayer.mock.results[0]?.value;
    expect(voiceMock.createAudioResource).toHaveBeenCalledWith(expect.anything(), {
      inputType: voiceMock.StreamType.Arbitrary,
    });
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(manager.isPlaying("guild-1")).toBe(true);
  });

  it("queue processes in order when player becomes idle", async () => {
    const manager = new PlaybackManager(createLogger());
    const connection = new voiceMock.MockVoiceConnection();
    manager.attachToConnection("guild-1", connection as never);

    const first = Buffer.from("first");
    const second = Buffer.from("second");
    await manager.play("guild-1", first);
    await manager.play("guild-1", second);

    const player = voiceMock.createAudioPlayer.mock.results[0]?.value;
    expect(player.play).toHaveBeenCalledTimes(1);

    player.emit(voiceMock.AudioPlayerStatus.Idle);

    expect(player.play).toHaveBeenCalledTimes(2);
    expect(voiceMock.createAudioResource).toHaveBeenCalledTimes(2);
  });

  it("stop clears queue and stops current playback", async () => {
    const manager = new PlaybackManager(createLogger());
    const connection = new voiceMock.MockVoiceConnection();
    manager.attachToConnection("guild-1", connection as never);

    const player = voiceMock.createAudioPlayer.mock.results[0]?.value;
    await manager.play("guild-1", Buffer.from("first"));
    await manager.play("guild-1", Buffer.from("second"));

    manager.stop("guild-1");
    expect(player.stop).toHaveBeenCalledWith(true);
    expect(manager.isPlaying("guild-1")).toBe(false);

    player.emit(voiceMock.AudioPlayerStatus.Idle);
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it("isPlaying returns correct state", async () => {
    const manager = new PlaybackManager(createLogger());
    const connection = new voiceMock.MockVoiceConnection();
    manager.attachToConnection("guild-1", connection as never);
    const player = voiceMock.createAudioPlayer.mock.results[0]?.value;

    expect(manager.isPlaying("guild-1")).toBe(false);
    await manager.play("guild-1", Buffer.from("audio"));
    expect(manager.isPlaying("guild-1")).toBe(true);

    player.emit(voiceMock.AudioPlayerStatus.Idle);
    expect(manager.isPlaying("guild-1")).toBe(false);
  });

  it("multiple guilds have independent players", async () => {
    const manager = new PlaybackManager(createLogger());
    const one = new voiceMock.MockVoiceConnection();
    const two = new voiceMock.MockVoiceConnection();
    manager.attachToConnection("guild-1", one as never);
    manager.attachToConnection("guild-2", two as never);

    const playerOne = voiceMock.createAudioPlayer.mock.results[0]?.value;
    const playerTwo = voiceMock.createAudioPlayer.mock.results[1]?.value;

    await manager.play("guild-1", Buffer.from("guild-1-audio"));
    await manager.play("guild-2", Buffer.from("guild-2-audio"));

    expect(playerOne.play).toHaveBeenCalledTimes(1);
    expect(playerTwo.play).toHaveBeenCalledTimes(1);

    manager.stop("guild-1");
    expect(manager.isPlaying("guild-1")).toBe(false);
    expect(manager.isPlaying("guild-2")).toBe(true);
  });

  it("destroy cleans up all players", async () => {
    const manager = new PlaybackManager(createLogger());
    manager.attachToConnection("guild-1", new voiceMock.MockVoiceConnection() as never);
    manager.attachToConnection("guild-2", new voiceMock.MockVoiceConnection() as never);

    const playerOne = voiceMock.createAudioPlayer.mock.results[0]?.value;
    const playerTwo = voiceMock.createAudioPlayer.mock.results[1]?.value;

    await manager.play("guild-1", Buffer.from("one"));
    await manager.play("guild-2", Buffer.from("two"));

    manager.destroy();

    expect(playerOne.stop).toHaveBeenCalledWith(true);
    expect(playerTwo.stop).toHaveBeenCalledWith(true);
    expect(manager.isPlaying("guild-1")).toBe(false);
    expect(manager.isPlaying("guild-2")).toBe(false);
  });
});

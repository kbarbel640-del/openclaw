import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  createAudioPlayer,
  createAudioResource,
  type AudioPlayer,
  type PlayerSubscription,
  type VoiceConnection,
} from "@discordjs/voice";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import type { LoggerLike } from "./types.js";

type GuildPlayerState = {
  player: AudioPlayer;
  queue: Buffer[];
  playing: boolean;
  subscription?: PlayerSubscription;
};

export class PlaybackManager extends EventEmitter {
  private players: Map<string, GuildPlayerState>;
  private logger: LoggerLike;

  constructor(logger: LoggerLike) {
    super();
    this.players = new Map();
    this.logger = logger;
  }

  // Attach player to a voice connection
  attachToConnection(guildId: string, connection: VoiceConnection): void {
    const existing = this.players.get(guildId);
    if (existing) {
      existing.queue.length = 0;
      existing.playing = false;
      existing.player.stop(true);
      existing.subscription?.unsubscribe();
      existing.player.removeAllListeners();
    }

    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
      },
    });

    const state: GuildPlayerState = {
      player,
      queue: [],
      playing: false,
      subscription: connection.subscribe(player),
    };

    player.on(AudioPlayerStatus.Idle, () => {
      this.handleIdle(guildId);
    });

    player.on("error", (error: unknown) => {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Playback error in guild ${guildId}: ${reason}`);
      this.stop(guildId);
    });

    this.players.set(guildId, state);
    if (!state.subscription) {
      this.logger.warn(`No voice subscription created for guild ${guildId}`);
    }
  }

  // Queue and play audio
  async play(guildId: string, audio: Buffer, format = "mp3"): Promise<void> {
    const state = this.players.get(guildId);
    if (!state) {
      throw new Error(`No audio player attached for guild ${guildId}`);
    }

    if (audio.length === 0) {
      return;
    }

    state.queue.push(audio);
    this.logger.debug?.(
      `Queued audio for guild ${guildId} (${audio.length} bytes, format=${format})`,
    );

    if (!state.playing) {
      this.playNext(guildId);
    }
  }

  // Stop playback immediately (for interruption)
  stop(guildId: string): void {
    const state = this.players.get(guildId);
    if (!state) {
      return;
    }

    const hadPlayback = state.playing || state.queue.length > 0;
    state.queue.length = 0;
    state.playing = false;
    state.player.stop(true);

    if (hadPlayback) {
      this.emit("playbackEnd", { guildId });
    }
  }

  // Check if currently playing
  isPlaying(guildId: string): boolean {
    return this.players.get(guildId)?.playing ?? false;
  }

  // Cleanup
  destroy(): void {
    for (const state of this.players.values()) {
      state.queue.length = 0;
      state.playing = false;
      state.player.stop(true);
      state.subscription?.unsubscribe();
      state.player.removeAllListeners();
    }

    this.players.clear();
    this.removeAllListeners();
  }

  private playNext(guildId: string): void {
    const state = this.players.get(guildId);
    if (!state) {
      return;
    }

    const nextAudio = state.queue.shift();
    if (!nextAudio) {
      state.playing = false;
      return;
    }

    const resource = createAudioResource(Readable.from(nextAudio), {
      inputType: StreamType.Arbitrary,
    });

    state.playing = true;
    state.player.play(resource);
    this.emit("playbackStart", { guildId });
  }

  private handleIdle(guildId: string): void {
    const state = this.players.get(guildId);
    if (!state) {
      return;
    }

    const wasPlaying = state.playing;
    state.playing = false;

    if (state.queue.length > 0) {
      this.playNext(guildId);
      return;
    }

    if (wasPlaying) {
      this.emit("playbackEnd", { guildId });
    }
  }
}

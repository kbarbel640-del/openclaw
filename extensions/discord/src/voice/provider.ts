import { EndBehaviorType } from "@discordjs/voice";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import type { NormalizedEvent } from "../../../voice-call/src/types.js";
import type {
  VoiceChannelSession,
  VoiceJoinOptions,
  VoiceLeaveOptions,
  VoiceSpeakOptions,
  VoiceStatusResult,
  DiscordVoiceConfig,
  TranscriptEntry,
} from "./types.js";
import { AudioPipeline } from "./audio-pipeline.js";
import { DiscordVoiceConnectionManager } from "./connection.js";
import {
  createInitiatedEvent,
  createActiveEvent,
  createSpeechEvent,
  createSpeakingEvent,
  createSilenceEvent,
  createEndedEvent,
  createErrorEvent,
} from "./events.js";

type DiscordVoiceProviderEvents = {
  event: [event: NormalizedEvent];
  transcript: [session: VoiceChannelSession, entry: TranscriptEntry];
  audioComplete: [session: VoiceChannelSession, userId: string, pcmData: Buffer];
  error: [session: VoiceChannelSession, error: Error];
};

/**
 * Discord voice provider that wraps the connection manager and audio pipeline.
 *
 * Emits NormalizedEvent objects for each voice lifecycle event, so the rest of
 * the system can consume Discord voice sessions alongside telephony calls.
 */
export class DiscordVoiceProvider extends EventEmitter<DiscordVoiceProviderEvents> {
  private connectionManager: DiscordVoiceConnectionManager;
  private pipelines: Map<string, AudioPipeline> = new Map();
  private config: DiscordVoiceConfig;
  private listeningGuilds: Set<string> = new Set();
  /** Track which users already have an active opus subscription to avoid duplicates. */
  private subscribedUsers: Map<string, Set<string>> = new Map();

  constructor(config: DiscordVoiceConfig) {
    super();
    this.config = config;
    this.connectionManager = new DiscordVoiceConnectionManager();
    this.setupConnectionEvents();
  }

  /**
   * Join a Discord voice channel. Creates an audio pipeline for the session
   * and begins emitting NormalizedEvents.
   */
  async joinChannel(options: VoiceJoinOptions): Promise<VoiceChannelSession> {
    const session = await this.connectionManager.joinChannel(options);

    const pipeline = new AudioPipeline(this.config.audioConfig);
    this.pipelines.set(session.guildId, pipeline);

    this.emit("event", createInitiatedEvent(session));
    this.emit("event", createActiveEvent(session));

    console.log(
      `[voice-provider] joinChannel: transcriptionEnabled=${this.config.transcriptionEnabled}`,
    );
    if (this.config.transcriptionEnabled) {
      this.setupIncomingAudio(session, pipeline);
      console.log(`[voice-provider] setupIncomingAudio complete for guild ${session.guildId}`);
    }

    return session;
  }

  /**
   * Leave a Discord voice channel. Tears down the audio pipeline and emits
   * an ended event.
   */
  async leaveChannel(options: VoiceLeaveOptions): Promise<void> {
    const session = this.connectionManager.getSession(options.guildId);

    this.listeningGuilds.delete(options.guildId);
    this.destroyPipeline(options.guildId);
    await this.connectionManager.leaveChannel(options);

    if (session) {
      const reason = options.reason === "user" ? "hangup-user" : "hangup-bot";
      this.emit("event", createEndedEvent(session, reason));
    }
  }

  /**
   * Speak text in a voice channel by converting it to audio via the outgoing
   * audio pipeline. Records the utterance in the session transcript.
   */
  async speak(options: VoiceSpeakOptions & { audioBuffer?: Buffer }): Promise<void> {
    const session = this.connectionManager.getSession(options.guildId);
    if (!session) {
      throw new Error(`No active voice session for guild ${options.guildId}`);
    }

    if (!session.player || !session.connection) {
      throw new Error("Voice session is not connected");
    }

    const pipeline = this.pipelines.get(options.guildId);
    if (!pipeline) {
      throw new Error("Audio pipeline not initialized for this session");
    }

    if (options.interrupt && session.player) {
      session.player.stop();
    }

    const entry: TranscriptEntry = {
      timestamp: Date.now(),
      speaker: "bot",
      text: options.text,
      isFinal: true,
    };
    session.transcript.push(entry);
    this.emit("transcript", session, entry);
    this.emit("event", createSpeakingEvent(session, options.text));

    // If a pre-rendered audio buffer is provided (from TTS), play it directly
    if (options.audioBuffer) {
      const pcmStream = Readable.from(options.audioBuffer);
      const resource = pipeline.getOutgoing().createAudioResourceFromPcm(pcmStream);
      session.player.play(resource);
    }
  }

  /**
   * Start listening for user speech in a guild's voice channel.
   * The incoming audio handler will buffer audio and emit transcript events
   * when silence is detected.
   */
  async startListening(guildId: string): Promise<void> {
    const session = this.connectionManager.getSession(guildId);
    if (!session) {
      throw new Error(`No active voice session for guild ${guildId}`);
    }

    this.listeningGuilds.add(guildId);
    session.state = "listening";
  }

  /**
   * Stop listening for user speech. Flushes any buffered audio first,
   * which triggers audioComplete events BEFORE listeningGuilds is cleared.
   */
  async stopListening(guildId: string): Promise<void> {
    const session = this.connectionManager.getSession(guildId);
    if (!session) return;

    // Flush BEFORE clearing listeningGuilds, so audioComplete events
    // emitted during the flush are still processed.
    const pipeline = this.pipelines.get(guildId);
    if (pipeline) {
      console.log(
        `[voice-provider] stopListening: flushing audio for ${session.users.size} tracked user(s)`,
      );
      for (const userId of session.users.keys()) {
        pipeline.getIncoming().flushUserAudio(userId);
      }
    }

    this.listeningGuilds.delete(guildId);
    if (session.state === "listening") {
      session.state = "idle";
    }
  }

  /**
   * Get the status of a voice session.
   */
  getStatus(guildId?: string): VoiceStatusResult | VoiceStatusResult[] {
    if (guildId) {
      return this.buildStatus(guildId);
    }
    return this.connectionManager.getAllSessions().map((s) => this.buildStatus(s.guildId));
  }

  /**
   * Get the active session for a guild.
   */
  getSession(guildId: string): VoiceChannelSession | undefined {
    return this.connectionManager.getSession(guildId);
  }

  /**
   * Get all active sessions.
   */
  getAllSessions(): VoiceChannelSession[] {
    return this.connectionManager.getAllSessions();
  }

  /**
   * Forward incoming VOICE_STATE_UPDATE / VOICE_SERVER_UPDATE gateway
   * payloads to the @discordjs/voice adapter so the voice handshake
   * can complete.
   */
  onGatewayVoicePayload(guildId: string, payload: Record<string, unknown>): void {
    this.connectionManager.onGatewayVoicePayload(guildId, payload);
  }

  /**
   * Clean up all sessions and pipelines.
   */
  destroy(): void {
    for (const guildId of this.pipelines.keys()) {
      this.destroyPipeline(guildId);
    }
    this.listeningGuilds.clear();
    this.connectionManager.destroy();
    this.removeAllListeners();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private setupConnectionEvents(): void {
    this.connectionManager.on("error", (session, error) => {
      this.emit("error", session, error);
      this.emit("event", createErrorEvent(session, error.message, true));
    });

    this.connectionManager.on("userSpeaking", (session, userId, speaking) => {
      if (!speaking) return;
      if (!this.listeningGuilds.has(session.guildId)) {
        console.log(
          `[voice-provider] userSpeaking: guild ${session.guildId} not in listeningGuilds (set: ${[...this.listeningGuilds].join(",")})`,
        );
        return;
      }

      const pipeline = this.pipelines.get(session.guildId);
      if (!pipeline) {
        console.log(`[voice-provider] userSpeaking: no pipeline for guild ${session.guildId}`);
        return;
      }

      // When a user starts speaking, subscribe to their audio stream
      this.subscribeToUserAudio(session, userId, pipeline);
    });

    this.connectionManager.on("destroy", (session) => {
      this.destroyPipeline(session.guildId);
      this.listeningGuilds.delete(session.guildId);
    });
  }

  private setupIncomingAudio(session: VoiceChannelSession, pipeline: AudioPipeline): void {
    const incoming = pipeline.getIncoming();

    incoming.on("audioComplete", ({ userId, data }: { userId: string; data: Buffer }) => {
      console.log(
        `[voice-provider] audioComplete from user ${userId}: ${data.length} bytes (${(data.length / (48000 * 2 * 2)).toFixed(1)}s of audio)`,
      );
      if (!this.listeningGuilds.has(session.guildId)) {
        console.log(
          `[voice-provider] audioComplete: guild ${session.guildId} not in listeningGuilds, skipping`,
        );
        return;
      }

      const user = session.users.get(userId);
      const entry: TranscriptEntry = {
        timestamp: Date.now(),
        speaker: "user",
        speakerId: userId,
        speakerName: user?.username,
        text: `[audio:${data.length} bytes]`,
        isFinal: false,
      };
      session.transcript.push(entry);
      this.emit("transcript", session, entry);
      this.emit("audioComplete", session, userId, data);
      this.emit("event", createSpeechEvent(session, entry.text, false));
    });

    incoming.on("silence", ({ userId, durationMs }: { userId?: string; durationMs?: number }) => {
      if (durationMs && durationMs >= this.config.silenceTimeoutMs) {
        this.emit("event", createSilenceEvent(session, durationMs));
      }
    });
  }

  /**
   * Subscribe to a specific user's audio stream from the voice connection
   * receiver. Feeds Opus chunks into the incoming audio handler.
   *
   * Guards against duplicate subscriptions — each user is subscribed at most
   * once per guild session.
   */
  private subscribeToUserAudio(
    session: VoiceChannelSession,
    userId: string,
    pipeline: AudioPipeline,
  ): void {
    if (!session.connection) return;

    // Prevent duplicate subscriptions (speaking events fire rapidly)
    let guildSubs = this.subscribedUsers.get(session.guildId);
    if (!guildSubs) {
      guildSubs = new Set();
      this.subscribedUsers.set(session.guildId, guildSubs);
    }
    if (guildSubs.has(userId)) return;
    guildSubs.add(userId);

    console.log(
      `[voice-provider] subscribing to audio for user ${userId} in guild ${session.guildId}`,
    );

    const receiver = session.connection.receiver;
    // Use Manual end behavior — the stream stays alive for the lifetime of
    // the voice connection. The audio pipeline's own 2-second silence timer
    // handles flushing completed utterances.
    const opusStream = receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.Manual },
    });

    let chunkCount = 0;
    opusStream.on("data", (chunk: Buffer) => {
      chunkCount++;
      if (chunkCount === 1 || chunkCount % 100 === 0) {
        console.log(
          `[voice-provider] opus chunk #${chunkCount} for user ${userId} (${chunk.length} bytes)`,
        );
      }
      pipeline.getIncoming().handleAudioChunk(userId, chunk);
    });

    opusStream.on("end", () => {
      console.log(
        `[voice-provider] opus stream ended for user ${userId} after ${chunkCount} chunks`,
      );
      pipeline.getIncoming().flushUserAudio(userId);
      // Allow re-subscription if the user speaks again
      guildSubs!.delete(userId);
    });

    opusStream.on("error", (err) => {
      console.error(`[voice-provider] opus stream error for user ${userId}:`, err);
      guildSubs!.delete(userId);
    });
  }

  private destroyPipeline(guildId: string): void {
    const pipeline = this.pipelines.get(guildId);
    if (pipeline) {
      pipeline.destroy();
      this.pipelines.delete(guildId);
    }
    this.subscribedUsers.delete(guildId);
  }

  private buildStatus(guildId: string): VoiceStatusResult {
    const session = this.connectionManager.getSession(guildId);
    if (!session) {
      return {
        connected: false,
        guildId,
        state: "disconnected",
        sessionState: "idle",
        users: [],
        transcriptLength: 0,
      };
    }

    return {
      connected: true,
      guildId: session.guildId,
      channelId: session.channelId,
      channelName: session.channelName,
      guildName: session.guildName,
      state: this.connectionManager.getConnectionState(session),
      sessionState: session.state,
      users: Array.from(session.users.values()),
      duration: Date.now() - session.startedAt,
      transcriptLength: session.transcript.length,
    };
  }
}

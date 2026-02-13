import { randomUUID } from "node:crypto";
import type { DiscordVoiceProvider } from "./provider.js";
import type { SpeakerTranscription, VoiceTranscriptionSession } from "./types.js";
import type { DiscordVoiceStateListener } from "./voice-state-listener.js";
/**
 * Central coordinator wiring voice connection, transcription, thread
 * posting, and summarization together.
 *
 * - On userJoined: auto-join voice channel, start listening
 * - On audioComplete: transcribe via Groq, post to thread
 * - On userLeft + only bot remains: summarize, post summary, leave
 */
import { fetchMemberInfoDiscord } from "../../../../src/discord/send.guild.js";
import { resolveGroqApiKey, type DiscordVoiceConfig } from "./config.js";
import { summarizeVoiceSession } from "./summarization-service.js";
import { VoiceThreadManager } from "./thread-manager.js";
import { transcribeVoiceAudio } from "./transcription-service.js";

export interface SessionOrchestratorConfig {
  voiceConfig: DiscordVoiceConfig;
  provider: DiscordVoiceProvider;
  voiceStateListener: DiscordVoiceStateListener;
  accountId?: string;
  botUserId?: string;
}

/** Session key: "guildId:channelId" */
function sessionKey(guildId: string, channelId: string): string {
  return `${guildId}:${channelId}`;
}

export class VoiceSessionOrchestrator {
  private sessions = new Map<string, VoiceTranscriptionSession>();
  private threadManagers = new Map<string, VoiceThreadManager>();
  private config: DiscordVoiceConfig;
  private provider: DiscordVoiceProvider;
  private voiceStateListener: DiscordVoiceStateListener;
  private accountId: string | undefined;
  private botUserId: string | undefined;
  private groqApiKey: string | undefined;

  constructor(params: SessionOrchestratorConfig) {
    this.config = params.voiceConfig;
    this.provider = params.provider;
    this.voiceStateListener = params.voiceStateListener;
    this.accountId = params.accountId;
    this.botUserId = params.botUserId;
    this.groqApiKey = resolveGroqApiKey(this.config);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Wire audioComplete from provider
    this.provider.on("audioComplete", (session, userId, pcmData) => {
      void this.handleAudioComplete(session.guildId, session.channelId, userId, pcmData);
    });
  }

  /**
   * Called by the voice state listener when a user joins a voice channel.
   */
  async onUserJoined(guildId: string, userId: string, channelId: string): Promise<void> {
    console.log(
      `[orchestrator] onUserJoined guildId=${guildId} userId=${userId} channelId=${channelId} autoJoin=${this.config.autoJoin}`,
    );
    if (!this.config.autoJoin) return;

    // Check guild restriction
    if (
      this.config.autoJoinGuilds &&
      this.config.autoJoinGuilds.length > 0 &&
      !this.config.autoJoinGuilds.includes(guildId)
    ) {
      console.log(
        `[orchestrator] guild ${guildId} not in autoJoinGuilds: ${JSON.stringify(this.config.autoJoinGuilds)}`,
      );
      return;
    }

    const key = sessionKey(guildId, channelId);
    console.log(`[orchestrator] session key=${key}, existing=${this.sessions.has(key)}`);

    // Resolve the user's display name
    const userName = await this.resolveUserName(guildId, userId);
    console.log(`[orchestrator] resolved userName=${userName}`);

    // If we already have a session, just track the user
    if (this.sessions.has(key)) {
      const session = this.sessions.get(key)!;
      session.userNames.set(userId, userName);
      return;
    }

    // Create a new transcription session
    const session: VoiceTranscriptionSession = {
      sessionId: randomUUID(),
      guildId,
      channelId,
      transcriptions: [],
      userNames: new Map([[userId, userName]]),
      startedAt: Date.now(),
    };
    this.sessions.set(key, session);

    // Create thread manager (lazy thread creation)
    if (this.config.transcriptionChannelId) {
      const threadManager = new VoiceThreadManager({
        channelId: this.config.transcriptionChannelId,
        guildId,
        restOpts: {
          token: undefined,
          accountId: this.accountId,
        },
      });
      this.threadManagers.set(key, threadManager);
    }

    // Join the voice channel
    console.log(`[orchestrator] joining voice channel ${channelId} in guild ${guildId}`);
    try {
      await this.provider.joinChannel({ guildId, channelId, selfDeaf: false });
      console.log(`[orchestrator] joinChannel succeeded, starting listening`);
      await this.provider.startListening(guildId);
      console.log(`[orchestrator] startListening succeeded`);
    } catch (err) {
      console.error(`[orchestrator] joinChannel/startListening failed:`, err);
      // Clean up on failure
      this.sessions.delete(key);
      this.threadManagers.delete(key);
    }
  }

  /**
   * Called by the voice state listener when a user leaves a voice channel.
   */
  async onUserLeft(guildId: string, userId: string, channelId: string): Promise<void> {
    const key = sessionKey(guildId, channelId);
    const session = this.sessions.get(key);
    if (!session) return;

    // Check if only the bot remains
    const usersInChannel = this.voiceStateListener.getUsersInChannel(guildId, channelId);
    if (usersInChannel.length > 0) {
      // Other humans still present
      return;
    }

    // All humans have left — summarize and leave
    await this.endSession(key);
  }

  /**
   * Handle completed audio from a user: transcribe and post to thread.
   */
  private async handleAudioComplete(
    guildId: string,
    channelId: string,
    userId: string,
    pcmData: Buffer,
  ): Promise<void> {
    if (!this.groqApiKey) return;

    const key = sessionKey(guildId, channelId);
    const session = this.sessions.get(key);
    if (!session) return;

    const userName = session.userNames.get(userId) ?? userId;

    const result = await transcribeVoiceAudio({
      userId,
      userName,
      pcmData,
      apiKey: this.groqApiKey,
      model: this.config.whisperModel,
    });

    if (!result) return;

    const transcription: SpeakerTranscription = {
      userId: result.userId,
      userName: result.userName,
      text: result.text,
      timestamp: Date.now(),
    };
    session.transcriptions.push(transcription);

    // Post to thread
    const threadManager = this.threadManagers.get(key);
    if (threadManager) {
      await threadManager.postTranscription(transcription);
      // Store the thread ID in the session once created
      const threadId = threadManager.getThreadId();
      if (threadId && !session.threadId) {
        session.threadId = threadId;
      }
    }
  }

  /**
   * End a session: summarize, post to thread, leave channel.
   */
  private async endSession(key: string): Promise<void> {
    const session = this.sessions.get(key);
    if (!session) return;

    const threadManager = this.threadManagers.get(key);
    const durationMs = Date.now() - session.startedAt;

    // Summarize if we have transcriptions
    if (this.groqApiKey && session.transcriptions.length > 0 && threadManager) {
      const summaryResult = await summarizeVoiceSession({
        transcriptions: session.transcriptions,
        apiKey: this.groqApiKey,
        model: this.config.summarizationModel,
      });

      if (summaryResult) {
        await threadManager.postSummary(summaryResult.formatted);
      }

      await threadManager.postSessionEnd(durationMs);
    }

    // Leave the voice channel
    try {
      await this.provider.leaveChannel({
        guildId: session.guildId,
        reason: "bot",
      });
    } catch {
      // Ignore leave errors
    }

    // Clean up
    this.sessions.delete(key);
    this.threadManagers.delete(key);
  }

  /**
   * Resolve a user's display name via the Discord API.
   */
  private async resolveUserName(guildId: string, userId: string): Promise<string> {
    try {
      const member = await fetchMemberInfoDiscord(guildId, userId, {
        accountId: this.accountId,
      });
      return member.nick ?? member.user?.global_name ?? member.user?.username ?? userId;
    } catch {
      return userId;
    }
  }

  destroy(): void {
    // End all active sessions without summarization
    for (const key of this.sessions.keys()) {
      const session = this.sessions.get(key)!;
      void this.provider.leaveChannel({ guildId: session.guildId, reason: "bot" }).catch(() => {});
    }
    this.sessions.clear();
    this.threadManagers.clear();
  }
}

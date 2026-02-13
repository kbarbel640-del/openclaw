import type { GatewayVoiceStateUpdateDispatchData } from "discord-api-types/v10";
/**
 * Gateway listener for VOICE_STATE_UPDATE events.
 * Tracks voice channel membership and emits join/leave callbacks.
 *
 * Extends VoiceStateUpdateListener from @buape/carbon, following the same
 * pattern as DiscordPresenceListener in src/discord/monitor/listeners.ts.
 */
import { VoiceStateUpdateListener, type Client } from "@buape/carbon";

export interface VoiceStateCallbacks {
  onUserJoined: (guildId: string, userId: string, channelId: string) => void;
  onUserLeft: (guildId: string, userId: string, channelId: string) => void;
}

type VoiceStateUpdateEvent = Parameters<VoiceStateUpdateListener["handle"]>[0];

/**
 * Carbon gateway listener that tracks which users are in which voice channels
 * per guild and invokes callbacks on join/leave transitions.
 */
export class DiscordVoiceStateListener extends VoiceStateUpdateListener {
  /** guildId -> Map<userId, channelId> */
  private voiceStates = new Map<string, Map<string, string>>();
  private botUserId: string | undefined;
  private callbacks: VoiceStateCallbacks;

  constructor(params: { botUserId?: string; callbacks: VoiceStateCallbacks }) {
    super();
    this.botUserId = params.botUserId;
    this.callbacks = params.callbacks;
  }

  /** Set the bot user ID after construction (resolved at gateway login time). */
  setBotUserId(id: string): void {
    this.botUserId = id;
  }

  /**
   * Carbon listener entry point. Called by Carbon's dispatch system
   * when a VOICE_STATE_UPDATE event is received.
   */
  async handle(data: VoiceStateUpdateEvent, _client: Client): Promise<void> {
    try {
      console.log(
        `[voice-listener] handle called, type=${this.type}, data.guild_id=${(data as Record<string, unknown>).guild_id}, data.user_id=${(data as Record<string, unknown>).user_id}, data.channel_id=${(data as Record<string, unknown>).channel_id}`,
      );
      this.processVoiceStateUpdate(data as GatewayVoiceStateUpdateDispatchData);
    } catch (err) {
      console.error(`[voice-listener] error:`, err);
    }
  }

  /**
   * Process a VOICE_STATE_UPDATE event.
   * Can also be called directly outside the Carbon listener system.
   */
  processVoiceStateUpdate(data: GatewayVoiceStateUpdateDispatchData): void {
    const guildId = data.guild_id;
    const userId = data.user_id;

    if (!guildId || !userId) return;

    // Ignore the bot's own state changes
    if (this.botUserId && userId === this.botUserId) return;

    if (!this.voiceStates.has(guildId)) {
      this.voiceStates.set(guildId, new Map());
    }
    const guildStates = this.voiceStates.get(guildId)!;
    const previousChannelId = guildStates.get(userId);
    const newChannelId = data.channel_id ?? undefined;

    if (previousChannelId === newChannelId) return;

    // User left a channel
    if (previousChannelId && !newChannelId) {
      guildStates.delete(userId);
      this.callbacks.onUserLeft(guildId, userId, previousChannelId);
      return;
    }

    // User joined a channel (wasn't in one before)
    if (!previousChannelId && newChannelId) {
      guildStates.set(userId, newChannelId);
      this.callbacks.onUserJoined(guildId, userId, newChannelId);
      return;
    }

    // User moved channels
    if (previousChannelId && newChannelId && previousChannelId !== newChannelId) {
      guildStates.set(userId, newChannelId);
      this.callbacks.onUserLeft(guildId, userId, previousChannelId);
      this.callbacks.onUserJoined(guildId, userId, newChannelId);
    }
  }

  /** Get all user IDs currently in a specific channel. */
  getUsersInChannel(guildId: string, channelId: string): string[] {
    const guildStates = this.voiceStates.get(guildId);
    if (!guildStates) return [];

    const users: string[] = [];
    for (const [userId, ch] of guildStates) {
      if (ch === channelId) {
        users.push(userId);
      }
    }
    return users;
  }

  /** Check if no human users are in the channel. */
  isOnlyBotInChannel(guildId: string, channelId: string): boolean {
    return this.getUsersInChannel(guildId, channelId).length === 0;
  }

  destroy(): void {
    this.voiceStates.clear();
  }
}

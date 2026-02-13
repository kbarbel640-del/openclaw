/**
 * Manages a Discord thread for a voice transcription session.
 * Lazily creates the thread on first transcription to avoid empty threads.
 */
import { ChannelType } from "discord-api-types/v10";
import { createThreadDiscord } from "../../../../src/discord/send.messages.js";
import { sendMessageDiscord } from "../../../../src/discord/send.outbound.js";

export interface ThreadManagerRestOpts {
  token?: string;
  accountId?: string;
}

export interface ThreadManagerConfig {
  /** Channel ID where threads will be created. */
  channelId: string;
  /** Guild ID (used in thread naming). */
  guildId: string;
  /** Discord REST opts for API calls. */
  restOpts: ThreadManagerRestOpts;
}

export class VoiceThreadManager {
  private threadId: string | undefined;
  private channelId: string;
  private guildId: string;
  private restOpts: ThreadManagerRestOpts;

  constructor(config: ThreadManagerConfig) {
    this.channelId = config.channelId;
    this.guildId = config.guildId;
    this.restOpts = config.restOpts;
  }

  getThreadId(): string | undefined {
    return this.threadId;
  }

  /**
   * Ensure the thread exists. Creates it lazily on first call.
   * Returns the thread ID or undefined if creation fails.
   */
  private async ensureThread(): Promise<string | undefined> {
    if (this.threadId) {
      return this.threadId;
    }

    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const dateStr = now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      console.log(`[thread-manager] creating thread in channel ${this.channelId}`);
      const thread = (await createThreadDiscord(
        this.channelId,
        {
          name: `Voice Transcript ${dateStr} ${timeStr}`,
          autoArchiveMinutes: 1440,
          type: ChannelType.PublicThread,
        },
        this.restOpts,
      )) as { id: string };

      this.threadId = thread.id;
      console.log(`[thread-manager] thread created: ${this.threadId}`);
      return this.threadId;
    } catch (err) {
      console.error(`[thread-manager] failed to create thread:`, err);
      return undefined;
    }
  }

  /**
   * Post a transcription entry to the thread.
   * Creates the thread if it doesn't exist yet.
   */
  async postTranscription(params: {
    userId: string;
    userName: string;
    text: string;
    timestamp: number;
  }): Promise<void> {
    try {
      const threadId = await this.ensureThread();
      if (!threadId) return;

      const time = new Date(params.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const message = `**${params.userName}** (${time}): ${params.text}`;
      console.log(
        `[thread-manager] posting transcription to thread ${threadId}: ${message.substring(0, 80)}...`,
      );
      await sendMessageDiscord(`channel:${threadId}`, message, this.restOpts);
      console.log(`[thread-manager] transcription posted successfully`);
    } catch (err) {
      console.error(`[thread-manager] failed to post transcription:`, err);
    }
  }

  /**
   * Post the final session summary to the thread.
   */
  async postSummary(markdownText: string): Promise<void> {
    try {
      const threadId = await this.ensureThread();
      if (!threadId) return;

      await sendMessageDiscord(
        `channel:${threadId}`,
        `---\n# Voice Session Summary\n\n${markdownText}`,
        this.restOpts,
      );
    } catch {
      // Errors are caught internally, never thrown
    }
  }

  /**
   * Post a session-end message with duration info.
   */
  async postSessionEnd(durationMs: number): Promise<void> {
    try {
      const threadId = await this.ensureThread();
      if (!threadId) return;

      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      const durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

      await sendMessageDiscord(
        `channel:${threadId}`,
        `---\n*Voice session ended. Duration: ${durationStr}*`,
        this.restOpts,
      );
    } catch {
      // Errors are caught internally, never thrown
    }
  }
}

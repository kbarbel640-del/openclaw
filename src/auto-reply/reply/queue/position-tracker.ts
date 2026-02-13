import type { FollowupRun } from "./types.js";
import type { SlackActionClientOpts } from "../../../slack/actions.js";
import { reactSlackMessage, removeSlackReaction } from "../../../slack/actions.js";
import { defaultRuntime } from "../../../runtime.js";

/**
 * Configuration for queue position indicators.
 */
export type QueuePositionConfig = {
  /** Enable queue position reactions. Default: true */
  enabled: boolean;
  /** Emoji to use for position indicators. Default: number emojis 1-9, then keycap */
  positionEmojis?: string[];
  /** Emoji to show when processing starts. Default: hourglass_flowing_sand */
  processingEmoji?: string;
  /** Maximum position to show (avoid clutter). Default: 9 */
  maxPosition?: number;
};

/**
 * Default position emojis (1️⃣, 2️⃣, etc.)
 */
const DEFAULT_POSITION_EMOJIS = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
];

const DEFAULT_PROCESSING_EMOJI = "hourglass_flowing_sand";

/**
 * Tracks queue position reactions for Slack messages.
 */
export class QueuePositionTracker {
  private config: Required<QueuePositionConfig>;
  /** Map of message key (channelId:messageId) to current position emoji */
  private messagePositions = new Map<string, string>();

  constructor(config: Partial<QueuePositionConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      positionEmojis: config.positionEmojis ?? DEFAULT_POSITION_EMOJIS,
      processingEmoji: config.processingEmoji ?? DEFAULT_PROCESSING_EMOJI,
      maxPosition: config.maxPosition ?? 9,
    };
  }

  /**
   * Creates a message key for tracking.
   */
  private getMessageKey(channelId: string, messageId: string): string {
    return `${channelId}:${messageId}`;
  }

  /**
   * Extracts Slack message metadata from a FollowupRun.
   */
  private extractSlackMetadata(
    run: FollowupRun,
  ): { channelId: string; messageId: string; accountId?: string } | null {
    // Only track Slack messages
    if (run.originatingChannel !== "slack") {
      return null;
    }

    const channelId = run.originatingTo;
    const messageId = run.messageId;

    if (!channelId || !messageId) {
      return null;
    }

    return {
      channelId,
      messageId,
      accountId: run.originatingAccountId,
    };
  }

  /**
   * Gets the emoji for a given queue position (1-indexed).
   */
  private getPositionEmoji(position: number): string | null {
    if (position < 1 || position > this.config.maxPosition) {
      return null;
    }
    // position is 1-indexed, array is 0-indexed
    return this.config.positionEmojis[position - 1] ?? null;
  }

  /**
   * Adds or updates a position reaction on a Slack message.
   */
  private async setPositionReaction(
    channelId: string,
    messageId: string,
    emoji: string,
    accountId?: string,
  ): Promise<void> {
    try {
      const opts: SlackActionClientOpts = accountId ? { accountId } : {};
      await reactSlackMessage(channelId, messageId, emoji, opts);
    } catch (err) {
      defaultRuntime.error?.(
        `Failed to add position reaction ${emoji} to ${channelId}:${messageId}: ${String(err)}`,
      );
    }
  }

  /**
   * Removes a position reaction from a Slack message.
   */
  private async removePositionReaction(
    channelId: string,
    messageId: string,
    emoji: string,
    accountId?: string,
  ): Promise<void> {
    try {
      const opts: SlackActionClientOpts = accountId ? { accountId } : {};
      await removeSlackReaction(channelId, messageId, emoji, opts);
    } catch (err) {
      defaultRuntime.error?.(
        `Failed to remove position reaction ${emoji} from ${channelId}:${messageId}: ${String(err)}`,
      );
    }
  }

  /**
   * Updates queue position reactions for all items in the queue.
   * Should be called after enqueuing or dequeuing items.
   */
  async updateQueuePositions(queueItems: FollowupRun[]): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Track which messages we've processed in this update
    const processedKeys = new Set<string>();

    // Update reactions for each item based on its position
    for (let i = 0; i < queueItems.length; i++) {
      const item = queueItems[i];
      const metadata = this.extractSlackMetadata(item);

      if (!metadata) {
        continue;
      }

      const { channelId, messageId, accountId } = metadata;
      const messageKey = this.getMessageKey(channelId, messageId);
      processedKeys.add(messageKey);

      const position = i + 1; // 1-indexed
      const newEmoji = this.getPositionEmoji(position);

      if (!newEmoji) {
        // Position is beyond max, remove any existing position emoji
        const oldEmoji = this.messagePositions.get(messageKey);
        if (oldEmoji) {
          await this.removePositionReaction(channelId, messageId, oldEmoji, accountId);
          this.messagePositions.delete(messageKey);
        }
        continue;
      }

      const oldEmoji = this.messagePositions.get(messageKey);

      if (oldEmoji === newEmoji) {
        // Position unchanged, no update needed
        continue;
      }

      // Remove old emoji if different
      if (oldEmoji && oldEmoji !== newEmoji) {
        await this.removePositionReaction(channelId, messageId, oldEmoji, accountId);
      }

      // Add new emoji
      await this.setPositionReaction(channelId, messageId, newEmoji, accountId);
      this.messagePositions.set(messageKey, newEmoji);
    }

    // Clean up any tracked messages that are no longer in the queue
    const keysToDelete: string[] = [];
    for (const [messageKey, emoji] of this.messagePositions.entries()) {
      if (!processedKeys.has(messageKey)) {
        keysToDelete.push(messageKey);
        // Remove the emoji from the message
        const [channelId, messageId] = messageKey.split(":");
        if (channelId && messageId) {
          await this.removePositionReaction(channelId, messageId, emoji);
        }
      }
    }

    for (const key of keysToDelete) {
      this.messagePositions.delete(key);
    }
  }

  /**
   * Marks a message as processing (replaces position with processing emoji).
   * Should be called when dequeuing an item for processing.
   */
  async markAsProcessing(run: FollowupRun): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const metadata = this.extractSlackMetadata(run);
    if (!metadata) {
      return;
    }

    const { channelId, messageId, accountId } = metadata;
    const messageKey = this.getMessageKey(channelId, messageId);
    const oldEmoji = this.messagePositions.get(messageKey);

    // Remove position emoji
    if (oldEmoji) {
      await this.removePositionReaction(channelId, messageId, oldEmoji, accountId);
      this.messagePositions.delete(messageKey);
    }

    // Add processing emoji
    await this.setPositionReaction(
      channelId,
      messageId,
      this.config.processingEmoji,
      accountId,
    );
  }

  /**
   * Removes processing indicator from a message.
   * Should be called after processing completes.
   */
  async removeProcessingIndicator(run: FollowupRun): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const metadata = this.extractSlackMetadata(run);
    if (!metadata) {
      return;
    }

    const { channelId, messageId, accountId } = metadata;
    await this.removePositionReaction(
      channelId,
      messageId,
      this.config.processingEmoji,
      accountId,
    );
  }

  /**
   * Clears all tracked position reactions.
   * Useful for cleanup on shutdown or queue clear.
   */
  async clearAll(): Promise<void> {
    const entries = Array.from(this.messagePositions.entries());
    this.messagePositions.clear();

    for (const [messageKey, emoji] of entries) {
      const [channelId, messageId] = messageKey.split(":");
      if (channelId && messageId) {
        await this.removePositionReaction(channelId, messageId, emoji);
      }
    }
  }
}

/**
 * Global queue position tracker instance.
 */
export const globalQueuePositionTracker = new QueuePositionTracker();

/**
 * Reaction State Machine for Feishu
 *
 * Provides multi-message state management for typing indicators.
 * Each message has an independent state lifecycle:
 *   QUEUED (⏳) → PROCESSING (⌨️) → COMPLETED (no emoji)
 *
 * This solves the problem of emoji residue (92.5% residue rate in production)
 * by using a Map-based state tracker instead of a single variable.
 *
 * @see https://github.com/openclaw/openclaw/issues/XXX
 */

import type { ClawdbotConfig } from "openclaw/plugin-sdk";
import { addReactionFeishu, removeReactionFeishu } from "./reactions.js";

// Emoji types for different states
// See: https://open.feishu.cn/document/server-docs/im-v1/message-reaction/emojis-introduce
export const ReactionEmoji = {
  /** Message is queued, waiting to be processed */
  QUEUED: "OK", // 👌 OK - "收到排队"
  /** Agent is actively processing/thinking */
  PROCESSING: "Typing", // ⌨️ Typing - "正在输入"
} as const;

export type ReactionEmojiType = (typeof ReactionEmoji)[keyof typeof ReactionEmoji];

/**
 * State of a single message in the reaction lifecycle
 */
export type MessageReactionState = {
  /** Unique message ID from Feishu */
  messageId: string;
  /** Chat/conversation ID */
  chatId: string;
  /** Current status in the lifecycle */
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "ERROR";
  /** Currently displayed emoji type (null if none) */
  currentEmoji: ReactionEmojiType | null;
  /** Reaction ID returned by Feishu API (needed for removal) */
  currentReactionId: string | null;
  /** Timestamp when state was created */
  createdAt: number;
  /** Account ID for multi-account support */
  accountId?: string;
};

/**
 * Configuration for ReactionStateManager
 */
export type ReactionStateManagerConfig = {
  cfg: ClawdbotConfig;
  /** Logger function for debugging */
  log?: (message: string) => void;
  /** Error logger function */
  error?: (message: string) => void;
  /** Timeout for stale state cleanup (default: 30 minutes) */
  staleTimeoutMs?: number;
};

/**
 * ReactionStateManager - Manages multiple message reaction states independently
 *
 * Key features:
 * 1. Each message has its own state (Map<messageId, State>)
 * 2. State transitions: QUEUED → PROCESSING → COMPLETED
 * 3. Reliable cleanup with try-finally pattern
 * 4. Stale state cleanup for gateway restarts
 */
export class ReactionStateManager {
  private states = new Map<string, MessageReactionState>();
  private config: ReactionStateManagerConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: ReactionStateManagerConfig) {
    this.config = config;
    // Start periodic cleanup for stale states
    this.startPeriodicCleanup();
  }

  /**
   * Sync the state of a single message to the SQLite persistent database.
   * COMPLETED and ERROR states result in row deletion.
   */
  private async updateDbState(state: MessageReactionState) {
    try {
      const { getDb } = await import("./history.js");
      const db = getDb();
      if (!db) return;

      if (state.status === "COMPLETED" || state.status === "ERROR") {
        const stmt = db.prepare(`DELETE FROM feishu_reaction_state WHERE message_id = ?`);
        stmt.run(state.messageId);
      } else {
        const stmt = db.prepare(`
          INSERT INTO feishu_reaction_state (message_id, chat_id, status, current_emoji, current_reaction_id, created_at, account_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(message_id) DO UPDATE SET
            status=excluded.status,
            current_emoji=excluded.current_emoji,
            current_reaction_id=excluded.current_reaction_id
        `);
        stmt.run(
          state.messageId,
          state.chatId,
          state.status,
          state.currentEmoji || null,
          state.currentReactionId || null,
          state.createdAt,
          state.accountId || null,
        );
      }
    } catch (e) {
      // Ignore sync errors gracefully
    }
  }

  /**
   * Sweeps SQLite for incomplete reaction states that survived a crash,
   * sends Feishu removal API calls for them, and cleans the DB.
   */
  async cleanupOrphanedReactions(): Promise<void> {
    const log = this.config.log ?? console.log;
    try {
      const { getDb } = await import("./history.js");
      const db = getDb();
      if (!db) return;

      const stmt = db.prepare(`SELECT * FROM feishu_reaction_state`);
      const rows = stmt.all() as any[];
      if (rows.length === 0) return;

      log(`[reaction-state] Reboot detected! Sweeping ${rows.length} orphaned db reactions...`);

      for (const row of rows) {
        if (row.current_reaction_id) {
          try {
            await removeReactionFeishu({
              cfg: this.config.cfg,
              messageId: row.message_id,
              reactionId: row.current_reaction_id,
              accountId: row.account_id,
            });
            log(`[reaction-state] Orphan swept: messageId=${row.message_id}`);
          } catch (err: any) {
            // Probably removed already by user or another process
          }
        }
        const delStmt = db.prepare(`DELETE FROM feishu_reaction_state WHERE message_id = ?`);
        delStmt.run(row.message_id);
      }
    } catch (e) {
      this.config.error?.(`[reaction-state] Orphan sweep failed: ${e}`);
    }
  }

  /**
   * Called when a message is received and enters the queue.
   * Adds a QUEUED emoji (☝️) to indicate "wait a moment".
   */
  async onMessageQueued(params: {
    messageId: string;
    chatId: string;
    accountId?: string;
  }): Promise<void> {
    const { messageId, chatId, accountId } = params;
    const log = this.config.log ?? console.log;

    // Check if we already have state for this message
    if (this.states.has(messageId)) {
      log(`[reaction-state] Message ${messageId} already tracked, skipping QUEUED`);
      return;
    }

    // Create initial state
    const state: MessageReactionState = {
      messageId,
      chatId,
      status: "QUEUED",
      currentEmoji: null,
      currentReactionId: null,
      createdAt: Date.now(),
      accountId,
    };
    this.states.set(messageId, state);

    // Add QUEUED emoji
    try {
      const result = await addReactionFeishu({
        cfg: this.config.cfg,
        messageId,
        emojiType: ReactionEmoji.QUEUED,
        accountId,
      });
      state.currentEmoji = ReactionEmoji.QUEUED;
      state.currentReactionId = result.reactionId;
      log(
        `[reaction-state] QUEUED emoji added: messageId=${messageId}, reactionId=${result.reactionId}`,
      );
    } catch (err) {
      // Non-critical, log and continue
      log(`[reaction-state] Failed to add QUEUED emoji for ${messageId}: ${err}`);
    }
    await this.updateDbState(state);
  }

  /**
   * Called when agent starts processing a message.
   * Transitions this message from QUEUED (👌) to PROCESSING (⌨️).
   *
   * Also transitions all OTHER currently QUEUED messages in the same chat,
   * because they have been collected as context for the agent's current thinking.
   * Messages that arrive AFTER this point will get their own QUEUED state.
   */
  async onProcessingStart(messageId: string): Promise<void> {
    const state = this.states.get(messageId);
    const log = this.config.log ?? console.log;

    if (!state) {
      log(`[reaction-state] No state found for ${messageId}, skipping onProcessingStart`);
      return;
    }

    // Collect this message + all other QUEUED messages in the same chat
    const toTransition: MessageReactionState[] = [];
    if (state.status === "QUEUED") {
      toTransition.push(state);
    }
    for (const [otherMsgId, otherState] of this.states) {
      if (
        otherMsgId !== messageId &&
        otherState.chatId === state.chatId &&
        otherState.status === "QUEUED"
      ) {
        toTransition.push(otherState);
      }
    }

    if (toTransition.length === 0) {
      return;
    }

    log(
      `[reaction-state] Transitioning ${toTransition.length} message(s) to PROCESSING in chat ${state.chatId}`,
    );

    // Run all transitions in parallel for speed
    await Promise.all(
      toTransition.map(async (s) => {
        if (s.currentReactionId) {
          try {
            await removeReactionFeishu({
              cfg: this.config.cfg,
              messageId: s.messageId,
              reactionId: s.currentReactionId,
              accountId: s.accountId,
            });
            log(`[reaction-state] Removed QUEUED emoji: messageId=${s.messageId}`);
          } catch (err) {
            log(`[reaction-state] Failed to remove QUEUED emoji for ${s.messageId}: ${err}`);
          }
        }

        try {
          const result = await addReactionFeishu({
            cfg: this.config.cfg,
            messageId: s.messageId,
            emojiType: ReactionEmoji.PROCESSING,
            accountId: s.accountId,
          });
          s.status = "PROCESSING";
          s.currentEmoji = ReactionEmoji.PROCESSING;
          s.currentReactionId = result.reactionId;
          log(`[reaction-state] PROCESSING emoji added: messageId=${s.messageId}`);
        } catch (err) {
          log(`[reaction-state] Failed to add PROCESSING emoji for ${s.messageId}: ${err}`);
          s.status = "PROCESSING";
          s.currentEmoji = null;
          s.currentReactionId = null;
        }
        await this.updateDbState(s);
      }),
    );
  }

  /**
   * Called when message processing is completed (success or error).
   * Removes any emoji and cleans up state.
   *
   * IMPORTANT: This should always be called in a finally block!
   */
  async onCompleted(messageId: string): Promise<void> {
    const state = this.states.get(messageId);
    const log = this.config.log ?? console.log;

    if (!state) {
      log(`[reaction-state] No state found for ${messageId}, nothing to cleanup`);
      return;
    }

    // Remove current emoji if any
    if (state.currentReactionId) {
      try {
        await removeReactionFeishu({
          cfg: this.config.cfg,
          messageId: state.messageId,
          reactionId: state.currentReactionId,
          accountId: state.accountId,
        });
        log(
          `[reaction-state] Removed ${state.currentEmoji} emoji on completion: messageId=${messageId}`,
        );
      } catch (err) {
        log(`[reaction-state] Failed to remove emoji on completion for ${messageId}: ${err}`);
      }
    }

    // Update state
    state.status = "COMPLETED";
    state.currentEmoji = null;
    state.currentReactionId = null;

    // Clear out of persistence instantly
    await this.updateDbState(state);

    // Schedule memory cleanup
    setTimeout(() => {
      this.states.delete(messageId);
      log(`[reaction-state] State fully dropped: messageId=${messageId}`);
    }, 60000); // 1 minute delay
  }

  /**
   * Get current state for a message (for debugging/monitoring)
   */
  getState(messageId: string): MessageReactionState | undefined {
    return this.states.get(messageId);
  }

  /**
   * Clear all reaction states for a specific chat/conversation that arrived BEFORE or AT
   * the same time as a given timestamp.
   * Useful when the agent sends a final reply, meaning all queued processing up to this point is done.
   * By using a cutoff timestamp, we prevent accidentally clearing the state of brand newly arrived
   * messages that get QUEUED while the current reply is being dispatched.
   */
  async clearForChat(chatId: string, cutoffTimestamp: number): Promise<void> {
    const log = this.config.log ?? console.log;
    let clearedCount = 0;

    for (const [messageId, state] of this.states) {
      // Only clean up states that belong to this chat AND were created before or at our cutoff time.
      // Emojis created AFTER this cutoff are part of the *next* turn of conversation, not the one
      // we are currently replying to.
      if (state.chatId === chatId && state.createdAt <= cutoffTimestamp) {
        await this.onCompleted(messageId);
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      log(
        `[reaction-state] Cleared ${clearedCount} merged states for chat ${chatId} (cutoff <= ${cutoffTimestamp})`,
      );
    }
  }

  /**
   * Clear only PROCESSING state reactions for a specific chat.
   * Called when the main message's reply is delivered —
   * merged messages that are in PROCESSING state should be cleaned up together,
   * but newly QUEUED messages (arriving after processing started) should be left alone.
   */
  async clearProcessingForChat(chatId: string): Promise<void> {
    const log = this.config.log ?? console.log;
    let clearedCount = 0;

    for (const [messageId, state] of this.states) {
      if (state.chatId === chatId && state.status === "PROCESSING") {
        await this.onCompleted(messageId);
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      log(`[reaction-state] Cleared ${clearedCount} PROCESSING states for chat ${chatId}`);
    }
  }

  /**
   * Check if there are any messages currently in PROCESSING state for a chat.
   * Used by bot.ts to decide whether a merged message's emoji should be kept
   * (waiting for the main message's reply to clean it up via clearProcessingForChat).
   */
  hasProcessingInChat(chatId: string): boolean {
    for (const [, state] of this.states) {
      if (state.chatId === chatId && state.status === "PROCESSING") {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if there's any active (QUEUED or PROCESSING) message in the chat
   * that was created BEFORE or AT the same time as `cutoffTimestamp`.
   * Optionally exclude a specific messageId from the check.
   */
  hasActiveInChat(chatId: string, cutoffTimestamp: number, excludeMessageId?: string): boolean {
    for (const [messageId, state] of this.states) {
      if (messageId === excludeMessageId) continue;
      if (
        state.chatId === chatId &&
        state.createdAt <= cutoffTimestamp &&
        (state.status === "QUEUED" || state.status === "PROCESSING")
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all active states (for debugging/monitoring)
   */
  getAllStates(): Map<string, MessageReactionState> {
    return new Map(this.states);
  }

  /**
   * Cleanup stale states (called periodically and on gateway restart)
   * Removes emojis for messages that have been stuck for too long.
   */
  async cleanupStaleStates(): Promise<void> {
    const log = this.config.log ?? console.log;
    const staleTimeoutMs = this.config.staleTimeoutMs ?? 30 * 60 * 1000; // 30 minutes
    const now = Date.now();

    for (const [messageId, state] of this.states) {
      if (now - state.createdAt > staleTimeoutMs) {
        log(
          `[reaction-state] Cleaning up stale state: messageId=${messageId}, age=${Math.round((now - state.createdAt) / 60000)}min`,
        );
        await this.onCompleted(messageId);
      }
    }
  }

  /**
   * Start periodic cleanup interval
   */
  private startPeriodicCleanup(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupStaleStates().catch((err) => {
          const error = this.config.error ?? console.error;
          error(`[reaction-state] Periodic cleanup failed: ${err}`);
        });
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Stop the manager and cleanup all states
   */
  async shutdown(): Promise<void> {
    const log = this.config.log ?? console.log;
    log(`[reaction-state] Shutting down, cleaning up ${this.states.size} states`);

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Cleanup all remaining states
    for (const messageId of this.states.keys()) {
      await this.onCompleted(messageId);
    }
  }
}

// Singleton instance for global access
let globalManager: ReactionStateManager | null = null;

/**
 * Get or create the global ReactionStateManager instance
 */
export function getReactionStateManager(config?: ReactionStateManagerConfig): ReactionStateManager {
  if (!globalManager && config) {
    globalManager = new ReactionStateManager(config);
  }
  if (!globalManager) {
    throw new Error("ReactionStateManager not initialized. Call with config first.");
  }
  return globalManager;
}

/**
 * Initialize the global ReactionStateManager
 */
export function initReactionStateManager(config: ReactionStateManagerConfig): ReactionStateManager {
  if (globalManager) {
    // Already initialized, just update config
    return globalManager;
  }
  globalManager = new ReactionStateManager(config);
  // Trigger cleanup for orphans on instance creation
  globalManager.cleanupOrphanedReactions().catch(() => {});
  return globalManager;
}

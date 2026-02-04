/**
 * Notion Outbox - Retry Queue for Failed Notion Writes
 *
 * When Notion writes fail (network issues, rate limits, etc.), operations
 * are queued locally for retry. This maintains Notion as the canonical
 * source while providing resilience against transient failures.
 *
 * Queue location: ~/.openclaw/outbox/notion/
 * Deduplication: By operation type + unique key (episodeId + transcriptHash)
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

// =============================================================================
// Types
// =============================================================================

export type OutboxOperationType =
  | "create_episode_pipeline"
  | "update_episode_pipeline"
  | "save_podcast_asset";

export interface OutboxEntry {
  /** Unique ID for this entry */
  id: string;
  /** Operation type */
  operationType: OutboxOperationType;
  /** Deduplication key (e.g., "E042:a1b2c3d4") */
  dedupeKey: string;
  /** Operation payload (serialized) */
  payload: unknown;
  /** When the operation was first queued */
  queuedAt: string;
  /** Number of retry attempts */
  retryCount: number;
  /** Last retry attempt timestamp */
  lastRetryAt?: string;
  /** Last error message */
  lastError?: string;
  /** Max retries before giving up (default: 10) */
  maxRetries: number;
}

export interface OutboxStatus {
  /** Number of pending operations */
  pendingCount: number;
  /** Pending operations by type */
  byType: Record<OutboxOperationType, number>;
  /** Oldest pending operation */
  oldestQueuedAt?: string;
  /** Recent errors */
  recentErrors: Array<{
    dedupeKey: string;
    error: string;
    retryCount: number;
  }>;
}

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_OUTBOX_DIR = join(homedir(), ".openclaw", "outbox", "notion");
const DEFAULT_MAX_RETRIES = 10;

// =============================================================================
// Outbox Manager
// =============================================================================

export class NotionOutbox {
  constructor(private readonly outboxDir: string = DEFAULT_OUTBOX_DIR) {
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!existsSync(this.outboxDir)) {
      mkdirSync(this.outboxDir, { recursive: true });
    }
  }

  /**
   * Queue an operation for retry.
   * Dedupes by operationType + dedupeKey.
   */
  queue(
    operationType: OutboxOperationType,
    dedupeKey: string,
    payload: unknown,
    error: string,
  ): void {
    // Check for existing entry with same dedupe key
    const existing = this.findByDedupeKey(dedupeKey);
    if (existing) {
      // Update existing entry
      existing.retryCount++;
      existing.lastRetryAt = new Date().toISOString();
      existing.lastError = error;
      existing.payload = payload; // Update with latest payload
      this.saveEntry(existing);
      return;
    }

    // Create new entry
    const entry: OutboxEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      operationType,
      dedupeKey,
      payload,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
      lastError: error,
      maxRetries: DEFAULT_MAX_RETRIES,
    };
    this.saveEntry(entry);
  }

  /**
   * Get all pending entries.
   */
  getPending(): OutboxEntry[] {
    const files = this.listEntryFiles();
    return files
      .map((f) => this.loadEntry(f))
      .filter((e): e is OutboxEntry => e !== null)
      .filter((e) => e.retryCount < e.maxRetries);
  }

  /**
   * Get entries that have exceeded max retries.
   */
  getFailed(): OutboxEntry[] {
    const files = this.listEntryFiles();
    return files
      .map((f) => this.loadEntry(f))
      .filter((e): e is OutboxEntry => e !== null)
      .filter((e) => e.retryCount >= e.maxRetries);
  }

  /**
   * Mark an entry as successfully processed (remove from queue).
   */
  markComplete(id: string): void {
    const filePath = join(this.outboxDir, `${id}.json`);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  /**
   * Update an entry after a failed retry.
   */
  recordRetryFailure(id: string, error: string): void {
    const entry = this.getById(id);
    if (entry) {
      entry.retryCount++;
      entry.lastRetryAt = new Date().toISOString();
      entry.lastError = error;
      this.saveEntry(entry);
    }
  }

  /**
   * Get outbox status summary.
   */
  getStatus(): OutboxStatus {
    const pending = this.getPending();
    const byType: Record<OutboxOperationType, number> = {
      create_episode_pipeline: 0,
      update_episode_pipeline: 0,
      save_podcast_asset: 0,
    };

    let oldestQueuedAt: string | undefined;
    const recentErrors: Array<{
      dedupeKey: string;
      error: string;
      retryCount: number;
    }> = [];

    for (const entry of pending) {
      byType[entry.operationType]++;
      if (!oldestQueuedAt || entry.queuedAt < oldestQueuedAt) {
        oldestQueuedAt = entry.queuedAt;
      }
      if (entry.lastError && recentErrors.length < 5) {
        recentErrors.push({
          dedupeKey: entry.dedupeKey,
          error: entry.lastError,
          retryCount: entry.retryCount,
        });
      }
    }

    return {
      pendingCount: pending.length,
      byType,
      oldestQueuedAt,
      recentErrors,
    };
  }

  /**
   * Clear all entries (for testing).
   */
  clear(): void {
    const files = this.listEntryFiles();
    for (const file of files) {
      unlinkSync(join(this.outboxDir, file));
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private listEntryFiles(): string[] {
    if (!existsSync(this.outboxDir)) {
      return [];
    }
    return readdirSync(this.outboxDir).filter((f) => f.endsWith(".json"));
  }

  private loadEntry(filename: string): OutboxEntry | null {
    try {
      const content = readFileSync(join(this.outboxDir, filename), "utf-8");
      return JSON.parse(content) as OutboxEntry;
    } catch {
      return null;
    }
  }

  private saveEntry(entry: OutboxEntry): void {
    const filePath = join(this.outboxDir, `${entry.id}.json`);
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    // Atomic write
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmp, JSON.stringify(entry, null, 2), "utf-8");
    renameSync(tmp, filePath);
  }

  private findByDedupeKey(dedupeKey: string): OutboxEntry | null {
    const files = this.listEntryFiles();
    for (const file of files) {
      const entry = this.loadEntry(file);
      if (entry?.dedupeKey === dedupeKey) {
        return entry;
      }
    }
    return null;
  }

  private getById(id: string): OutboxEntry | null {
    return this.loadEntry(`${id}.json`);
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a new NotionOutbox instance.
 */
export function createNotionOutbox(outboxDir?: string): NotionOutbox {
  return new NotionOutbox(outboxDir);
}

/**
 * Get the default outbox instance (singleton-ish).
 */
let defaultOutbox: NotionOutbox | null = null;
export function getDefaultNotionOutbox(): NotionOutbox {
  if (!defaultOutbox) {
    defaultOutbox = new NotionOutbox();
  }
  return defaultOutbox;
}

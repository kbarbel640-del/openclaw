/**
 * Execution store: tracks cron job occurrences for recovery replay.
 *
 * When the gateway is down, missed cron jobs are persisted here so they can be
 * replayed (with "Late — gateway was down..." prefix) when the gateway restarts.
 */

import fs from "node:fs";
import path from "node:path";
import { requireNodeSqlite } from "../memory/sqlite.js";

export type OccurrenceStatus = "scheduled" | "fired" | "missed" | "replayed" | "skipped_stale";

export type OccurrenceRecord = {
  jobId: string;
  scheduledAtMs: number;
  status: OccurrenceStatus;
  firedAtMs: number | null;
  reason: string | null;
};

export class ExecutionStore {
  private db;

  constructor(storePath: string) {
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const { DatabaseSync } = requireNodeSqlite();
    this.db = new DatabaseSync(storePath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS occurrences (
        job_id TEXT NOT NULL,
        scheduled_at_ms INTEGER NOT NULL,
        status TEXT NOT NULL,
        fired_at_ms INTEGER,
        reason TEXT,
        PRIMARY KEY (job_id, scheduled_at_ms)
      );
      CREATE INDEX IF NOT EXISTS idx_occurrences_status ON occurrences(status);
      CREATE INDEX IF NOT EXISTS idx_occurrences_scheduled ON occurrences(scheduled_at_ms);
    `);
  }

  /**
   * Record that a job is scheduled to run at a specific time.
   */
  upsertOccurrence(jobId: string, scheduledAtMs: number): void {
    const stmt = this.db.prepare(`
      INSERT INTO occurrences (job_id, scheduled_at_ms, status, fired_at_ms, reason)
      VALUES (?, ?, 'scheduled', NULL, NULL)
      ON CONFLICT(job_id, scheduled_at_ms) DO NOTHING
    `);
    stmt.run(jobId, scheduledAtMs);
  }

  /**
   * Mark an occurrence as fired.
   */
  markFired(jobId: string, scheduledAtMs: number, firedAtMs: number): void {
    const stmt = this.db.prepare(`
      UPDATE occurrences
      SET status = 'fired', fired_at_ms = ?
      WHERE job_id = ? AND scheduled_at_ms = ?
    `);
    stmt.run(firedAtMs, jobId, scheduledAtMs);
  }

  /**
   * Get all occurrences that were scheduled but not fired before nowMs.
   * These are candidates for recovery replay.
   */
  getMissedOccurrences(nowMs: number): OccurrenceRecord[] {
    const stmt = this.db.prepare(`
      SELECT job_id as jobId, scheduled_at_ms as scheduledAtMs, status, fired_at_ms as firedAtMs, reason
      FROM occurrences
      WHERE status = 'scheduled' AND scheduled_at_ms < ?
      ORDER BY scheduled_at_ms ASC
    `);
    return stmt.all(nowMs) as OccurrenceRecord[];
  }

  /**
   * Mark an occurrence as missed (scheduler was down).
   */
  markMissed(jobId: string, scheduledAtMs: number, reason: string): void {
    const stmt = this.db.prepare(`
      UPDATE occurrences
      SET status = 'missed', reason = ?
      WHERE job_id = ? AND scheduled_at_ms = ?
    `);
    stmt.run(reason, jobId, scheduledAtMs);
  }

  /**
   * Mark an occurrence as replayed (fired late).
   */
  markReplayed(jobId: string, scheduledAtMs: number, firedAtMs: number): void {
    const stmt = this.db.prepare(`
      UPDATE occurrences
      SET status = 'replayed', fired_at_ms = ?
      WHERE job_id = ? AND scheduled_at_ms = ?
    `);
    stmt.run(firedAtMs, jobId, scheduledAtMs);
  }

  /**
   * Mark an occurrence as skipped_stale (too old to replay).
   */
  markSkippedStale(jobId: string, scheduledAtMs: number, reason: string): void {
    const stmt = this.db.prepare(`
      UPDATE occurrences
      SET status = 'skipped_stale', reason = ?
      WHERE job_id = ? AND scheduled_at_ms = ?
    `);
    stmt.run(reason, jobId, scheduledAtMs);
  }

  /**
   * Clean up old occurrence records (older than cutoffMs).
   */
  cleanup(cutoffMs: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM occurrences WHERE scheduled_at_ms < ?
    `);
    stmt.run(cutoffMs);
  }

  close(): void {
    this.db.close();
  }
}

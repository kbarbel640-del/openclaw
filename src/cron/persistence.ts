/**
 * Cron job persistence layer for state recovery after restarts.
 * Ensures scheduled jobs survive application restarts without losing run state.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { CronJob, CronStoreFile } from "./types.js";

export interface CronJobRunState {
  jobId: string;
  lastRunAtMs?: number;
  lastStatus?: "ok" | "error" | "skipped";
  lastError?: string;
  lastDurationMs?: number;
  nextRunAtMs?: number;
  failureCount?: number;
}

export interface CronPersistenceFile {
  version: 1;
  storePath: string;
  savedAtMs: number;
  jobs: Map<string, CronJobRunState>;
}

/**
 * Save cron job run state to persistent storage.
 */
export async function persistCronRunState(
  storePath: string,
  jobs: CronJob[],
): Promise<void> {
  if (!storePath) {
    return;
  }

  try {
    const persistencePath = getPersistencePath(storePath);
    const persistenceDir = path.dirname(persistencePath);

    // Ensure directory exists
    await fs.mkdir(persistenceDir, { recursive: true });

    // Build run state map
    const jobStates = new Map<string, CronJobRunState>();
    for (const job of jobs) {
      if (!job.state) continue;

      jobStates.set(job.id, {
        jobId: job.id,
        lastRunAtMs: job.state.lastRunAtMs,
        lastStatus: job.state.lastStatus,
        lastError: job.state.lastError,
        lastDurationMs: job.state.lastDurationMs,
        nextRunAtMs: job.state.nextRunAtMs,
        failureCount: job.state.failureCount,
      });
    }

    // Write persistence file
    const persistenceData: CronPersistenceFile = {
      version: 1,
      storePath,
      savedAtMs: Date.now(),
      jobs: jobStates,
    };

    await fs.writeFile(
      persistencePath,
      JSON.stringify(persistenceData, (key, value) => {
        if (value instanceof Map) {
          return Object.fromEntries(value);
        }
        return value;
      }, 2),
      "utf-8",
    );
  } catch (error) {
    // Log but don't throw - persistence failure shouldn't break cron
    console.warn("Failed to persist cron state:", error);
  }
}

/**
 * Restore cron job run state from persistent storage.
 */
export async function restoreCronRunState(
  storePath: string,
  jobs: CronJob[],
): Promise<Map<string, Partial<CronJob["state"]>>> {
  if (!storePath) {
    return new Map();
  }

  try {
    const persistencePath = getPersistencePath(storePath);
    const content = await fs.readFile(persistencePath, "utf-8");
    const data = JSON.parse(content) as {
      version: number;
      storePath: string;
      savedAtMs: number;
      jobs: Record<string, CronJobRunState>;
    };

    if (data.version !== 1 || data.storePath !== storePath) {
      return new Map();
    }

    // Restore job states
    const stateMap = new Map<string, Partial<CronJob["state"]>>();
    for (const jobId in data.jobs) {
      const runState = data.jobs[jobId];
      stateMap.set(jobId, {
        lastRunAtMs: runState.lastRunAtMs,
        lastStatus: runState.lastStatus,
        lastError: runState.lastError,
        lastDurationMs: runState.lastDurationMs,
        nextRunAtMs: runState.nextRunAtMs,
        failureCount: runState.failureCount,
      });
    }

    return stateMap;
  } catch (error) {
    // Silently fail - if persistence file doesn't exist or is corrupted, start fresh
    return new Map();
  }
}

/**
 * Clean up old persistence files (over 7 days old).
 */
export async function cleanupOldPersistenceFiles(storePath: string): Promise<void> {
  if (!storePath) {
    return;
  }

  try {
    const persistenceDir = path.dirname(getPersistencePath(storePath));
    const files = await fs.readdir(persistenceDir);

    const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now = Date.now();

    for (const file of files) {
      if (!file.startsWith("cron-persistence")) {
        continue;
      }

      const filePath = path.join(persistenceDir, file);
      const stats = await fs.stat(filePath);

      if (now - stats.mtimeMs > maxAgeMs) {
        await fs.unlink(filePath);
      }
    }
  } catch (error) {
    // Silently fail - cleanup is optional
  }
}

/**
 * Get persistence file path based on store path.
 */
function getPersistencePath(storePath: string): string {
  const dir = path.dirname(storePath);
  const ext = path.extname(storePath);
  const base = path.basename(storePath, ext);
  return path.join(dir, `${base}-persistence${ext}`);
}

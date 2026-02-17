/**
 * Unified storage abstraction for OpenClaw.
 * Auto-detects available database and uses PostgreSQL if available, SQLite otherwise.
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";
import { isDatabaseConnected, runMigrations, getDatabase } from "./client.js";
import {
  isSqliteAvailable,
  runSqliteMigrations,
  recordSqliteUsage,
  querySqliteUsage,
  getSqlitePath,
} from "./sqlite-client.js";

const log = createSubsystemLogger("database/unified");

export type StorageBackend = "postgresql" | "sqlite" | "memory";

let currentBackend: StorageBackend = "memory";
let initialized = false;

/**
 * Initialize the storage backend.
 * Tries PostgreSQL first, then SQLite, then falls back to memory (no persistence).
 */
export async function initializeStorage(): Promise<StorageBackend> {
  if (initialized) {
    return currentBackend;
  }

  // Try PostgreSQL first
  const pgConnected = await isDatabaseConnected();
  if (pgConnected) {
    try {
      await runMigrations();
      currentBackend = "postgresql";
      log.info("storage backend: PostgreSQL (connected)");
      initialized = true;
      return currentBackend;
    } catch (err) {
      log.warn(`PostgreSQL migration failed: ${String(err)}`);
    }
  }

  // Try SQLite as fallback
  if (isSqliteAvailable()) {
    try {
      runSqliteMigrations();
      currentBackend = "sqlite";
      log.info(`storage backend: SQLite (${getSqlitePath()})`);
      initialized = true;
      return currentBackend;
    } catch (err) {
      log.warn(`SQLite initialization failed: ${String(err)}`);
    }
  }

  // Fall back to memory (no persistence)
  currentBackend = "memory";
  log.info("storage backend: memory (no persistence - install PostgreSQL or ensure SQLite works)");
  initialized = true;
  return currentBackend;
}

/**
 * Get the current storage backend.
 */
export function getStorageBackend(): StorageBackend {
  return currentBackend;
}

/**
 * Check if storage is available (not memory-only).
 */
export function isStorageAvailable(): boolean {
  return currentBackend !== "memory";
}

/**
 * Record LLM usage to the appropriate backend.
 */
export async function recordUsageUnified(entry: {
  time: Date;
  providerId: string;
  modelId: string;
  agentId?: string | null;
  sessionId?: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  costUsd?: number | null;
  durationMs?: number | null;
}): Promise<boolean> {
  if (!initialized) {
    await initializeStorage();
  }

  switch (currentBackend) {
    case "postgresql": {
      try {
        const db = getDatabase();
        await db`
          INSERT INTO llm_usage (
            time, provider_id, model_id, agent_id, session_id,
            input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
            cost_usd, duration_ms
          ) VALUES (
            ${entry.time},
            ${entry.providerId},
            ${entry.modelId},
            ${entry.agentId ?? null},
            ${entry.sessionId ?? null},
            ${entry.inputTokens},
            ${entry.outputTokens},
            ${entry.cacheReadTokens ?? 0},
            ${entry.cacheWriteTokens ?? 0},
            ${entry.costUsd ?? null},
            ${entry.durationMs ?? null}
          )
        `;
        return true;
      } catch (err) {
        log.warn(`PostgreSQL insert failed: ${String(err)}`);
        return false;
      }
    }

    case "sqlite": {
      return recordSqliteUsage(entry);
    }

    case "memory":
    default:
      // No persistence - just return true to not block the flow
      return true;
  }
}

/**
 * Query usage from the appropriate backend.
 */
export async function queryUsageUnified(params: {
  startTime?: Date;
  providerId?: string;
  modelId?: string;
  agentId?: string;
}): Promise<
  Array<{
    providerId: string;
    modelId: string;
    requests: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    totalCost: number;
    lastUsed: string | null;
  }>
> {
  if (!initialized) {
    await initializeStorage();
  }

  switch (currentBackend) {
    case "postgresql": {
      try {
        const db = getDatabase();
        type AggRow = {
          provider_id: string;
          model_id: string;
          requests: string;
          input_tokens: string;
          output_tokens: string;
          cache_read_tokens: string;
          cache_write_tokens: string;
          total_cost: string | null;
          last_used: Date | null;
        };

        const rows = await db<AggRow[]>`
          SELECT
            provider_id,
            model_id,
            COUNT(*)::text AS requests,
            SUM(input_tokens)::text AS input_tokens,
            SUM(output_tokens)::text AS output_tokens,
            COALESCE(SUM(cache_read_tokens), 0)::text AS cache_read_tokens,
            COALESCE(SUM(cache_write_tokens), 0)::text AS cache_write_tokens,
            SUM(cost_usd)::text AS total_cost,
            MAX(time) AS last_used
          FROM llm_usage
          WHERE time >= ${params.startTime ?? new Date(0)}
            ${params.providerId ? db`AND provider_id = ${params.providerId}` : db``}
            ${params.modelId ? db`AND model_id = ${params.modelId}` : db``}
            ${params.agentId ? db`AND agent_id = ${params.agentId}` : db``}
          GROUP BY provider_id, model_id
          ORDER BY SUM(cost_usd) DESC NULLS LAST, COUNT(*) DESC
        `;

        return rows.map((row: AggRow) => ({
          providerId: row.provider_id,
          modelId: row.model_id,
          requests: parseInt(row.requests, 10),
          inputTokens: parseInt(row.input_tokens, 10),
          outputTokens: parseInt(row.output_tokens, 10),
          cacheReadTokens: parseInt(row.cache_read_tokens, 10),
          cacheWriteTokens: parseInt(row.cache_write_tokens, 10),
          totalCost: row.total_cost ? parseFloat(row.total_cost) : 0,
          lastUsed: row.last_used?.toISOString() ?? null,
        }));
      } catch (err) {
        log.warn(`PostgreSQL query failed: ${String(err)}`);
        return [];
      }
    }

    case "sqlite": {
      return querySqliteUsage(params);
    }

    case "memory":
    default:
      return [];
  }
}

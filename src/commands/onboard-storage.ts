/**
 * Storage setup for onboarding wizard.
 * Detects and initializes the storage backend (PostgreSQL → SQLite → Memory).
 */

import type { OpenClawConfig } from "../config/config.js";
import {
  initializeStorage,
  getStorageBackend,
  isDatabaseConnected,
  getDatabaseConfig,
  getSqlitePath,
  isSqliteAvailable,
  type StorageBackend,
} from "../infra/database/index.js";
import type { RuntimeEnv } from "../runtime.js";
import { shortenHomePath } from "../utils.js";
import type { WizardPrompter } from "../wizard/prompts.js";

export type StorageSetupResult = {
  backend: StorageBackend;
  details: string[];
};

/**
 * Detect available storage backends without initializing.
 * Returns information about what's available.
 */
export async function detectStorageBackends(): Promise<{
  postgresql: { available: boolean; details?: string };
  sqlite: { available: boolean; path?: string };
}> {
  const pgConnected = await isDatabaseConnected();
  let pgDetails: string | undefined;

  if (pgConnected) {
    const dbConfig = getDatabaseConfig();
    if (dbConfig) {
      pgDetails = `${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`;
    }
  }

  const sqliteAvailable = isSqliteAvailable();
  const sqlitePath = sqliteAvailable ? getSqlitePath() : undefined;

  return {
    postgresql: { available: pgConnected, details: pgDetails },
    sqlite: { available: sqliteAvailable, path: sqlitePath },
  };
}

/**
 * Setup storage during onboarding.
 * This initializes the storage backend and shows the result to the user.
 */
export async function setupStorage(
  config: OpenClawConfig,
  runtime: RuntimeEnv,
  prompter: WizardPrompter,
): Promise<StorageSetupResult> {
  const detection = await detectStorageBackends();

  // Initialize storage (this will pick the best available backend)
  const backend = await initializeStorage();

  const details: string[] = [];

  if (backend === "postgresql") {
    details.push("Storage: PostgreSQL (connected)");
    if (detection.postgresql.details) {
      details.push(`Database: ${detection.postgresql.details}`);
    }
    details.push("Usage metrics will be persisted to PostgreSQL.");
  } else if (backend === "sqlite") {
    details.push("Storage: SQLite (local file)");
    if (detection.sqlite.path) {
      details.push(`Database: ${shortenHomePath(detection.sqlite.path)}`);
    }
    details.push("Usage metrics will be persisted locally.");
    if (!detection.postgresql.available) {
      details.push("");
      details.push("Tip: Install PostgreSQL for multi-device sync.");
    }
  } else {
    details.push("Storage: Memory (no persistence)");
    details.push("Usage metrics will not be persisted.");
    details.push("");
    details.push("To enable persistence:");
    details.push("- Install PostgreSQL for full metrics storage");
    details.push("- Or ensure Node.js 22+ for SQLite fallback");
  }

  await prompter.note(details.join("\n"), "Storage");

  return { backend, details };
}

/**
 * Format storage status for display (e.g., in health checks).
 */
export function formatStorageStatus(): string {
  const backend = getStorageBackend();

  switch (backend) {
    case "postgresql":
      return "PostgreSQL";
    case "sqlite":
      return `SQLite (${shortenHomePath(getSqlitePath())})`;
    case "memory":
      return "Memory (no persistence)";
    default:
      return "Unknown";
  }
}

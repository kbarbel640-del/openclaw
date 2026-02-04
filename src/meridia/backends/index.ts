/**
 * Meridia Backend Factory.
 *
 * Creates and caches backend instances based on configuration.
 * Currently supports SQLite. Future: PostgreSQL, MySQL.
 */

import path from "node:path";
import type { OpenClawConfig } from "../../config/config.js";
import type { MeridiaDbBackend } from "../backend.js";
import { resolveMeridiaDir } from "../storage.js";

// ─── Types ───────────────────────────────────────────────────────────

export type BackendType = "sqlite"; // Future: | "postgresql" | "mysql"

export type BackendConfig = {
  type: BackendType;
  /** For SQLite: the path to the .sqlite file. */
  dbPath?: string;
  /** For network DBs (future): connection string. */
  connectionString?: string;
};

// ─── Singleton cache ─────────────────────────────────────────────────

let _cachedBackend: MeridiaDbBackend | undefined;
let _cachedBackendPath: string | undefined;

/**
 * Create a Meridia database backend.
 *
 * The backend is cached by path — calling with the same path returns
 * the same instance. Call `closeBackend()` to release it.
 */
export function createBackend(config?: BackendConfig & { cfg?: OpenClawConfig }): MeridiaDbBackend {
  const backendType = config?.type ?? "sqlite";

  if (backendType === "sqlite") {
    const dbPath = config?.dbPath ?? path.join(resolveMeridiaDir(config?.cfg), "meridia.sqlite");

    // Return cached if same path
    if (_cachedBackend && _cachedBackendPath === dbPath) {
      return _cachedBackend;
    }

    // Close previous if different path
    if (_cachedBackend) {
      try {
        _cachedBackend.close();
      } catch {
        // ignore
      }
    }

    // Lazy-load to avoid pulling node:sqlite at parse time
    const { SqliteBackend } = require("./sqlite.js") as typeof import("./sqlite.js");
    const backend = new SqliteBackend(dbPath);

    _cachedBackend = backend;
    _cachedBackendPath = dbPath;
    return backend;
  }

  throw new Error(`Unsupported Meridia backend type: ${backendType}`);
}

/**
 * Close the cached backend and release resources.
 */
export function closeBackend(): void {
  if (_cachedBackend) {
    try {
      _cachedBackend.close();
    } catch {
      // ignore
    }
    _cachedBackend = undefined;
    _cachedBackendPath = undefined;
  }
}

/**
 * Get the currently cached backend, if any.
 */
export function getCachedBackend(): MeridiaDbBackend | undefined {
  return _cachedBackend;
}

// Re-export backend types and interface
export type { MeridiaDbBackend } from "../backend.js";
export { SqliteBackend } from "./sqlite.js";

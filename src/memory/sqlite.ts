import { createRequire } from "node:module";
import { installProcessWarningFilter } from "../infra/warning-filter.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const require = createRequire(import.meta.url);
const log = createSubsystemLogger("memory:sqlite");

/**
 * Check if a SQLite module supports FTS5 by attempting to create a virtual table.
 */
function checkFTS5Support(DatabaseSync: unknown): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const testDb = new (DatabaseSync as any)(":memory:");
    testDb.exec("CREATE VIRTUAL TABLE _fts5_test USING fts5(content)");
    testDb.exec("DROP TABLE _fts5_test");
    testDb.close();
    return true;
  } catch {
    return false;
  }
}

export function requireNodeSqlite(): typeof import("node:sqlite") {
  installProcessWarningFilter();

  // Try node:sqlite first
  try {
    const nodeSqlite = require("node:sqlite") as typeof import("node:sqlite");
    // Check if FTS5 is supported
    if (checkFTS5Support(nodeSqlite.DatabaseSync)) {
      return nodeSqlite;
    }
    // FTS5 not supported, fall through to better-sqlite3
  } catch (err) {
    // node:sqlite not available, fall through to better-sqlite3
    const message = err instanceof Error ? err.message : String(err);
    log.debug(
      `node:sqlite unavailable or FTS5 not supported, falling back to better-sqlite3: ${message}`,
    );
  }

  // Try better-sqlite3 as fallback (with FTS5 support)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Database = require("better-sqlite3");
    // Wrap better-sqlite3 to match node:sqlite DatabaseSync API
    return {
      DatabaseSync: Database,
      SqliteError: Database.SqliteError,
      constants: {},
    } as unknown as typeof import("node:sqlite");
  } catch (fallbackErr) {
    // Surface an actionable error when both are unavailable.
    throw new Error(
      `SQLite support is unavailable in this Node runtime (missing node:sqlite with FTS5 and better-sqlite3).`,
      { cause: fallbackErr },
    );
  }
}

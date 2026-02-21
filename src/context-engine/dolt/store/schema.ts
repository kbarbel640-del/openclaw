import type { DatabaseSync } from "node:sqlite";

/**
 * Increment when schema migrations are added.
 */
export const DOLT_STORE_SCHEMA_VERSION = 2;

/**
 * Ensure all Dolt store tables, columns, and indexes exist.
 */
export function ensureDoltStoreSchema(db: DatabaseSync): void {
  db.exec("PRAGMA foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS dolt_store_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS dolt_records (
      pointer TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      session_key TEXT,
      level TEXT NOT NULL CHECK (level IN ('turn', 'leaf', 'bindle')),
      event_ts_ms INTEGER NOT NULL,
      token_count INTEGER NOT NULL DEFAULT 0,
      token_count_method TEXT NOT NULL DEFAULT 'estimateTokens' CHECK (token_count_method IN ('estimateTokens', 'fallback')),
      payload_json TEXT,
      finalized_at_reset INTEGER NOT NULL DEFAULT 0 CHECK (finalized_at_reset IN (0, 1)),
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL
    );
  `);
  ensureColumn(db, "dolt_records", "session_key", "TEXT");
  ensureColumn(db, "dolt_records", "token_count", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(
    db,
    "dolt_records",
    "token_count_method",
    "TEXT NOT NULL DEFAULT 'estimateTokens' CHECK (token_count_method IN ('estimateTokens', 'fallback'))",
  );
  ensureColumn(db, "dolt_records", "payload_json", "TEXT");
  ensureColumn(
    db,
    "dolt_records",
    "finalized_at_reset",
    "INTEGER NOT NULL DEFAULT 0 CHECK (finalized_at_reset IN (0, 1))",
  );
  ensureColumn(db, "dolt_records", "created_at_ms", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "dolt_records", "updated_at_ms", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "dolt_records", "event_ts_ms", "INTEGER NOT NULL DEFAULT 0");

  db.exec(`
    CREATE TABLE IF NOT EXISTS dolt_lineage (
      parent_pointer TEXT NOT NULL,
      child_pointer TEXT NOT NULL,
      child_index INTEGER NOT NULL,
      child_level TEXT NOT NULL CHECK (child_level IN ('turn', 'leaf', 'bindle')),
      created_at_ms INTEGER NOT NULL,
      PRIMARY KEY (parent_pointer, child_pointer),
      FOREIGN KEY (parent_pointer) REFERENCES dolt_records(pointer) ON DELETE CASCADE,
      FOREIGN KEY (child_pointer) REFERENCES dolt_records(pointer) ON DELETE CASCADE
    );
  `);
  ensureColumn(db, "dolt_lineage", "child_index", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "dolt_lineage", "child_level", "TEXT NOT NULL DEFAULT 'turn'");
  ensureColumn(db, "dolt_lineage", "created_at_ms", "INTEGER NOT NULL DEFAULT 0");

  db.exec(`
    CREATE TABLE IF NOT EXISTS dolt_active_lane (
      session_id TEXT NOT NULL,
      session_key TEXT,
      level TEXT NOT NULL CHECK (level IN ('turn', 'leaf', 'bindle')),
      pointer TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      last_event_ts_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,
      PRIMARY KEY (session_id, level, pointer),
      FOREIGN KEY (pointer) REFERENCES dolt_records(pointer) ON DELETE CASCADE
    );
  `);
  ensureColumn(db, "dolt_active_lane", "session_key", "TEXT");
  ensureColumn(
    db,
    "dolt_active_lane",
    "is_active",
    "INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))",
  );
  ensureColumn(db, "dolt_active_lane", "last_event_ts_ms", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "dolt_active_lane", "updated_at_ms", "INTEGER NOT NULL DEFAULT 0");

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dolt_records_session_level_event
    ON dolt_records(session_id, level, event_ts_ms, pointer);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dolt_records_session_key_level_event
    ON dolt_records(session_key, level, event_ts_ms, pointer);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dolt_records_session_level_finalized
    ON dolt_records(session_id, level, finalized_at_reset, event_ts_ms);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dolt_lineage_parent_index
    ON dolt_lineage(parent_pointer, child_index, child_pointer);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dolt_lineage_child
    ON dolt_lineage(child_pointer);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dolt_active_lane_lookup
    ON dolt_active_lane(session_id, level, is_active, last_event_ts_ms, pointer);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dolt_active_lane_session_key
    ON dolt_active_lane(session_key, level, is_active, last_event_ts_ms, pointer);
  `);

  db.prepare(
    `
      INSERT INTO dolt_store_meta (key, value)
      VALUES ('schema_version', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
  ).run(String(DOLT_STORE_SCHEMA_VERSION));
}

function ensureColumn(
  db: DatabaseSync,
  table: "dolt_records" | "dolt_lineage" | "dolt_active_lane",
  column: string,
  definition: string,
): void {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (rows.some((row) => row.name === column)) {
    return;
  }
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

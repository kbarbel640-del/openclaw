import type { DatabaseSync } from "node:sqlite";
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { MeridiaExperienceRecordV2, MeridiaTraceEventV2 } from "../types.js";
import { isDefaultMeridiaDir, resolveMeridiaDir } from "../paths.js";

const require = createRequire(import.meta.url);

const SCHEMA_VERSION = "2";

let _db: DatabaseSync | undefined;
let _dbPath: string | undefined;
let _ftsAvailable: boolean | undefined;

function openDb(dbPath: string): DatabaseSync {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("node:sqlite") as typeof import("node:sqlite");
  const db = new mod.DatabaseSync(dbPath);

  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

function listTables(db: DatabaseSync): string[] {
  try {
    const rows = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as Array<{
      name: string;
    }>;
    return rows.map((row) => row.name).filter(Boolean);
  } catch {
    return [];
  }
}

function readSchemaVersion(db: DatabaseSync): string | null {
  try {
    const hasMeta = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='meridia_meta'`)
      .get() as { name?: string } | undefined;
    if (!hasMeta?.name) {
      return null;
    }
    const row = db.prepare(`SELECT value FROM meridia_meta WHERE key = 'schema_version'`).get() as
      | { value?: string }
      | undefined;
    return typeof row?.value === "string" ? row.value : null;
  } catch {
    return null;
  }
}

function isV2Schema(db: DatabaseSync): boolean {
  const tables = new Set(listTables(db));
  if (!tables.has("meridia_records_v2") || !tables.has("meridia_trace_v2")) {
    return false;
  }
  return readSchemaVersion(db) === SCHEMA_VERSION;
}

function isLegacySchema(db: DatabaseSync): boolean {
  const tables = new Set(listTables(db));
  if (
    tables.has("meridia_records") ||
    tables.has("meridia_trace") ||
    tables.has("meridia_sessions")
  ) {
    return true;
  }
  const version = readSchemaVersion(db);
  return version !== null && version !== SCHEMA_VERSION;
}

function buildBackupDir(meridiaDir: string): string {
  const parent = path.dirname(meridiaDir);
  const ts = new Date()
    .toISOString()
    .replaceAll(":", "")
    .replaceAll("-", "")
    .replace(/\.\d+Z$/, "Z");
  let candidate = path.join(parent, `meridia-bak-${ts}`);
  if (!fs.existsSync(candidate)) {
    return candidate;
  }
  candidate = path.join(parent, `meridia-bak-${ts}-${crypto.randomUUID().slice(0, 8)}`);
  return candidate;
}

export function getMeridiaDbPath(params?: {
  cfg?: OpenClawConfig;
  hookKey?: string;
  meridiaDir?: string;
}): string {
  const meridiaDir = params?.meridiaDir ?? resolveMeridiaDir(params?.cfg, params?.hookKey);
  return path.join(meridiaDir, "meridia.sqlite");
}

export function resetMeridiaDir(params: { meridiaDir: string }): { backupDir: string | null } {
  const { meridiaDir } = params;
  if (!fs.existsSync(meridiaDir)) {
    fs.mkdirSync(meridiaDir, { recursive: true, mode: 0o700 });
    return { backupDir: null };
  }

  const backupDir = buildBackupDir(meridiaDir);
  fs.renameSync(meridiaDir, backupDir);
  fs.mkdirSync(meridiaDir, { recursive: true, mode: 0o700 });
  return { backupDir };
}

function ensureSchema(db: DatabaseSync): { ftsAvailable: boolean; ftsError?: string } {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meridia_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS meridia_records_v2 (
      id TEXT PRIMARY KEY,
      ts TEXT NOT NULL,
      kind TEXT NOT NULL,
      session_key TEXT,
      session_id TEXT,
      run_id TEXT,
      tool_name TEXT,
      tool_call_id TEXT,
      is_error INTEGER DEFAULT 0,
      score REAL,
      threshold REAL,
      eval_kind TEXT,
      eval_model TEXT,
      eval_reason TEXT,
      tags_json TEXT,
      data_json TEXT NOT NULL,
      data_text TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_meridia_records_v2_ts ON meridia_records_v2(ts);`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_meridia_records_v2_session_key ON meridia_records_v2(session_key);`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_meridia_records_v2_tool_name ON meridia_records_v2(tool_name);`,
  );
  db.exec(`CREATE INDEX IF NOT EXISTS idx_meridia_records_v2_score ON meridia_records_v2(score);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_meridia_records_v2_kind ON meridia_records_v2(kind);`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS meridia_trace_v2 (
      id TEXT PRIMARY KEY,
      ts TEXT NOT NULL,
      kind TEXT NOT NULL,
      session_key TEXT,
      data_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_meridia_trace_v2_ts ON meridia_trace_v2(ts);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_meridia_trace_v2_kind ON meridia_trace_v2(kind);`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_meridia_trace_v2_session_key ON meridia_trace_v2(session_key);`,
  );

  let ftsAvailable = false;
  let ftsError: string | undefined;
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS meridia_records_v2_fts USING fts5(
        tool_name,
        eval_reason,
        data_text,
        content=meridia_records_v2,
        content_rowid=rowid
      );
    `);
    ftsAvailable = true;
  } catch (err) {
    ftsError = err instanceof Error ? err.message : String(err);
  }

  db.prepare(`INSERT OR REPLACE INTO meridia_meta (key, value) VALUES ('schema_version', ?)`).run(
    SCHEMA_VERSION,
  );

  _ftsAvailable = ftsAvailable;
  return { ftsAvailable, ...(ftsError ? { ftsError } : {}) };
}

export function closeMeridiaDb(): void {
  if (_db) {
    try {
      _db.close();
    } catch {
      // ignore
    }
  }
  _db = undefined;
  _dbPath = undefined;
  _ftsAvailable = undefined;
}

export function isMeridiaFtsAvailable(): boolean {
  return _ftsAvailable === true;
}

export function openMeridiaDb(params?: {
  cfg?: OpenClawConfig;
  hookKey?: string;
  meridiaDir?: string;
  allowAutoReset?: boolean;
}): DatabaseSync {
  const meridiaDir = params?.meridiaDir ?? resolveMeridiaDir(params?.cfg, params?.hookKey);
  const allowAutoReset = params?.allowAutoReset !== false;
  const dbPath = getMeridiaDbPath({ meridiaDir });

  if (_db && _dbPath === dbPath) {
    return _db;
  }

  if (_db) {
    closeMeridiaDb();
  }

  const dirExists = fs.existsSync(meridiaDir);
  const dbExists = fs.existsSync(dbPath);
  const hasFiles =
    dirExists &&
    (() => {
      try {
        const entries = fs.readdirSync(meridiaDir);
        return entries.length > 0;
      } catch {
        return false;
      }
    })();

  if (dbExists) {
    const tmp = openDb(dbPath);
    const v2 = isV2Schema(tmp);
    const legacy = !v2 && isLegacySchema(tmp);
    try {
      tmp.close();
    } catch {}

    if (!v2 && (legacy || hasFiles)) {
      if (!allowAutoReset || !isDefaultMeridiaDir(meridiaDir)) {
        throw new Error(
          `Legacy Meridia data detected in "${meridiaDir}". ` +
            `Auto-reset is disabled for non-default paths. ` +
            `Run: openclaw meridia reset --dir ${JSON.stringify(meridiaDir)}`,
        );
      }
      resetMeridiaDir({ meridiaDir });
    }
  } else if (hasFiles) {
    if (!allowAutoReset || !isDefaultMeridiaDir(meridiaDir)) {
      throw new Error(
        `Legacy Meridia data detected in "${meridiaDir}". ` +
          `Auto-reset is disabled for non-default paths. ` +
          `Run: openclaw meridia reset --dir ${JSON.stringify(meridiaDir)}`,
      );
    }
    resetMeridiaDir({ meridiaDir });
  }

  fs.mkdirSync(meridiaDir, { recursive: true, mode: 0o700 });
  const db = openDb(dbPath);
  ensureSchema(db);

  _db = db;
  _dbPath = dbPath;
  return db;
}

function clampText(input: string, maxChars: number): string {
  if (input.length <= maxChars) {
    return input;
  }
  return `${input.slice(0, Math.max(0, maxChars - 12))}…(truncated)`;
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildSearchableText(record: MeridiaExperienceRecordV2): string {
  const parts: string[] = [];
  if (record.tool?.name) parts.push(record.tool.name);
  if (record.tool?.meta) parts.push(record.tool.meta);
  if (record.capture.evaluation.reason) parts.push(record.capture.evaluation.reason);
  if (record.content?.topic) parts.push(record.content.topic);
  if (record.content?.summary) parts.push(record.content.summary);
  if (record.content?.context) parts.push(record.content.context);
  if (record.content?.tags?.length) parts.push(record.content.tags.join(" "));
  if (record.content?.anchors?.length) parts.push(record.content.anchors.join(" "));
  if (record.data?.args !== undefined) {
    parts.push(clampText(safeJsonStringify(record.data.args), 500));
  }
  if (record.data?.result !== undefined) {
    parts.push(clampText(safeJsonStringify(record.data.result), 1000));
  }
  return parts.join(" ");
}

export function insertExperienceRecord(
  db: DatabaseSync,
  record: MeridiaExperienceRecordV2,
): boolean {
  const dataJson = JSON.stringify(record);
  const dataText = buildSearchableText(record);
  const tagsJson = record.content?.tags?.length ? JSON.stringify(record.content.tags) : null;
  const evaluation = record.capture.evaluation;

  const result = db
    .prepare(`
      INSERT OR IGNORE INTO meridia_records_v2
        (id, ts, kind, session_key, session_id, run_id, tool_name, tool_call_id, is_error,
         score, threshold, eval_kind, eval_model, eval_reason, tags_json, data_json, data_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      record.id,
      record.ts,
      record.kind,
      record.session?.key ?? null,
      record.session?.id ?? null,
      record.session?.runId ?? null,
      record.tool?.name ?? null,
      record.tool?.callId ?? null,
      record.tool?.isError ? 1 : 0,
      record.capture.score,
      record.capture.threshold ?? null,
      evaluation.kind,
      evaluation.model ?? null,
      evaluation.reason ?? null,
      tagsJson,
      dataJson,
      dataText,
    );

  const inserted = (result.changes ?? 0) > 0;
  if (inserted && _ftsAvailable) {
    try {
      const row = db.prepare(`SELECT rowid FROM meridia_records_v2 WHERE id = ?`).get(record.id) as
        | { rowid: number }
        | undefined;
      if (row) {
        db.prepare(`
          INSERT INTO meridia_records_v2_fts (rowid, tool_name, eval_reason, data_text)
          VALUES (?, ?, ?, ?)
        `).run(row.rowid, record.tool?.name ?? "", evaluation.reason ?? "", dataText);
      }
    } catch {
      // FTS insert failure is non-fatal.
    }
  }

  return inserted;
}

export function insertTraceEvent(db: DatabaseSync, event: MeridiaTraceEventV2): boolean {
  const dataJson = JSON.stringify(event);
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO meridia_trace_v2 (id, ts, kind, session_key, data_json) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(event.id, event.ts, event.kind, event.session?.key ?? null, dataJson);
  return (result.changes ?? 0) > 0;
}

export type MeridiaDbStatsV2 = {
  recordCount: number;
  traceCount: number;
  oldestRecord: string | null;
  newestRecord: string | null;
  schemaVersion: string | null;
};

export function getMeridiaDbStats(db: DatabaseSync): MeridiaDbStatsV2 {
  const recordCount = (
    db.prepare(`SELECT COUNT(*) AS cnt FROM meridia_records_v2`).get() as { cnt: number }
  ).cnt;
  const traceCount = (
    db.prepare(`SELECT COUNT(*) AS cnt FROM meridia_trace_v2`).get() as { cnt: number }
  ).cnt;
  const oldest = db.prepare(`SELECT MIN(ts) AS ts FROM meridia_records_v2`).get() as {
    ts: string | null;
  };
  const newest = db.prepare(`SELECT MAX(ts) AS ts FROM meridia_records_v2`).get() as {
    ts: string | null;
  };
  const version = readSchemaVersion(db);
  return {
    recordCount,
    traceCount,
    oldestRecord: oldest.ts,
    newestRecord: newest.ts,
    schemaVersion: version,
  };
}

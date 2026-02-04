/**
 * Meridia SQLite Backend.
 *
 * Implements `MeridiaDbBackend` using Node.js built-in `node:sqlite`
 * (DatabaseSync).  All SQLite-specific SQL, PRAGMAs, and FTS5 logic
 * lives here — nothing leaks through the interface.
 */

import type { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type {
  MeridiaDbBackend,
  RecordQueryResult,
  RecordQueryFilters,
  SessionSummary,
  SessionListItem,
  ToolStatsItem,
  TraceEventResult,
  DbStats,
  SessionUpsertInput,
} from "../backend.js";
import type { MeridiaExperienceRecord, MeridiaTraceEvent } from "../types.js";
import { requireNodeSqlite } from "../../memory/sqlite.js";

// ─── Internal row types (SQLite-specific) ────────────────────────────

type RecordRow = {
  id: string;
  ts: string;
  session_key: string | null;
  session_id: string | null;
  run_id: string | null;
  tool_name: string | null;
  tool_call_id: string | null;
  is_error: number;
  score: number | null;
  recommendation: string | null;
  reason: string | null;
  eval_kind: string | null;
  eval_model: string | null;
  data_json: string;
  data_text: string | null;
  created_at: string;
};

type SessionRow = {
  session_key: string;
  started_at: string | null;
  ended_at: string | null;
  turn_count: number | null;
  tools_used: string | null;
  topics: string | null;
  emotional_arc: string | null;
  summary: string | null;
  created_at: string;
};

type TraceRow = {
  id: number;
  type: string;
  ts: string;
  session_key: string | null;
  data_json: string;
};

// ─── Constants ───────────────────────────────────────────────────────

const SCHEMA_VERSION = 1;

// ─── Helpers ─────────────────────────────────────────────────────────

function parseRecord(row: RecordRow): MeridiaExperienceRecord {
  return JSON.parse(row.data_json) as MeridiaExperienceRecord;
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildSearchableText(record: MeridiaExperienceRecord): string {
  const parts: string[] = [];
  parts.push(record.tool.name);
  if (record.tool.meta) parts.push(record.tool.meta);
  if (record.evaluation.reason) parts.push(record.evaluation.reason);
  if (record.data.args) {
    try {
      const argsStr = JSON.stringify(record.data.args);
      parts.push(argsStr.length > 500 ? argsStr.slice(0, 500) : argsStr);
    } catch {
      /* skip */
    }
  }
  if (record.data.result) {
    try {
      const resultStr = JSON.stringify(record.data.result);
      parts.push(resultStr.length > 1000 ? resultStr.slice(0, 1000) : resultStr);
    } catch {
      /* skip */
    }
  }
  return parts.join(" ");
}

function applyFilters(
  baseWhere: string,
  baseParams: unknown[],
  filters?: RecordQueryFilters,
): { where: string; params: unknown[]; limitClause: string } {
  const conditions: string[] = baseWhere ? [baseWhere] : [];
  const params = [...baseParams];

  if (filters?.sessionKey) {
    conditions.push("r.session_key = ?");
    params.push(filters.sessionKey);
  }
  if (filters?.toolName) {
    conditions.push("r.tool_name = ?");
    params.push(filters.toolName);
  }
  if (filters?.minScore !== undefined) {
    conditions.push("r.score >= ?");
    params.push(filters.minScore);
  }
  if (filters?.maxScore !== undefined) {
    conditions.push("r.score <= ?");
    params.push(filters.maxScore);
  }
  if (filters?.isError !== undefined) {
    conditions.push("r.is_error = ?");
    params.push(filters.isError ? 1 : 0);
  }
  if (filters?.evalKind) {
    conditions.push("r.eval_kind = ?");
    params.push(filters.evalKind);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;
  const limitClause = `LIMIT ${limit} OFFSET ${offset}`;

  return { where, params, limitClause };
}

// ─── SQLite Backend Implementation ───────────────────────────────────

export class SqliteBackend implements MeridiaDbBackend {
  private db: DatabaseSync;
  private ftsAvailable = false;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    const { DatabaseSync: DbSync } = requireNodeSqlite();
    this.db = new DbSync(dbPath);

    // SQLite-specific PRAGMAs
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA synchronous = NORMAL");
    this.db.exec("PRAGMA foreign_keys = ON");

    const result = this.ensureSchema();
    this.ftsAvailable = result.ftsAvailable;
  }

  /**
   * Get the underlying DatabaseSync handle.
   * ONLY for backward-compat shims — do NOT use in new code.
   * @internal
   */
  get rawDb(): DatabaseSync {
    return this.db;
  }

  // ── Lifecycle ──

  ensureSchema(): { ftsAvailable: boolean; ftsError?: string } {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meridia_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meridia_records (
        id TEXT PRIMARY KEY,
        ts TEXT NOT NULL,
        session_key TEXT,
        session_id TEXT,
        run_id TEXT,
        tool_name TEXT,
        tool_call_id TEXT,
        is_error INTEGER DEFAULT 0,
        score REAL,
        recommendation TEXT,
        reason TEXT,
        eval_kind TEXT,
        eval_model TEXT,
        data_json TEXT,
        data_text TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_records_ts ON meridia_records(ts);`);
    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_records_session_key ON meridia_records(session_key);`,
    );
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_records_tool_name ON meridia_records(tool_name);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_records_score ON meridia_records(score);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_records_run_id ON meridia_records(run_id);`);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meridia_sessions (
        session_key TEXT PRIMARY KEY,
        started_at TEXT,
        ended_at TEXT,
        turn_count INTEGER,
        tools_used TEXT,
        topics TEXT,
        emotional_arc TEXT,
        summary TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meridia_trace (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        ts TEXT NOT NULL,
        session_key TEXT,
        data_json TEXT
      );
    `);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_trace_ts ON meridia_trace(ts);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_trace_type ON meridia_trace(type);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_trace_session_key ON meridia_trace(session_key);`);

    let ftsAvailable = false;
    let ftsError: string | undefined;
    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS meridia_records_fts USING fts5(
          tool_name,
          reason,
          data_text,
          content=meridia_records,
          content_rowid=rowid
        );
      `);
      ftsAvailable = true;
    } catch (err) {
      ftsError = err instanceof Error ? err.message : String(err);
    }

    this.db
      .prepare(`INSERT OR REPLACE INTO meridia_meta (key, value) VALUES ('schema_version', ?)`)
      .run(String(SCHEMA_VERSION));

    this.ftsAvailable = ftsAvailable;
    return { ftsAvailable, ...(ftsError ? { ftsError } : {}) };
  }

  close(): void {
    try {
      this.db.close();
    } catch {
      // ignore
    }
  }

  // ── Record operations ──

  insertRecord(record: MeridiaExperienceRecord): boolean {
    const dataText = buildSearchableText(record);
    const dataJson = JSON.stringify(record);

    const result = this.db
      .prepare(`
      INSERT OR IGNORE INTO meridia_records
        (id, ts, session_key, session_id, run_id, tool_name, tool_call_id,
         is_error, score, recommendation, reason, eval_kind, eval_model,
         data_json, data_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .run(
        record.id,
        record.ts,
        record.sessionKey ?? null,
        record.sessionId ?? null,
        record.runId ?? null,
        record.tool.name,
        record.tool.callId,
        record.tool.isError ? 1 : 0,
        record.evaluation.score,
        record.evaluation.recommendation,
        record.evaluation.reason ?? null,
        record.evaluation.kind,
        record.evaluation.model ?? null,
        dataJson,
        dataText,
      );

    const inserted = (result.changes ?? 0) > 0;

    if (inserted && this.ftsAvailable) {
      try {
        const row = this.db
          .prepare(`SELECT rowid FROM meridia_records WHERE id = ?`)
          .get(record.id) as { rowid: number } | undefined;
        if (row) {
          this.db
            .prepare(`
            INSERT INTO meridia_records_fts (rowid, tool_name, reason, data_text)
            VALUES (?, ?, ?, ?)
          `)
            .run(row.rowid, record.tool.name, record.evaluation.reason ?? "", dataText);
        }
      } catch {
        // FTS insert failed — non-fatal
      }
    }

    return inserted;
  }

  insertRecordsBatch(records: MeridiaExperienceRecord[]): number {
    let count = 0;

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO meridia_records
        (id, ts, session_key, session_id, run_id, tool_name, tool_call_id,
         is_error, score, recommendation, reason, eval_kind, eval_model,
         data_json, data_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const getRowidStmt = this.db.prepare(`SELECT rowid FROM meridia_records WHERE id = ?`);

    const ftsStmt = this.ftsAvailable
      ? (() => {
          try {
            return this.db.prepare(`
              INSERT INTO meridia_records_fts (rowid, tool_name, reason, data_text)
              VALUES (?, ?, ?, ?)
            `);
          } catch {
            return null;
          }
        })()
      : null;

    this.db.exec("BEGIN");
    try {
      for (const record of records) {
        const dataText = buildSearchableText(record);
        const dataJson = JSON.stringify(record);

        const result = insertStmt.run(
          record.id,
          record.ts,
          record.sessionKey ?? null,
          record.sessionId ?? null,
          record.runId ?? null,
          record.tool.name,
          record.tool.callId,
          record.tool.isError ? 1 : 0,
          record.evaluation.score,
          record.evaluation.recommendation,
          record.evaluation.reason ?? null,
          record.evaluation.kind,
          record.evaluation.model ?? null,
          dataJson,
          dataText,
        );

        if ((result.changes ?? 0) > 0) {
          count++;
          if (ftsStmt) {
            try {
              const row = getRowidStmt.get(record.id) as { rowid: number } | undefined;
              if (row) {
                ftsStmt.run(row.rowid, record.tool.name, record.evaluation.reason ?? "", dataText);
              }
            } catch {
              /* FTS insert failed — skip */
            }
          }
        }
      }
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }

    return count;
  }

  getRecordById(id: string): RecordQueryResult | null {
    const row = this.db.prepare(`SELECT * FROM meridia_records WHERE id = ?`).get(id) as
      | RecordRow
      | undefined;
    if (!row) return null;
    return { record: parseRecord(row) };
  }

  // ── Trace event operations ──

  insertTraceEvent(event: MeridiaTraceEvent): void {
    this.db
      .prepare(`
      INSERT INTO meridia_trace (type, ts, session_key, data_json)
      VALUES (?, ?, ?, ?)
    `)
      .run(
        event.type,
        event.ts,
        "sessionKey" in event ? (event.sessionKey ?? null) : null,
        JSON.stringify(event),
      );
  }

  insertTraceEventsBatch(events: MeridiaTraceEvent[]): number {
    const stmt = this.db.prepare(`
      INSERT INTO meridia_trace (type, ts, session_key, data_json)
      VALUES (?, ?, ?, ?)
    `);

    let count = 0;
    this.db.exec("BEGIN");
    try {
      for (const event of events) {
        stmt.run(
          event.type,
          event.ts,
          "sessionKey" in event ? (event.sessionKey ?? null) : null,
          JSON.stringify(event),
        );
        count++;
      }
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
    return count;
  }

  getTraceEvents(params: {
    sessionKey?: string;
    type?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): TraceEventResult[] {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.sessionKey) {
      conditions.push("session_key = ?");
      values.push(params.sessionKey);
    }
    if (params.type) {
      conditions.push("type = ?");
      values.push(params.type);
    }
    if (params.from) {
      conditions.push("ts >= ?");
      values.push(params.from);
    }
    if (params.to) {
      conditions.push("ts <= ?");
      values.push(params.to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = params.limit ?? 100;
    const offset = params.offset ?? 0;

    const rows = this.db
      .prepare(`
      SELECT * FROM meridia_trace
      ${where}
      ORDER BY ts DESC
      LIMIT ${limit} OFFSET ${offset}
    `)
      .all(...values) as TraceRow[];

    return rows.map((row) => ({
      event: parseJson(row.data_json),
      raw: row,
    }));
  }

  // ── Session operations ──

  upsertSession(session: SessionUpsertInput): void {
    this.db
      .prepare(`
      INSERT INTO meridia_sessions
        (session_key, started_at, ended_at, turn_count, tools_used, topics, emotional_arc, summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_key) DO UPDATE SET
        ended_at = COALESCE(excluded.ended_at, meridia_sessions.ended_at),
        turn_count = COALESCE(excluded.turn_count, meridia_sessions.turn_count),
        tools_used = COALESCE(excluded.tools_used, meridia_sessions.tools_used),
        topics = COALESCE(excluded.topics, meridia_sessions.topics),
        emotional_arc = COALESCE(excluded.emotional_arc, meridia_sessions.emotional_arc),
        summary = COALESCE(excluded.summary, meridia_sessions.summary)
    `)
      .run(
        session.sessionKey,
        session.startedAt ?? null,
        session.endedAt ?? null,
        session.turnCount ?? null,
        session.toolsUsed ? JSON.stringify(session.toolsUsed) : null,
        session.topics ? JSON.stringify(session.topics) : null,
        session.emotionalArc ? JSON.stringify(session.emotionalArc) : null,
        session.summary ?? null,
      );
  }

  getSessionSummary(sessionKey: string): SessionSummary | null {
    const sessionRow = this.db
      .prepare(`SELECT * FROM meridia_sessions WHERE session_key = ?`)
      .get(sessionKey) as SessionRow | undefined;

    const recordCount = (
      this.db
        .prepare(`SELECT COUNT(*) as cnt FROM meridia_records WHERE session_key = ?`)
        .get(sessionKey) as { cnt: number }
    ).cnt;

    if (!sessionRow && recordCount === 0) {
      return null;
    }

    if (!sessionRow) {
      const firstRecord = this.db
        .prepare(`SELECT ts FROM meridia_records WHERE session_key = ? ORDER BY ts ASC LIMIT 1`)
        .get(sessionKey) as { ts: string } | undefined;
      const lastRecord = this.db
        .prepare(`SELECT ts FROM meridia_records WHERE session_key = ? ORDER BY ts DESC LIMIT 1`)
        .get(sessionKey) as { ts: string } | undefined;
      const toolRows = this.db
        .prepare(`SELECT DISTINCT tool_name FROM meridia_records WHERE session_key = ?`)
        .all(sessionKey) as Array<{ tool_name: string }>;

      return {
        sessionKey,
        startedAt: firstRecord?.ts ?? null,
        endedAt: lastRecord?.ts ?? null,
        turnCount: recordCount,
        toolsUsed: toolRows.map((r) => r.tool_name),
        topics: [],
        emotionalArc: null,
        summary: null,
        recordCount,
      };
    }

    return {
      sessionKey: sessionRow.session_key,
      startedAt: sessionRow.started_at,
      endedAt: sessionRow.ended_at,
      turnCount: sessionRow.turn_count,
      toolsUsed: parseJsonArray(sessionRow.tools_used),
      topics: parseJsonArray(sessionRow.topics),
      emotionalArc: parseJson(sessionRow.emotional_arc),
      summary: sessionRow.summary,
      recordCount,
    };
  }

  listSessions(params?: { limit?: number; offset?: number }): SessionListItem[] {
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;

    const rows = this.db
      .prepare(`
        SELECT
          session_key,
          COUNT(*) as record_count,
          MIN(ts) as first_ts,
          MAX(ts) as last_ts
        FROM meridia_records
        WHERE session_key IS NOT NULL
        GROUP BY session_key
        ORDER BY MAX(ts) DESC
        LIMIT ? OFFSET ?
      `)
      .all(limit, offset) as Array<{
      session_key: string;
      record_count: number;
      first_ts: string;
      last_ts: string;
    }>;

    return rows.map((row) => {
      const hasSession =
        this.db
          .prepare(`SELECT 1 FROM meridia_sessions WHERE session_key = ?`)
          .get(row.session_key) !== undefined;

      return {
        sessionKey: row.session_key,
        recordCount: row.record_count,
        firstTs: row.first_ts,
        lastTs: row.last_ts,
        hasSessionData: hasSession,
      };
    });
  }

  // ── Query operations ──

  searchRecords(query: string, filters?: RecordQueryFilters): RecordQueryResult[] {
    if (!query.trim()) return [];

    const ftsQuery = query
      .replace(/['"]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => `"${term}"`)
      .join(" ");

    if (!ftsQuery) return [];

    const { where: extraWhere, params: extraParams, limitClause } = applyFilters("", [], filters);

    if (this.ftsAvailable) {
      try {
        const sql = `
          SELECT r.*, fts.rank
          FROM meridia_records_fts fts
          JOIN meridia_records r ON r.rowid = fts.rowid
          ${extraWhere ? `${extraWhere} AND` : "WHERE"} meridia_records_fts MATCH ?
          ORDER BY fts.rank
          ${limitClause}
        `;
        const params = [...extraParams, ftsQuery];
        const rows = this.db.prepare(sql).all(...params) as Array<RecordRow & { rank: number }>;
        return rows.map((row) => ({
          record: parseRecord(row),
          rank: row.rank,
        }));
      } catch {
        // Fall through to LIKE fallback
      }
    }

    // LIKE fallback
    const likePattern = `%${query}%`;
    const {
      where,
      params,
      limitClause: lc,
    } = applyFilters(
      "(r.tool_name LIKE ? OR r.reason LIKE ? OR r.data_text LIKE ?)",
      [likePattern, likePattern, likePattern],
      filters,
    );

    const rows = this.db
      .prepare(`
      SELECT r.*
      FROM meridia_records r
      ${where}
      ORDER BY r.ts DESC
      ${lc}
    `)
      .all(...params) as RecordRow[];
    return rows.map((row) => ({ record: parseRecord(row) }));
  }

  getRecordsByDateRange(
    from: string,
    to: string,
    filters?: RecordQueryFilters,
  ): RecordQueryResult[] {
    const { where, params, limitClause } = applyFilters(
      "r.ts >= ? AND r.ts <= ?",
      [from, to],
      filters,
    );

    const rows = this.db
      .prepare(`
      SELECT r.*
      FROM meridia_records r
      ${where}
      ORDER BY r.ts DESC
      ${limitClause}
    `)
      .all(...params) as RecordRow[];
    return rows.map((row) => ({ record: parseRecord(row) }));
  }

  getRecordsBySession(
    sessionKey: string,
    filters?: Omit<RecordQueryFilters, "sessionKey">,
  ): RecordQueryResult[] {
    const { where, params, limitClause } = applyFilters("r.session_key = ?", [sessionKey], {
      ...filters,
      sessionKey: undefined,
    } as RecordQueryFilters);

    const rows = this.db
      .prepare(`
      SELECT r.*
      FROM meridia_records r
      ${where}
      ORDER BY r.ts ASC
      ${limitClause}
    `)
      .all(...params) as RecordRow[];
    return rows.map((row) => ({ record: parseRecord(row) }));
  }

  getRecentRecords(
    limit: number = 20,
    filters?: Omit<RecordQueryFilters, "limit">,
  ): RecordQueryResult[] {
    const { where, params } = applyFilters("", [], filters as RecordQueryFilters);

    const rows = this.db
      .prepare(`
      SELECT r.*
      FROM meridia_records r
      ${where}
      ORDER BY r.ts DESC
      LIMIT ?
    `)
      .all(...params, limit) as RecordRow[];
    return rows.map((row) => ({ record: parseRecord(row) }));
  }

  getRecordsByTool(
    toolName: string,
    filters?: Omit<RecordQueryFilters, "toolName">,
  ): RecordQueryResult[] {
    const { where, params, limitClause } = applyFilters("r.tool_name = ?", [toolName], {
      ...filters,
      toolName: undefined,
    } as RecordQueryFilters);

    const rows = this.db
      .prepare(`
      SELECT r.*
      FROM meridia_records r
      ${where}
      ORDER BY r.ts DESC
      ${limitClause}
    `)
      .all(...params) as RecordRow[];
    return rows.map((row) => ({ record: parseRecord(row) }));
  }

  // ── Aggregate operations ──

  getToolStats(): ToolStatsItem[] {
    const rows = this.db
      .prepare(`
        SELECT
          tool_name,
          COUNT(*) as cnt,
          AVG(score) as avg_score,
          SUM(CASE WHEN is_error = 1 THEN 1 ELSE 0 END) as error_count,
          MAX(ts) as last_used
        FROM meridia_records
        GROUP BY tool_name
        ORDER BY cnt DESC
      `)
      .all() as Array<{
      tool_name: string;
      cnt: number;
      avg_score: number;
      error_count: number;
      last_used: string;
    }>;

    return rows.map((row) => ({
      toolName: row.tool_name,
      count: row.cnt,
      avgScore: row.avg_score,
      errorCount: row.error_count,
      lastUsed: row.last_used,
    }));
  }

  getStats(): DbStats {
    const recordCount = (
      this.db.prepare(`SELECT COUNT(*) as cnt FROM meridia_records`).get() as { cnt: number }
    ).cnt;
    const traceCount = (
      this.db.prepare(`SELECT COUNT(*) as cnt FROM meridia_trace`).get() as { cnt: number }
    ).cnt;
    const sessionCount = (
      this.db.prepare(`SELECT COUNT(*) as cnt FROM meridia_sessions`).get() as { cnt: number }
    ).cnt;
    const oldest = this.db.prepare(`SELECT MIN(ts) as ts FROM meridia_records`).get() as {
      ts: string | null;
    };
    const newest = this.db.prepare(`SELECT MAX(ts) as ts FROM meridia_records`).get() as {
      ts: string | null;
    };
    const version = this.db
      .prepare(`SELECT value FROM meridia_meta WHERE key = 'schema_version'`)
      .get() as { value: string } | undefined;

    return {
      recordCount,
      traceCount,
      sessionCount,
      oldestRecord: oldest?.ts ?? null,
      newestRecord: newest?.ts ?? null,
      schemaVersion: version?.value ?? null,
    };
  }

  // ── Metadata operations ──

  getMeta(key: string): string | null {
    const row = this.db.prepare(`SELECT value FROM meridia_meta WHERE key = ?`).get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  setMeta(key: string, value: string): void {
    this.db
      .prepare(`INSERT OR REPLACE INTO meridia_meta (key, value) VALUES (?, ?)`)
      .run(key, value);
  }
}

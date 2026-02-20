import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import type { DatabaseSync } from "node:sqlite";
import { requireNodeSqlite } from "../../../memory/sqlite.js";
import { ensureDoltStoreSchema } from "./schema.js";
import {
  DOLT_RECORD_LEVELS,
  type DoltActiveLaneEntry,
  type DoltActiveLaneUpsert,
  type DoltBootstrapParams,
  type DoltBootstrapResult,
  type DoltBootstrapTurn,
  type DoltLineageChildInput,
  type DoltLineageEdge,
  type DoltLineageEdgeUpsert,
  type DoltRecord,
  type DoltRecordLevel,
  type DoltRecordUpsert,
  type DoltStore,
} from "./types.js";

type SqliteRowRecord = {
  pointer: string;
  session_id: string;
  session_key: string | null;
  level: string;
  event_ts_ms: number;
  token_count: number;
  payload_json: string | null;
  finalized_at_reset: number;
  created_at_ms: number;
  updated_at_ms: number;
};

type SqliteRowLineage = {
  parent_pointer: string;
  child_pointer: string;
  child_index: number;
  child_level: string;
  created_at_ms: number;
};

type SqliteRowLane = {
  session_id: string;
  session_key: string | null;
  level: string;
  pointer: string;
  is_active: number;
  last_event_ts_ms: number;
  updated_at_ms: number;
};

type JsonlTurn = {
  pointer?: string;
  eventTsMs?: number;
  tokenCount?: number;
  payload?: unknown;
};

/**
 * Parameters to open a persisted SQLite-backed Dolt store.
 */
export type OpenSqliteDoltStoreParams = {
  dbPath: string;
  now?: () => number;
};

/**
 * SQLite-backed canonical store for bounded Dolt rollup lineage.
 */
export class SqliteDoltStore implements DoltStore {
  private readonly db: DatabaseSync;
  private readonly now: () => number;

  constructor(params: { db: DatabaseSync; now?: () => number }) {
    this.db = params.db;
    this.now = params.now ?? (() => Date.now());
    ensureDoltStoreSchema(this.db);
  }

  /**
   * Create or update one persisted record row.
   */
  upsertRecord(params: DoltRecordUpsert): DoltRecord {
    const pointer = requireNonEmptyString(params.pointer, "pointer");
    const sessionId = requireNonEmptyString(params.sessionId, "sessionId");
    const level = requireRecordLevel(params.level);
    const eventTsMs = normalizeTimestampMs(params.eventTsMs, this.now());
    const tokenCount = normalizeNonNegativeInt(params.tokenCount ?? 0, 0);
    const finalizedAtReset = params.finalizedAtReset ? 1 : 0;
    const payloadJson = serializePayload(params.payload);
    const createdAtMs = this.now();
    const updatedAtMs = createdAtMs;

    this.db
      .prepare(
        `
          INSERT INTO dolt_records (
            pointer,
            session_id,
            session_key,
            level,
            event_ts_ms,
            token_count,
            payload_json,
            finalized_at_reset,
            created_at_ms,
            updated_at_ms
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(pointer) DO UPDATE SET
            session_id = excluded.session_id,
            session_key = excluded.session_key,
            level = excluded.level,
            event_ts_ms = excluded.event_ts_ms,
            token_count = excluded.token_count,
            payload_json = excluded.payload_json,
            finalized_at_reset = excluded.finalized_at_reset,
            updated_at_ms = excluded.updated_at_ms
        `,
      )
      .run(
        pointer,
        sessionId,
        normalizeOptionalString(params.sessionKey),
        level,
        eventTsMs,
        tokenCount,
        payloadJson,
        finalizedAtReset,
        createdAtMs,
        updatedAtMs,
      );

    const record = this.getRecord(pointer);
    if (!record) {
      throw new Error(`Failed to read persisted Dolt record after upsert: ${pointer}`);
    }
    return record;
  }

  /**
   * Read one record by pointer.
   */
  getRecord(pointer: string): DoltRecord | null {
    const resolvedPointer = requireNonEmptyString(pointer, "pointer");
    const row = this.db
      .prepare(
        `
          SELECT
            pointer,
            session_id,
            session_key,
            level,
            event_ts_ms,
            token_count,
            payload_json,
            finalized_at_reset,
            created_at_ms,
            updated_at_ms
          FROM dolt_records
          WHERE pointer = ?
          LIMIT 1
        `,
      )
      .get(resolvedPointer) as SqliteRowRecord | undefined;

    return row ? mapRecordRow(row) : null;
  }

  /**
   * List records for a session ordered by event timestamp.
   */
  listRecordsBySession(params: {
    sessionId: string;
    level?: DoltRecordLevel;
    limit?: number;
    newestFirst?: boolean;
  }): DoltRecord[] {
    const sessionId = requireNonEmptyString(params.sessionId, "sessionId");
    const sqlParts = [
      `
        SELECT
          pointer,
          session_id,
          session_key,
          level,
          event_ts_ms,
          token_count,
          payload_json,
          finalized_at_reset,
          created_at_ms,
          updated_at_ms
        FROM dolt_records
        WHERE session_id = ?
      `,
    ];
    const values: Array<string | number> = [sessionId];
    if (params.level) {
      sqlParts.push("AND level = ?");
      values.push(requireRecordLevel(params.level));
    }
    sqlParts.push(
      `ORDER BY event_ts_ms ${params.newestFirst ? "DESC" : "ASC"}, pointer ${params.newestFirst ? "DESC" : "ASC"}`,
    );
    if (typeof params.limit === "number" && Number.isFinite(params.limit) && params.limit > 0) {
      sqlParts.push("LIMIT ?");
      values.push(Math.floor(params.limit));
    }

    const rows = this.db.prepare(sqlParts.join("\n")).all(...values) as SqliteRowRecord[];
    return rows.map((row) => mapRecordRow(row));
  }

  /**
   * Return the number of records for one session.
   */
  countSessionRecords(sessionId: string): number {
    const resolvedSessionId = requireNonEmptyString(sessionId, "sessionId");
    const row = this.db
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM dolt_records
          WHERE session_id = ?
        `,
      )
      .get(resolvedSessionId) as { count: number } | undefined;
    return typeof row?.count === "number" ? row.count : 0;
  }

  /**
   * Upsert a direct lineage edge.
   */
  upsertLineageEdge(params: DoltLineageEdgeUpsert): void {
    const parentPointer = requireNonEmptyString(params.parentPointer, "parentPointer");
    const childPointer = requireNonEmptyString(params.childPointer, "childPointer");
    const childLevel = requireRecordLevel(params.childLevel);
    const childIndex = normalizeNonNegativeInt(params.childIndex, 0);
    const createdAtMs = this.now();

    this.db
      .prepare(
        `
          INSERT INTO dolt_lineage (
            parent_pointer,
            child_pointer,
            child_index,
            child_level,
            created_at_ms
          )
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(parent_pointer, child_pointer) DO UPDATE SET
            child_index = excluded.child_index,
            child_level = excluded.child_level
        `,
      )
      .run(parentPointer, childPointer, childIndex, childLevel, createdAtMs);
  }

  /**
   * Replace all direct children for one parent pointer.
   */
  replaceDirectChildren(params: {
    parentPointer: string;
    children: DoltLineageChildInput[];
  }): void {
    const parentPointer = requireNonEmptyString(params.parentPointer, "parentPointer");
    const children = params.children ?? [];

    this.db.exec("BEGIN");
    try {
      this.db.prepare(`DELETE FROM dolt_lineage WHERE parent_pointer = ?`).run(parentPointer);
      for (let idx = 0; idx < children.length; idx++) {
        const child = children[idx];
        this.upsertLineageEdge({
          parentPointer,
          childPointer: requireNonEmptyString(child.pointer, "children.pointer"),
          childLevel: requireRecordLevel(child.level),
          childIndex: normalizeNonNegativeInt(child.index ?? idx, idx),
        });
      }
      this.db.exec("COMMIT");
    } catch (err) {
      rollbackQuietly(this.db);
      throw err;
    }
  }

  /**
   * List direct child edges for one parent pointer.
   */
  listDirectChildren(parentPointer: string): DoltLineageEdge[] {
    const resolvedParentPointer = requireNonEmptyString(parentPointer, "parentPointer");
    const rows = this.db
      .prepare(
        `
          SELECT parent_pointer, child_pointer, child_index, child_level, created_at_ms
          FROM dolt_lineage
          WHERE parent_pointer = ?
          ORDER BY child_index ASC, child_pointer ASC
        `,
      )
      .all(resolvedParentPointer) as SqliteRowLineage[];

    return rows.map((row) => mapLineageRow(row));
  }

  /**
   * Read direct child records in lineage index order.
   */
  listDirectChildRecords(parentPointer: string): DoltRecord[] {
    const resolvedParentPointer = requireNonEmptyString(parentPointer, "parentPointer");
    const rows = this.db
      .prepare(
        `
          SELECT
            r.pointer,
            r.session_id,
            r.session_key,
            r.level,
            r.event_ts_ms,
            r.token_count,
            r.payload_json,
            r.finalized_at_reset,
            r.created_at_ms,
            r.updated_at_ms
          FROM dolt_lineage l
          JOIN dolt_records r ON r.pointer = l.child_pointer
          WHERE l.parent_pointer = ?
          ORDER BY l.child_index ASC, l.child_pointer ASC
        `,
      )
      .all(resolvedParentPointer) as SqliteRowRecord[];

    return rows.map((row) => mapRecordRow(row));
  }

  /**
   * Upsert one active lane row.
   */
  upsertActiveLane(params: DoltActiveLaneUpsert): void {
    const sessionId = requireNonEmptyString(params.sessionId, "sessionId");
    const level = requireRecordLevel(params.level);
    const pointer = requireNonEmptyString(params.pointer, "pointer");
    const isActive = params.isActive ? 1 : 0;
    const lastEventTsMs = normalizeTimestampMs(params.lastEventTsMs, this.now());
    const updatedAtMs = this.now();

    this.db
      .prepare(
        `
          INSERT INTO dolt_active_lane (
            session_id,
            session_key,
            level,
            pointer,
            is_active,
            last_event_ts_ms,
            updated_at_ms
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(session_id, level, pointer) DO UPDATE SET
            session_key = excluded.session_key,
            is_active = excluded.is_active,
            last_event_ts_ms = excluded.last_event_ts_ms,
            updated_at_ms = excluded.updated_at_ms
        `,
      )
      .run(
        sessionId,
        normalizeOptionalString(params.sessionKey),
        level,
        pointer,
        isActive,
        lastEventTsMs,
        updatedAtMs,
      );
  }

  /**
   * Deactivate all lane pointers for a session+level, optionally excluding one.
   */
  deactivateLevelPointers(params: {
    sessionId: string;
    level: DoltRecordLevel;
    exceptPointer?: string;
  }): void {
    const sessionId = requireNonEmptyString(params.sessionId, "sessionId");
    const level = requireRecordLevel(params.level);
    const updatedAtMs = this.now();
    const lastEventTsMs = updatedAtMs;
    const exceptPointer = normalizeOptionalString(params.exceptPointer);

    if (exceptPointer) {
      this.db
        .prepare(
          `
            UPDATE dolt_active_lane
            SET is_active = 0, updated_at_ms = ?, last_event_ts_ms = ?
            WHERE session_id = ? AND level = ? AND pointer <> ?
          `,
        )
        .run(updatedAtMs, lastEventTsMs, sessionId, level, exceptPointer);
      return;
    }

    this.db
      .prepare(
        `
          UPDATE dolt_active_lane
          SET is_active = 0, updated_at_ms = ?, last_event_ts_ms = ?
          WHERE session_id = ? AND level = ?
        `,
      )
      .run(updatedAtMs, lastEventTsMs, sessionId, level);
  }

  /**
   * List lane rows for one session+level in recency order.
   */
  listActiveLane(params: {
    sessionId: string;
    level: DoltRecordLevel;
    activeOnly?: boolean;
  }): DoltActiveLaneEntry[] {
    const sessionId = requireNonEmptyString(params.sessionId, "sessionId");
    const level = requireRecordLevel(params.level);
    const rows = this.db
      .prepare(
        `
          SELECT session_id, session_key, level, pointer, is_active, last_event_ts_ms, updated_at_ms
          FROM dolt_active_lane
          WHERE session_id = ? AND level = ? AND (? = 0 OR is_active = 1)
          ORDER BY last_event_ts_ms DESC, pointer DESC
        `,
      )
      .all(sessionId, level, params.activeOnly ? 1 : 0) as SqliteRowLane[];

    return rows.map((row) => mapLaneRow(row));
  }

  /**
   * Import turn records from JSONL (or supplied history) for empty sessions.
   */
  async bootstrapFromJsonl(params: DoltBootstrapParams): Promise<DoltBootstrapResult> {
    const sessionId = requireNonEmptyString(params.sessionId, "sessionId");
    const sessionKey = normalizeOptionalString(params.sessionKey);

    if (this.countSessionRecords(sessionId) > 0) {
      return {
        bootstrapped: false,
        importedRecords: 0,
        reason: "session_not_empty",
      };
    }

    const historyTurns = params.historyTurns?.length
      ? normalizeHistoryTurns(params.historyTurns)
      : null;
    const source = historyTurns ? "history" : "jsonl";
    const turns = historyTurns ?? (await readTurnsFromJsonl(params.sessionFile, sessionId));

    if (!turns.length) {
      if (!historyTurns) {
        const sessionExists = await fileExists(params.sessionFile);
        if (!sessionExists) {
          return {
            bootstrapped: false,
            importedRecords: 0,
            reason: "session_file_missing",
          };
        }
      }
      return {
        bootstrapped: false,
        importedRecords: 0,
        reason: "no_turns_found",
      };
    }

    const usedPointers = new Map<string, number>();
    this.db.exec("BEGIN");
    try {
      for (let idx = 0; idx < turns.length; idx++) {
        const turn = turns[idx];
        const pointer = dedupePointer(
          turn.pointer ?? `turn:${sessionId}:bootstrap:${idx + 1}`,
          usedPointers,
        );
        const eventTsMs = normalizeTimestampMs(turn.eventTsMs ?? idx + 1, idx + 1);
        const tokenCount = normalizeNonNegativeInt(turn.tokenCount ?? 0, 0);
        const payload = turn.payload ?? null;

        this.upsertRecord({
          pointer,
          sessionId,
          sessionKey,
          level: "turn",
          eventTsMs,
          tokenCount,
          payload,
          finalizedAtReset: false,
        });
        this.upsertActiveLane({
          sessionId,
          sessionKey,
          level: "turn",
          pointer,
          isActive: true,
          lastEventTsMs: eventTsMs,
        });
      }
      this.db.exec("COMMIT");
    } catch (err) {
      rollbackQuietly(this.db);
      throw err;
    }

    return {
      bootstrapped: true,
      importedRecords: turns.length,
      source,
    };
  }

  /**
   * Close the underlying SQLite connection.
   */
  close(): void {
    this.db.close();
  }
}

/**
 * Open a SQLite Dolt store at the given path and ensure schema is present.
 */
export function openSqliteDoltStore(params: OpenSqliteDoltStoreParams): SqliteDoltStore {
  const dbPath = requireNonEmptyString(params.dbPath, "dbPath");
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const { DatabaseSync } = requireNodeSqlite();
  const db = new DatabaseSync(dbPath);
  return new SqliteDoltStore({ db, now: params.now });
}

function mapRecordRow(row: SqliteRowRecord): DoltRecord {
  return {
    pointer: row.pointer,
    sessionId: row.session_id,
    sessionKey: row.session_key,
    level: requireRecordLevel(row.level),
    eventTsMs: normalizeTimestampMs(row.event_ts_ms, 0),
    tokenCount: normalizeNonNegativeInt(row.token_count, 0),
    payload: deserializePayload(row.payload_json),
    finalizedAtReset: row.finalized_at_reset === 1,
    createdAtMs: normalizeTimestampMs(row.created_at_ms, 0),
    updatedAtMs: normalizeTimestampMs(row.updated_at_ms, 0),
  };
}

function mapLineageRow(row: SqliteRowLineage): DoltLineageEdge {
  return {
    parentPointer: row.parent_pointer,
    childPointer: row.child_pointer,
    childIndex: normalizeNonNegativeInt(row.child_index, 0),
    childLevel: requireRecordLevel(row.child_level),
    createdAtMs: normalizeTimestampMs(row.created_at_ms, 0),
  };
}

function mapLaneRow(row: SqliteRowLane): DoltActiveLaneEntry {
  return {
    sessionId: row.session_id,
    sessionKey: row.session_key,
    level: requireRecordLevel(row.level),
    pointer: row.pointer,
    isActive: row.is_active === 1,
    lastEventTsMs: normalizeTimestampMs(row.last_event_ts_ms, 0),
    updatedAtMs: normalizeTimestampMs(row.updated_at_ms, 0),
  };
}

function serializePayload(payload: unknown): string | null {
  if (payload === undefined) {
    return null;
  }
  return JSON.stringify(payload);
}

function deserializePayload(payloadJson: string | null): unknown {
  if (!payloadJson) {
    return null;
  }
  try {
    return JSON.parse(payloadJson) as unknown;
  } catch {
    return payloadJson;
  }
}

function requireRecordLevel(value: string): DoltRecordLevel {
  if (DOLT_RECORD_LEVELS.includes(value as DoltRecordLevel)) {
    return value as DoltRecordLevel;
  }
  throw new Error(`Invalid Dolt record level: ${value}`);
}

function normalizeNonNegativeInt(value: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
}

function normalizeTimestampMs(value: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function requireNonEmptyString(value: string, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return trimmed;
}

async function readTurnsFromJsonl(sessionFile: string, sessionId: string): Promise<JsonlTurn[]> {
  if (!(await fileExists(sessionFile))) {
    return [];
  }
  const turns: JsonlTurn[] = [];
  const fileStream = fs.createReadStream(sessionFile, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  let lineNumber = 0;
  try {
    for await (const line of rl) {
      lineNumber += 1;
      const parsed = parseJsonLine(line);
      if (!parsed) {
        continue;
      }
      const messageEntry = parseMessageEntry(parsed);
      if (!messageEntry) {
        continue;
      }

      const eventTsMs =
        parseTimestampMs(messageEntry.timestamp) ??
        parseTimestampMs(messageEntry.messageTimestamp) ??
        lineNumber;
      const tokenCount = parseTokenCount(messageEntry.usage);
      const pointer = messageEntry.id ? `turn:${sessionId}:msg:${messageEntry.id}` : undefined;
      const payload = {
        role: messageEntry.role,
        content: messageEntry.content,
        usage: messageEntry.usage,
        source: {
          file: sessionFile,
          line: lineNumber,
          entryId: messageEntry.id,
          parentId: messageEntry.parentId,
        },
      };

      turns.push({
        pointer,
        eventTsMs,
        tokenCount,
        payload,
      });
    }
  } finally {
    rl.close();
    fileStream.destroy();
  }
  return turns;
}

function normalizeHistoryTurns(turns: DoltBootstrapTurn[]): JsonlTurn[] {
  return turns.map((turn) => ({
    pointer: normalizeOptionalString(turn.pointer) ?? undefined,
    eventTsMs:
      typeof turn.eventTsMs === "number" && Number.isFinite(turn.eventTsMs)
        ? turn.eventTsMs
        : undefined,
    tokenCount:
      typeof turn.tokenCount === "number" && Number.isFinite(turn.tokenCount)
        ? turn.tokenCount
        : undefined,
    payload: turn.payload ?? null,
  }));
}

function parseJsonLine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseMessageEntry(entry: Record<string, unknown>): {
  id: string | null;
  parentId: string | null;
  timestamp: string | number | null;
  messageTimestamp: string | number | null;
  role: "user" | "assistant";
  content: unknown;
  usage: unknown;
} | null {
  if (entry.type !== "message") {
    return null;
  }
  const message = toRecord(entry.message);
  if (!message) {
    return null;
  }
  const role = message.role;
  if (role !== "user" && role !== "assistant") {
    return null;
  }

  return {
    id: normalizeOptionalString(typeof entry.id === "string" ? entry.id : null),
    parentId: normalizeOptionalString(typeof entry.parentId === "string" ? entry.parentId : null),
    timestamp: isTimestampValue(entry.timestamp) ? entry.timestamp : null,
    messageTimestamp: isTimestampValue(message.timestamp) ? message.timestamp : null,
    role,
    content: message.content,
    usage: message.usage ?? entry.usage ?? null,
  };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseTimestampMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    const ts = parsed.getTime();
    if (!Number.isNaN(ts)) {
      return ts;
    }
  }
  return null;
}

function isTimestampValue(value: unknown): value is string | number {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  return typeof value === "string" && value.trim().length > 0;
}

function parseTokenCount(usage: unknown): number {
  const usageRecord = toRecord(usage);
  if (!usageRecord) {
    return 0;
  }
  const total = readNumber(usageRecord.total);
  if (typeof total === "number") {
    return Math.max(0, Math.floor(total));
  }

  const input = readNumber(usageRecord.input) ?? 0;
  const output = readNumber(usageRecord.output) ?? 0;
  const cacheRead = readNumber(usageRecord.cacheRead) ?? 0;
  const cacheWrite = readNumber(usageRecord.cacheWrite) ?? 0;
  return Math.max(0, Math.floor(input + output + cacheRead + cacheWrite));
}

function readNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function dedupePointer(pointer: string, seen: Map<string, number>): string {
  const count = seen.get(pointer) ?? 0;
  seen.set(pointer, count + 1);
  if (count === 0) {
    return pointer;
  }
  return `${pointer}:dup:${count}`;
}

function rollbackQuietly(db: DatabaseSync): void {
  try {
    db.exec("ROLLBACK");
  } catch {
    // no-op: best effort rollback only
  }
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

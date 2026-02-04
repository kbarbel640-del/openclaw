/**
 * Meridia Database Backend Interface.
 *
 * Abstracts away the underlying database implementation so Meridia
 * can work with SQLite, PostgreSQL, MySQL, or any other SQL store.
 *
 * All return types use domain types from `./types.ts` and `./query.ts`
 * — no database-driver-specific types leak through this interface.
 */

import type { MeridiaExperienceRecord, MeridiaTraceEvent } from "./types.js";

// ─── Query/Result types (DB-agnostic) ────────────────────────────────

export type RecordQueryResult = {
  /** Parsed experiential record */
  record: MeridiaExperienceRecord;
  /** Search relevance rank (lower = more relevant). Only present for search results. */
  rank?: number;
};

export type RecordQueryFilters = {
  sessionKey?: string;
  toolName?: string;
  minScore?: number;
  maxScore?: number;
  isError?: boolean;
  evalKind?: "heuristic" | "llm";
  limit?: number;
  offset?: number;
};

export type SessionSummary = {
  sessionKey: string;
  startedAt: string | null;
  endedAt: string | null;
  turnCount: number | null;
  toolsUsed: string[];
  topics: string[];
  emotionalArc: unknown;
  summary: string | null;
  recordCount: number;
};

export type SessionListItem = {
  sessionKey: string;
  recordCount: number;
  firstTs: string | null;
  lastTs: string | null;
  hasSessionData: boolean;
};

export type ToolStatsItem = {
  toolName: string;
  count: number;
  avgScore: number;
  errorCount: number;
  lastUsed: string;
};

export type TraceEventResult = {
  event: unknown;
  raw: {
    id: number;
    type: string;
    ts: string;
    session_key: string | null;
    data_json: string;
  };
};

export type DbStats = {
  recordCount: number;
  traceCount: number;
  sessionCount: number;
  oldestRecord: string | null;
  newestRecord: string | null;
  schemaVersion: string | null;
};

export type SessionUpsertInput = {
  sessionKey: string;
  startedAt?: string;
  endedAt?: string;
  turnCount?: number;
  toolsUsed?: string[];
  topics?: string[];
  emotionalArc?: unknown;
  summary?: string;
};

export type MetaEntry = {
  key: string;
  value: string;
};

// ─── Backend Interface ───────────────────────────────────────────────

/**
 * The pluggable database backend for Meridia.
 *
 * Implementations MUST:
 * - Handle schema creation/migration in `ensureSchema()`
 * - Use `INSERT OR IGNORE` semantics for records (deduplicate by id)
 * - Provide full-text search via `searchRecords()` (FTS5, FULLTEXT, tsvector, etc.)
 * - Support transactions for batch operations
 * - Be safe for concurrent reads (e.g., WAL mode for SQLite)
 */
export interface MeridiaDbBackend {
  // ── Lifecycle ──

  /** Ensure the database schema is created and up to date. */
  ensureSchema(): { ftsAvailable: boolean; ftsError?: string };

  /** Close the database connection. */
  close(): void;

  // ── Record operations ──

  /** Insert a single experiential record. Returns true if inserted (false = duplicate). */
  insertRecord(record: MeridiaExperienceRecord): boolean;

  /** Insert multiple records in a transaction. Returns count of newly inserted. */
  insertRecordsBatch(records: MeridiaExperienceRecord[]): number;

  /** Get a single record by ID. */
  getRecordById(id: string): RecordQueryResult | null;

  // ── Trace event operations ──

  /** Insert a single trace event. */
  insertTraceEvent(event: MeridiaTraceEvent): void;

  /** Insert multiple trace events in a transaction. Returns count inserted. */
  insertTraceEventsBatch(events: MeridiaTraceEvent[]): number;

  /** Get trace events with filters. */
  getTraceEvents(params: {
    sessionKey?: string;
    type?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): TraceEventResult[];

  // ── Session operations ──

  /** Upsert a session summary. */
  upsertSession(session: SessionUpsertInput): void;

  /** Get a session summary with record count. */
  getSessionSummary(sessionKey: string): SessionSummary | null;

  /** List sessions with basic stats. */
  listSessions(params?: { limit?: number; offset?: number }): SessionListItem[];

  // ── Query operations ──

  /** Full-text search over experiential records. */
  searchRecords(query: string, filters?: RecordQueryFilters): RecordQueryResult[];

  /** Get records within a date range (inclusive). */
  getRecordsByDateRange(
    from: string,
    to: string,
    filters?: RecordQueryFilters,
  ): RecordQueryResult[];

  /** Get all records for a specific session. */
  getRecordsBySession(
    sessionKey: string,
    filters?: Omit<RecordQueryFilters, "sessionKey">,
  ): RecordQueryResult[];

  /** Get the most recent records. */
  getRecentRecords(
    limit?: number,
    filters?: Omit<RecordQueryFilters, "limit">,
  ): RecordQueryResult[];

  /** Get records for a specific tool. */
  getRecordsByTool(
    toolName: string,
    filters?: Omit<RecordQueryFilters, "toolName">,
  ): RecordQueryResult[];

  // ── Aggregate operations ──

  /** Get aggregate statistics by tool name. */
  getToolStats(): ToolStatsItem[];

  /** Get database-wide statistics. */
  getStats(): DbStats;

  // ── Metadata operations ──

  /** Get a metadata value by key. */
  getMeta(key: string): string | null;

  /** Set a metadata key/value pair. */
  setMeta(key: string, value: string): void;
}

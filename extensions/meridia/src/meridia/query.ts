import type { DatabaseSync } from "node:sqlite";
import type { MeridiaExperienceRecordV2, MeridiaTraceEventV2 } from "./types.js";

export type RecordQueryFiltersV2 = {
  sessionKey?: string;
  toolName?: string;
  minScore?: number;
  from?: string;
  to?: string;
  limit?: number;
  tag?: string;
};

export type RecordQueryResultV2 = {
  record: MeridiaExperienceRecordV2;
  rank?: number;
};

function parseRecordJson(raw: string): MeridiaExperienceRecordV2 {
  return JSON.parse(raw) as MeridiaExperienceRecordV2;
}

function parseTraceJson(raw: string): MeridiaTraceEventV2 {
  return JSON.parse(raw) as MeridiaTraceEventV2;
}

function tableExists(db: DatabaseSync, name: string): boolean {
  try {
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`)
      .get(name) as { name?: string } | undefined;
    return Boolean(row?.name);
  } catch {
    return false;
  }
}

function applyFilters(filters?: RecordQueryFiltersV2): { where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

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
  if (filters?.from) {
    conditions.push("r.ts >= ?");
    params.push(filters.from);
  }
  if (filters?.to) {
    conditions.push("r.ts <= ?");
    params.push(filters.to);
  }
  if (filters?.tag) {
    conditions.push("r.tags_json LIKE ?");
    params.push(`%\"${filters.tag.replaceAll('"', "")}\"%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

export function searchRecords(
  db: DatabaseSync,
  query: string,
  filters?: RecordQueryFiltersV2,
): RecordQueryResultV2[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const limit = Math.min(Math.max(filters?.limit ?? 20, 1), 100);
  const hasFts = tableExists(db, "meridia_records_v2_fts");
  const { where, params } = applyFilters(filters);

  if (hasFts) {
    const rows = db
      .prepare(
        `
        SELECT r.data_json AS data_json, bm25(meridia_records_v2_fts) AS rank
        FROM meridia_records_v2_fts
        JOIN meridia_records_v2 r ON meridia_records_v2_fts.rowid = r.rowid
        ${where ? `${where} AND meridia_records_v2_fts MATCH ?` : "WHERE meridia_records_v2_fts MATCH ?"}
        ORDER BY rank ASC
        LIMIT ${limit}
      `,
      )
      .all(...params, trimmed) as Array<{ data_json: string; rank: number }>;

    return rows.map((row) => ({ record: parseRecordJson(row.data_json), rank: row.rank }));
  }

  const like = `%${trimmed}%`;
  const rows = db
    .prepare(
      `
      SELECT r.data_json AS data_json
      FROM meridia_records_v2 r
      ${where ? `${where} AND (r.data_text LIKE ? OR r.eval_reason LIKE ?)` : "WHERE (r.data_text LIKE ? OR r.eval_reason LIKE ?)"}
      ORDER BY r.ts DESC
      LIMIT ${limit}
    `,
    )
    .all(...params, like, like) as Array<{ data_json: string }>;

  return rows.map((row) => ({ record: parseRecordJson(row.data_json) }));
}

export function getRecordsByDateRange(
  db: DatabaseSync,
  from: string,
  to: string,
  filters?: Omit<RecordQueryFiltersV2, "from" | "to">,
): RecordQueryResultV2[] {
  const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 500);
  const merged: RecordQueryFiltersV2 = { ...filters, from, to, limit };
  const { where, params } = applyFilters(merged);

  const rows = db
    .prepare(
      `
      SELECT r.data_json AS data_json
      FROM meridia_records_v2 r
      ${where}
      ORDER BY r.ts DESC
      LIMIT ${limit}
    `,
    )
    .all(...params) as Array<{ data_json: string }>;

  return rows.map((row) => ({ record: parseRecordJson(row.data_json) }));
}

export function getRecentRecords(
  db: DatabaseSync,
  limit: number = 20,
  filters?: Omit<RecordQueryFiltersV2, "limit">,
): RecordQueryResultV2[] {
  const resolved = Math.min(Math.max(limit, 1), 200);
  const { where, params } = applyFilters({ ...filters, limit: resolved });
  const rows = db
    .prepare(
      `
      SELECT r.data_json AS data_json
      FROM meridia_records_v2 r
      ${where}
      ORDER BY r.ts DESC
      LIMIT ${resolved}
    `,
    )
    .all(...params) as Array<{ data_json: string }>;
  return rows.map((row) => ({ record: parseRecordJson(row.data_json) }));
}

export function getRecordsBySession(
  db: DatabaseSync,
  sessionKey: string,
  limit: number = 200,
): RecordQueryResultV2[] {
  const resolved = Math.min(Math.max(limit, 1), 500);
  const rows = db
    .prepare(
      `
      SELECT r.data_json AS data_json
      FROM meridia_records_v2 r
      WHERE r.session_key = ?
      ORDER BY r.ts DESC
      LIMIT ${resolved}
    `,
    )
    .all(sessionKey) as Array<{ data_json: string }>;
  return rows.map((row) => ({ record: parseRecordJson(row.data_json) }));
}

export function getRecordsByTool(
  db: DatabaseSync,
  toolName: string,
  limit: number = 200,
): RecordQueryResultV2[] {
  const resolved = Math.min(Math.max(limit, 1), 500);
  const rows = db
    .prepare(
      `
      SELECT r.data_json AS data_json
      FROM meridia_records_v2 r
      WHERE r.tool_name = ?
      ORDER BY r.ts DESC
      LIMIT ${resolved}
    `,
    )
    .all(toolName) as Array<{ data_json: string }>;
  return rows.map((row) => ({ record: parseRecordJson(row.data_json) }));
}

export function getTraceEventsByDateRange(
  db: DatabaseSync,
  from: string,
  to: string,
  params?: { kind?: string; limit?: number },
): MeridiaTraceEventV2[] {
  const limit = Math.min(Math.max(params?.limit ?? 2000, 1), 50_000);
  const kind = params?.kind?.trim();
  const rows = kind
    ? (db
        .prepare(
          `
          SELECT data_json
          FROM meridia_trace_v2
          WHERE ts >= ? AND ts <= ? AND kind = ?
          ORDER BY ts DESC
          LIMIT ${limit}
        `,
        )
        .all(from, to, kind) as Array<{ data_json: string }>)
    : (db
        .prepare(
          `
          SELECT data_json
          FROM meridia_trace_v2
          WHERE ts >= ? AND ts <= ?
          ORDER BY ts DESC
          LIMIT ${limit}
        `,
        )
        .all(from, to) as Array<{ data_json: string }>);

  return rows.map((row) => parseTraceJson(row.data_json));
}

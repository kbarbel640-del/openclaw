/**
 * Supported record levels for the bounded Dolt lineage graph.
 */
export const DOLT_RECORD_LEVELS = ["turn", "leaf", "bindle"] as const;

export type DoltRecordLevel = (typeof DOLT_RECORD_LEVELS)[number];

/**
 * Canonical token counting methods persisted for each record.
 */
export const DOLT_TOKEN_COUNT_METHODS = ["estimateTokens", "fallback"] as const;

export type DoltTokenCountMethod = (typeof DOLT_TOKEN_COUNT_METHODS)[number];

/**
 * Canonical persisted record for turn/leaf/bindle units.
 */
export type DoltRecord = {
  pointer: string;
  sessionId: string;
  sessionKey: string | null;
  level: DoltRecordLevel;
  eventTsMs: number;
  tokenCount: number;
  tokenCountMethod: DoltTokenCountMethod;
  payload: unknown;
  finalizedAtReset: boolean;
  createdAtMs: number;
  updatedAtMs: number;
};

/**
 * Input shape for create/update of a persisted record.
 */
export type DoltRecordUpsert = {
  pointer: string;
  sessionId: string;
  sessionKey?: string | null;
  level: DoltRecordLevel;
  eventTsMs: number;
  payload?: unknown;
  finalizedAtReset?: boolean;
};

/**
 * Direct parent->child lineage edge.
 */
export type DoltLineageEdge = {
  parentPointer: string;
  childPointer: string;
  childIndex: number;
  childLevel: DoltRecordLevel;
  createdAtMs: number;
};

/**
 * Child row input used when replacing all children for a parent pointer.
 */
export type DoltLineageChildInput = {
  pointer: string;
  level: DoltRecordLevel;
  index?: number;
};

/**
 * Input for directly writing/updating one lineage edge.
 */
export type DoltLineageEdgeUpsert = {
  parentPointer: string;
  childPointer: string;
  childIndex: number;
  childLevel: DoltRecordLevel;
};

/**
 * Active lane marker row for one pointer.
 */
export type DoltActiveLaneEntry = {
  sessionId: string;
  sessionKey: string | null;
  level: DoltRecordLevel;
  pointer: string;
  isActive: boolean;
  lastEventTsMs: number;
  updatedAtMs: number;
};

/**
 * Input for upserting lane state.
 */
export type DoltActiveLaneUpsert = {
  sessionId: string;
  sessionKey?: string | null;
  level: DoltRecordLevel;
  pointer: string;
  isActive: boolean;
  lastEventTsMs: number;
};

/**
 * Optional pre-read turn units used by bootstrap when a caller already has
 * session history loaded and does not want to re-read JSONL from disk.
 */
export type DoltBootstrapTurn = {
  pointer?: string;
  eventTsMs?: number;
  payload?: unknown;
};

/**
 * Parameters for initial session bootstrap import into Dolt store.
 */
export type DoltBootstrapParams = {
  sessionId: string;
  sessionKey?: string | null;
  sessionFile: string;
  historyTurns?: DoltBootstrapTurn[];
};

export type DoltBootstrapReason = "session_not_empty" | "session_file_missing" | "no_turns_found";

/**
 * Result payload for bootstrap import calls.
 */
export type DoltBootstrapResult = {
  bootstrapped: boolean;
  importedRecords: number;
  reason?: DoltBootstrapReason;
  source?: "jsonl" | "history";
};

/**
 * Primary persistence contract used by the bounded Dolt context engine.
 */
export interface DoltStore {
  /**
   * Create or update one persisted turn/leaf/bindle record.
   */
  upsertRecord(params: DoltRecordUpsert): DoltRecord;

  /**
   * Read one persisted record by pointer.
   */
  getRecord(pointer: string): DoltRecord | null;

  /**
   * Read records for one session ordered by event timestamp.
   */
  listRecordsBySession(params: {
    sessionId: string;
    level?: DoltRecordLevel;
    limit?: number;
    newestFirst?: boolean;
  }): DoltRecord[];

  /**
   * Return how many records currently exist for a session.
   */
  countSessionRecords(sessionId: string): number;

  /**
   * Create or update one direct lineage edge.
   */
  upsertLineageEdge(params: DoltLineageEdgeUpsert): void;

  /**
   * Replace all direct children for a given parent pointer.
   */
  replaceDirectChildren(params: { parentPointer: string; children: DoltLineageChildInput[] }): void;

  /**
   * List all direct children edges for a parent ordered by child index.
   */
  listDirectChildren(parentPointer: string): DoltLineageEdge[];

  /**
   * Read direct child records in chronological child index order.
   */
  listDirectChildRecords(parentPointer: string): DoltRecord[];

  /**
   * Upsert one lane pointer activity row.
   */
  upsertActiveLane(params: DoltActiveLaneUpsert): void;

  /**
   * Mark all pointers for a session+level inactive, optionally preserving one.
   */
  deactivateLevelPointers(params: {
    sessionId: string;
    level: DoltRecordLevel;
    exceptPointer?: string;
  }): void;

  /**
   * List lane pointers for a session+level in recency order.
   */
  listActiveLane(params: {
    sessionId: string;
    level: DoltRecordLevel;
    activeOnly?: boolean;
  }): DoltActiveLaneEntry[];

  /**
   * Import turns from JSONL/history only when no records yet exist for session.
   */
  bootstrapFromJsonl(params: DoltBootstrapParams): Promise<DoltBootstrapResult>;

  /**
   * Dispose persistent resources.
   */
  close(): void;
}

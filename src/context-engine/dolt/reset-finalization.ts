import { createHash } from "node:crypto";
import type {
  DoltLanePolicies,
  DoltLanePolicyOverrides,
  DoltTurnChunkCandidate,
} from "./policy.js";
import type { DoltPromptOverrides } from "./prompts.js";
import type { DoltRecord, DoltRecordLevel, DoltStore } from "./store/types.js";
import { resolveDoltLanePolicies, selectDoltTurnChunkForCompaction } from "./policy.js";
import { executeDoltRollup, type DoltRollupResult } from "./rollup.js";
import {
  DOLT_LEAF_MIN_SOURCE_TURNS,
  summarizeDoltRollup,
  type DoltSummarizeParams,
  type DoltSummarizeResult,
} from "./summarizer.js";
import { collectDoltActiveLaneSnapshot, emitDoltTelemetryEvent } from "./telemetry.js";

export const DOLT_RESET_MIN_TURN_SOURCE_FLOOR = DOLT_LEAF_MIN_SOURCE_TURNS;
export const DOLT_RESET_MIN_LEAF_SOURCE_FLOOR = 2;
export const DOLT_RESET_COMPACTION_MAX_PASSES = 256;

export type DoltResetFinalizeParams = {
  store: DoltStore;
  sessionId: string;
  sessionKey?: string | null;
  ingestMissingTail?: () => Promise<number> | number;
  lanePolicies?: DoltLanePolicies;
  lanePolicyOverrides?: DoltLanePolicyOverrides;
  minTurnSourceFloor?: number;
  minLeafSourceFloor?: number;
  maxCompactionPasses?: number;
  summarize?: (params: DoltSummarizeParams) => Promise<DoltSummarizeResult>;
  promptOverrides?: DoltPromptOverrides;
  provider?: string;
  model?: string;
  providerOverride?: string;
  modelOverride?: string;
  config?: DoltSummarizeParams["config"];
  authProfileId?: DoltSummarizeParams["authProfileId"];
  agentDir?: DoltSummarizeParams["agentDir"];
  workspaceDir?: DoltSummarizeParams["workspaceDir"];
  runPrompt?: DoltSummarizeParams["runPrompt"];
  executeRollup?: (params: Parameters<typeof executeDoltRollup>[0]) => Promise<DoltRollupResult>;
};

export type DoltResetFinalizeResult = {
  ingestedTailCount: number;
  turnToLeafRollups: number;
  leafToBindleRollups: number;
  shortBindleCreated: boolean;
  shortBindlePointer?: string;
  residualBeforeShortBindle: {
    turns: string[];
    leaves: string[];
  };
  activeAfterFinalize: {
    bindles: string[];
    leaves: string[];
    turns: string[];
  };
};

/**
 * Run deterministic reset finalization over active Dolt turns/leaves.
 *
 * Ordered reset sequence:
 * 1. ingest missing tail
 * 2. force turn->leaf compaction until stable/floor
 * 3. force leaf->bindle compaction until stable/floor
 * 4. emit reset short bindle from residual turns/leaves
 * 5. persist final active-lane state with no bindle->bindle aggregation
 */
export async function finalizeDoltReset(
  params: DoltResetFinalizeParams,
): Promise<DoltResetFinalizeResult> {
  const sessionId = requireNonEmptyString(params.sessionId, "sessionId");
  const sessionKey = normalizeOptionalString(params.sessionKey);
  const lanePolicies =
    params.lanePolicies ?? resolveDoltLanePolicies(params.lanePolicyOverrides ?? undefined);
  const minTurnSourceFloor = normalizeFloor(
    params.minTurnSourceFloor ?? DOLT_RESET_MIN_TURN_SOURCE_FLOOR,
    DOLT_RESET_MIN_TURN_SOURCE_FLOOR,
  );
  const minLeafSourceFloor = normalizeFloor(
    params.minLeafSourceFloor ?? DOLT_RESET_MIN_LEAF_SOURCE_FLOOR,
    DOLT_RESET_MIN_LEAF_SOURCE_FLOOR,
  );
  const maxCompactionPasses = normalizeFloor(
    params.maxCompactionPasses ?? DOLT_RESET_COMPACTION_MAX_PASSES,
    DOLT_RESET_COMPACTION_MAX_PASSES,
  );
  const summarize = params.summarize ?? summarizeDoltRollup;
  const executeRollup = params.executeRollup ?? executeDoltRollup;

  // Step 1: ingest any missing tail before compaction decisions are made.
  const ingestedTailCount = normalizeNonNegativeInt(await params.ingestMissingTail?.(), 0);

  // Step 2: force turn->leaf compaction while selection can meet the floor.
  let turnToLeafRollups = 0;
  let turnToLeafConvergenceLoops = 0;
  for (let pass = 0; pass < maxCompactionPasses; pass += 1) {
    turnToLeafConvergenceLoops += 1;
    const activeTurns = listActiveRecords({
      store: params.store,
      sessionId,
      level: "turn",
    });
    if (activeTurns.length < minTurnSourceFloor) {
      break;
    }
    const selection = selectTurnSources({
      turns: activeTurns,
      lanePolicy: lanePolicies.turn,
      minTurnSourceFloor,
    });
    if (selection.length < minTurnSourceFloor) {
      break;
    }

    await executeRollup({
      store: params.store,
      sessionId,
      sessionKey,
      targetLevel: "leaf",
      sourceRecords: selection,
      mode: "leaf",
      provider: params.provider,
      model: params.model,
      providerOverride: params.providerOverride,
      modelOverride: params.modelOverride,
      config: params.config,
      summarize,
    });
    turnToLeafRollups += 1;
  }
  assertCompactionPassLimit({
    rollupCount: turnToLeafRollups,
    maxCompactionPasses,
    lane: "turn->leaf",
  });

  // Step 3: force leaf->bindle compaction while selection can meet the floor.
  let leafToBindleRollups = 0;
  let leafToBindleConvergenceLoops = 0;
  for (let pass = 0; pass < maxCompactionPasses; pass += 1) {
    leafToBindleConvergenceLoops += 1;
    const activeLeaves = listActiveRecords({
      store: params.store,
      sessionId,
      level: "leaf",
    });
    if (activeLeaves.length < minLeafSourceFloor) {
      break;
    }
    const sourceRecords = activeLeaves.slice(0, minLeafSourceFloor);
    await executeRollup({
      store: params.store,
      sessionId,
      sessionKey,
      targetLevel: "bindle",
      sourceRecords,
      mode: "bindle",
      provider: params.provider,
      model: params.model,
      providerOverride: params.providerOverride,
      modelOverride: params.modelOverride,
      config: params.config,
      summarize,
    });
    leafToBindleRollups += 1;
  }
  assertCompactionPassLimit({
    rollupCount: leafToBindleRollups,
    maxCompactionPasses,
    lane: "leaf->bindle",
  });

  // Step 4: fold any residual turns/leaves into one reset short bindle.
  const residualTurns = listActiveRecords({
    store: params.store,
    sessionId,
    level: "turn",
  });
  const residualLeaves = listActiveRecords({
    store: params.store,
    sessionId,
    level: "leaf",
  });
  let shortBindlePointer: string | undefined;
  if (residualTurns.length > 0 || residualLeaves.length > 0) {
    const residualRecords = [...residualLeaves, ...residualTurns].toSorted(
      (a, b) => a.eventTsMs - b.eventTsMs || a.pointer.localeCompare(b.pointer),
    );
    const childPointers = residualRecords.map((record) => record.pointer);
    const firstSource = residualRecords[0];
    const lastSource = residualRecords[residualRecords.length - 1];
    const sourceTokenStats = buildSourceTokenStats(residualRecords);
    emitDoltTelemetryEvent({
      event_type: "dolt_reset_summary_quality",
      session_id: sessionId,
      session_key: sessionKey ?? undefined,
      payload: {
        summary_mode: "reset-short-bindle",
        source_record_count: residualRecords.length,
        source_turn_count: residualTurns.length,
        source_leaf_count: residualLeaves.length,
        source_token_total: sourceTokenStats.total,
        source_token_min: sourceTokenStats.min,
        source_token_max: sourceTokenStats.max,
        reset_forced_summary_count: 1,
      },
    });
    const summary = await summarize({
      sourceTurns: residualRecords.map(toSummarySourceTurn),
      mode: "reset-short-bindle",
      datesCovered: {
        startEpochMs: firstSource.eventTsMs,
        endEpochMs: lastSource.eventTsMs,
      },
      childPointers,
      finalizedAtReset: true,
      promptOverrides: params.promptOverrides,
      provider: params.provider,
      model: params.model,
      providerOverride: params.providerOverride,
      modelOverride: params.modelOverride,
      config: params.config,
      authProfileId: params.authProfileId,
      agentDir: params.agentDir,
      workspaceDir: params.workspaceDir,
      runPrompt: params.runPrompt,
    });

    const pointer = buildResetShortBindlePointer({
      sessionId,
      childPointers,
      endEpochMs: lastSource.eventTsMs,
    });
    const parentRecord = params.store.upsertRecord({
      pointer,
      sessionId,
      sessionKey,
      level: "bindle",
      eventTsMs: lastSource.eventTsMs,
      payload: {
        summary: summary.summary,
        metadata: summary.metadata,
        modelSelection: summary.modelSelection,
        sourcePointers: childPointers,
        sourceLevels: residualRecords.map((record) => ({
          pointer: record.pointer,
          level: record.level,
        })),
      },
      finalizedAtReset: true,
    });
    shortBindlePointer = parentRecord.pointer;

    // Bindle lineage remains leaf-only; turns stay traceable in sourcePointers.
    params.store.replaceDirectChildren({
      parentPointer: parentRecord.pointer,
      children: residualLeaves.map((record, index) => ({
        pointer: record.pointer,
        level: "leaf",
        index,
      })),
    });
    params.store.upsertActiveLane({
      sessionId,
      sessionKey,
      level: "bindle",
      pointer: parentRecord.pointer,
      isActive: true,
      lastEventTsMs: parentRecord.eventTsMs,
    });
    for (const residual of residualRecords) {
      params.store.upsertActiveLane({
        sessionId,
        sessionKey: residual.sessionKey,
        level: residual.level,
        pointer: residual.pointer,
        isActive: false,
        lastEventTsMs: parentRecord.eventTsMs,
      });
    }
  }

  // Step 5: return persisted final state snapshot for lifecycle callers.
  const activeAfterFinalize = {
    bindles: listActivePointers(params.store, sessionId, "bindle"),
    leaves: listActivePointers(params.store, sessionId, "leaf"),
    turns: listActivePointers(params.store, sessionId, "turn"),
  };
  const laneActiveSnapshot = collectDoltActiveLaneSnapshot({
    store: params.store,
    sessionId,
  });
  const shortBindleCreated = typeof shortBindlePointer === "string";
  emitDoltTelemetryEvent({
    event_type: "dolt_reset_finalization_completed",
    session_id: sessionId,
    session_key: sessionKey ?? undefined,
    payload: {
      ingested_tail_count: ingestedTailCount,
      turn_to_leaf_rollups: turnToLeafRollups,
      leaf_to_bindle_rollups: leafToBindleRollups,
      turn_to_leaf_convergence_loops: turnToLeafConvergenceLoops,
      leaf_to_bindle_convergence_loops: leafToBindleConvergenceLoops,
      short_bindle_created: shortBindleCreated,
      short_bindle_created_count: shortBindleCreated ? 1 : 0,
      residual_turn_count: residualTurns.length,
      residual_leaf_count: residualLeaves.length,
      lane_active_record_counts: laneActiveSnapshot.lane_active_record_counts,
      lane_active_token_totals: laneActiveSnapshot.lane_active_token_totals,
    },
  });

  return {
    ingestedTailCount,
    turnToLeafRollups,
    leafToBindleRollups,
    shortBindleCreated,
    shortBindlePointer,
    residualBeforeShortBindle: {
      turns: residualTurns.map((record) => record.pointer),
      leaves: residualLeaves.map((record) => record.pointer),
    },
    activeAfterFinalize,
  };
}

function selectTurnSources(params: {
  turns: DoltRecord[];
  lanePolicy: DoltLanePolicies["turn"];
  minTurnSourceFloor: number;
}): DoltRecord[] {
  const turns = params.turns.toSorted(
    (a, b) => a.eventTsMs - b.eventTsMs || a.pointer.localeCompare(b.pointer),
  );
  const laneTokenCount = turns.reduce((sum, turn) => sum + turn.tokenCount, 0);
  const candidates: DoltTurnChunkCandidate[] = turns.map((turn) => ({
    pointer: turn.pointer,
    tokenCount: turn.tokenCount,
  }));
  const selection = selectDoltTurnChunkForCompaction({
    turns: candidates,
    laneTokenCount,
    policy: params.lanePolicy,
    minChunkTurns: params.minTurnSourceFloor,
  });
  if (selection.selected.length < params.minTurnSourceFloor) {
    return [];
  }
  const selectedPointers = new Set(selection.selected.map((entry) => entry.pointer));
  return turns.filter((turn) => selectedPointers.has(turn.pointer));
}

function listActivePointers(store: DoltStore, sessionId: string, level: DoltRecordLevel): string[] {
  return store
    .listActiveLane({
      sessionId,
      level,
      activeOnly: true,
    })
    .map((entry) => entry.pointer);
}

function listActiveRecords(params: {
  store: DoltStore;
  sessionId: string;
  level: DoltRecordLevel;
}): DoltRecord[] {
  const pointers = params.store.listActiveLane({
    sessionId: params.sessionId,
    level: params.level,
    activeOnly: true,
  });
  return pointers
    .map((entry) => params.store.getRecord(entry.pointer))
    .filter((record): record is DoltRecord => !!record)
    .filter((record) => record.sessionId === params.sessionId && record.level === params.level)
    .toSorted((a, b) => a.eventTsMs - b.eventTsMs || a.pointer.localeCompare(b.pointer));
}

function toSummarySourceTurn(record: DoltRecord): DoltSummarizeParams["sourceTurns"][number] {
  const payload = toRecord(record.payload);
  const summaryText = typeof payload?.summary === "string" ? payload.summary : null;
  const role = typeof payload?.role === "string" ? payload.role : "assistant";
  const contentCandidate =
    summaryText ??
    (payload && "content" in payload ? (payload as { content?: unknown }).content : record.payload);

  return {
    pointer: record.pointer,
    role,
    content: stringifyContent(contentCandidate),
    timestampMs: record.eventTsMs,
    safetyRelevantToolOutcome:
      typeof payload?.safetyRelevantToolOutcome === "boolean"
        ? payload.safetyRelevantToolOutcome
        : undefined,
  };
}

function buildResetShortBindlePointer(params: {
  sessionId: string;
  childPointers: string[];
  endEpochMs: number;
}): string {
  const digest = createHash("sha256")
    .update([params.sessionId, String(params.endEpochMs), ...params.childPointers].join("|"))
    .digest("hex")
    .slice(0, 12);
  return `bindle:${params.sessionId}:reset:${params.endEpochMs}:${digest}`;
}

function stringifyContent(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    const parts = value.map((entry) => {
      if (!entry || typeof entry !== "object") {
        return "";
      }
      const text = (entry as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    });
    const joined = parts.join("").trim();
    if (joined) {
      return joined;
    }
  }
  return safeJsonStringify(value);
}

function safeJsonStringify(value: unknown): string {
  if (value === undefined) {
    return "";
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function assertCompactionPassLimit(params: {
  rollupCount: number;
  maxCompactionPasses: number;
  lane: string;
}): void {
  if (params.rollupCount >= params.maxCompactionPasses) {
    throw new Error(
      `Dolt reset finalization exceeded max compaction passes (${params.maxCompactionPasses}) for ${params.lane}.`,
    );
  }
}

function normalizeFloor(value: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.floor(value));
}

function normalizeNonNegativeInt(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
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

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function buildSourceTokenStats(records: DoltRecord[]): { total: number; min: number; max: number } {
  if (records.length === 0) {
    return {
      total: 0,
      min: 0,
      max: 0,
    };
  }
  let total = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const record of records) {
    const tokenCount = normalizeNonNegativeInt(record.tokenCount, 0);
    total += tokenCount;
    min = Math.min(min, tokenCount);
    max = Math.max(max, tokenCount);
  }
  return {
    total,
    min: Number.isFinite(min) ? min : 0,
    max,
  };
}

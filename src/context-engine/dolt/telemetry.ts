import type { DoltRecord, DoltRecordLevel, DoltStore } from "./store/types.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("context-engine/dolt/telemetry");
const DOLT_LANE_LEVELS = ["turn", "leaf", "bindle"] as const satisfies DoltRecordLevel[];

export type DoltLaneLevelTotals = {
  turn: number;
  leaf: number;
  bindle: number;
};

export type DoltActiveLaneSnapshot = {
  lane_active_record_counts: DoltLaneLevelTotals;
  lane_active_token_totals: DoltLaneLevelTotals;
};

type DoltTelemetryPayloadMap = {
  dolt_lane_pressure_decision: {
    lane_token_total: number;
    should_compact: boolean;
    trigger_path: "none" | "soft_delta" | "hard_limit_bypass" | "drain";
    next_drain_mode: boolean;
    soft_trigger_threshold: number;
    pressure_delta: number;
    drain_mode: boolean;
    hard_limit_safety_mode: boolean;
  };
  dolt_turn_chunk_selection: {
    lane_token_total: number;
    pressure_delta: number;
    max_selectable_count: number;
    selected_count: number;
    selected_token_total: number;
    fresh_tail_preserved_count: number;
    fresh_tail_preserved_token_total: number;
    min_chunk_turns: number;
    fresh_tail_min_turns: number;
    fresh_tail_token_limit: number;
  };
  dolt_assembly_snapshot: {
    token_budget: number;
    runtime_reserve_tokens: number;
    available_tokens: number;
    lane_budget_tokens: DoltLaneLevelTotals;
    lane_selected_record_counts: DoltLaneLevelTotals;
    lane_selected_token_totals: DoltLaneLevelTotals;
    lane_active_record_counts: DoltLaneLevelTotals;
    lane_active_token_totals: DoltLaneLevelTotals;
  };
  dolt_bootstrap_hydration: {
    hydrated: boolean;
    activated_pointer_counts: DoltLaneLevelTotals;
    lane_active_record_counts: DoltLaneLevelTotals;
    lane_active_token_totals: DoltLaneLevelTotals;
  };
  dolt_rollup_summary_quality: {
    target_level: "leaf" | "bindle";
    source_level: DoltRecordLevel;
    summary_mode: string;
    source_record_count: number;
    source_token_total: number;
    source_token_min: number;
    source_token_max: number;
    reset_forced_summary_count: number;
    finalized_at_reset: boolean;
  };
  dolt_rollup_completed: {
    target_level: "leaf" | "bindle";
    parent_pointer: string;
    child_pointer_count: number;
    bindle_eviction_count: number;
    bindle_eviction_target_tokens: number | null;
    lane_active_before_record_counts: DoltLaneLevelTotals;
    lane_active_before_token_totals: DoltLaneLevelTotals;
    lane_active_after_record_counts: DoltLaneLevelTotals;
    lane_active_after_token_totals: DoltLaneLevelTotals;
  };
  dolt_bindle_eviction: {
    target_tokens: number;
    evicted_count: number;
    before_active_count: number;
    before_total_tokens: number;
    before_oldest_pointer: string | null;
    before_oldest_recency_ts_ms: number | null;
    before_newest_pointer: string | null;
    before_newest_recency_ts_ms: number | null;
    after_active_count: number;
    after_total_tokens: number;
    after_oldest_pointer: string | null;
    after_oldest_recency_ts_ms: number | null;
    after_newest_pointer: string | null;
    after_newest_recency_ts_ms: number | null;
  };
  dolt_reset_summary_quality: {
    summary_mode: "reset-short-bindle";
    source_record_count: number;
    source_turn_count: number;
    source_leaf_count: number;
    source_token_total: number;
    source_token_min: number;
    source_token_max: number;
    reset_forced_summary_count: number;
  };
  dolt_reset_finalization_completed: {
    ingested_tail_count: number;
    turn_to_leaf_rollups: number;
    leaf_to_bindle_rollups: number;
    turn_to_leaf_convergence_loops: number;
    leaf_to_bindle_convergence_loops: number;
    short_bindle_created: boolean;
    short_bindle_created_count: number;
    residual_turn_count: number;
    residual_leaf_count: number;
    lane_active_record_counts: DoltLaneLevelTotals;
    lane_active_token_totals: DoltLaneLevelTotals;
  };
};

export type DoltTelemetryEventType = keyof DoltTelemetryPayloadMap;

export type DoltTelemetryEvent<T extends DoltTelemetryEventType = DoltTelemetryEventType> =
  T extends DoltTelemetryEventType
    ? {
        ts: number;
        seq: number;
        event_type: T;
        session_id?: string;
        session_key?: string;
        payload: DoltTelemetryPayloadMap[T];
      }
    : never;

export type DoltTelemetryEventInput<T extends DoltTelemetryEventType = DoltTelemetryEventType> =
  T extends DoltTelemetryEventType ? Omit<DoltTelemetryEvent<T>, "seq" | "ts"> : never;

let seq = 0;
const listeners = new Set<(evt: DoltTelemetryEvent) => void>();

/**
 * Emit one Dolt runtime telemetry event to all current listeners.
 */
export function emitDoltTelemetryEvent<T extends DoltTelemetryEventType>(
  event: DoltTelemetryEventInput<T>,
): void {
  const enriched = {
    ...event,
    ts: Date.now(),
    seq: (seq += 1),
  } as unknown as DoltTelemetryEvent<T>;
  log.debug("dolt runtime telemetry", {
    event_type: enriched.event_type,
    session_id: enriched.session_id,
    session_key: enriched.session_key,
    payload: enriched.payload,
  });
  for (const listener of listeners) {
    try {
      listener(enriched);
    } catch {
      // Ignore listener failures.
    }
  }
}

/**
 * Register a listener for Dolt runtime telemetry events.
 */
export function onDoltTelemetryEvent(listener: (evt: DoltTelemetryEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Reset telemetry listener + sequence state for test isolation.
 */
export function resetDoltTelemetryForTest(): void {
  seq = 0;
  listeners.clear();
}

/**
 * Snapshot active-lane pointer counts and token totals for one session.
 */
export function collectDoltActiveLaneSnapshot(params: {
  store: DoltStore;
  sessionId: string;
}): DoltActiveLaneSnapshot {
  const lane_active_record_counts = createLaneTotals();
  const lane_active_token_totals = createLaneTotals();

  for (const level of DOLT_LANE_LEVELS) {
    const laneEntries = params.store.listActiveLane({
      sessionId: params.sessionId,
      level,
      activeOnly: true,
    });
    for (const laneEntry of laneEntries) {
      const record = params.store.getRecord(laneEntry.pointer);
      if (!isSessionLevelRecord(record, params.sessionId, level)) {
        continue;
      }
      lane_active_record_counts[level] += 1;
      lane_active_token_totals[level] += normalizeNonNegativeInt(record.tokenCount);
    }
  }

  return {
    lane_active_record_counts,
    lane_active_token_totals,
  };
}

function createLaneTotals(): DoltLaneLevelTotals {
  return {
    turn: 0,
    leaf: 0,
    bindle: 0,
  };
}

function isSessionLevelRecord(
  record: DoltRecord | null,
  sessionId: string,
  level: DoltRecordLevel,
): record is DoltRecord {
  if (!record) {
    return false;
  }
  return record.sessionId === sessionId && record.level === level;
}

function normalizeNonNegativeInt(value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

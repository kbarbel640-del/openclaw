import type { DoltRecord, DoltRecordLevel, DoltStore } from "./store/types.js";
import { assembleDoltContext, resolveDoltAssemblyLaneBudgets } from "./assembly.js";
import {
  resolveDoltLanePolicies,
  type DoltLanePolicies,
  type DoltLanePolicyOverrides,
} from "./policy.js";
import { collectDoltActiveLaneSnapshot, emitDoltTelemetryEvent } from "./telemetry.js";

export type DoltBootstrapHydrationParams = {
  store: DoltStore;
  sessionId: string;
  sessionKey?: string | null;
  tokenBudget?: number;
  runtimeReserveTokens?: number;
  lanePolicies?: DoltLanePolicies;
  lanePolicyOverrides?: DoltLanePolicyOverrides;
};

export type DoltBootstrapHydrationResult = {
  hydrated: boolean;
  activatedPointers: {
    bindle: string[];
    leaf: string[];
    turn: string[];
  };
  assembly: ReturnType<typeof assembleDoltContext>;
};

/**
 * Hydrate active Dolt lanes from persisted records under standard lane budgets.
 *
 * Selection rules:
 * - choose newest records first within each lane
 * - lane budget priority remains bindle -> leaf -> turn
 * - final assembled output remains <bindles><leaves><turns>, oldest->newest
 */
export function hydrateDoltBootstrapState(
  params: DoltBootstrapHydrationParams,
): DoltBootstrapHydrationResult {
  const sessionId = requireNonEmptyString(params.sessionId, "sessionId");
  const sessionKey = normalizeOptionalString(params.sessionKey);
  const lanePolicies =
    params.lanePolicies ?? resolveDoltLanePolicies(params.lanePolicyOverrides ?? undefined);
  const tokenBudget = normalizeNonNegativeInt(params.tokenBudget ?? 0);
  const runtimeReserveTokens = normalizeNonNegativeInt(params.runtimeReserveTokens ?? 0);
  const availableTokens = Math.max(0, tokenBudget - runtimeReserveTokens);
  const laneBudgets = resolveDoltAssemblyLaneBudgets({
    availableTokens,
    lanePolicies,
  });

  const selectedBindles = selectLaneByRecency({
    store: params.store,
    sessionId,
    level: "bindle",
    laneBudget: laneBudgets.bindle,
  });
  const selectedLeaves = selectLaneByRecency({
    store: params.store,
    sessionId,
    level: "leaf",
    laneBudget: laneBudgets.leaf,
  });
  const selectedTurns = selectLaneByRecency({
    store: params.store,
    sessionId,
    level: "turn",
    laneBudget: laneBudgets.turn,
  });

  upsertHydratedLane({
    store: params.store,
    sessionId,
    sessionKey,
    level: "bindle",
    selected: selectedBindles,
  });
  upsertHydratedLane({
    store: params.store,
    sessionId,
    sessionKey,
    level: "leaf",
    selected: selectedLeaves,
  });
  upsertHydratedLane({
    store: params.store,
    sessionId,
    sessionKey,
    level: "turn",
    selected: selectedTurns,
  });

  const assembly = assembleDoltContext({
    store: params.store,
    sessionId,
    tokenBudget,
    runtimeReserveTokens,
    lanePolicies,
  });
  const activatedPointers = {
    bindle: selectedBindles
      .toSorted((a, b) => a.eventTsMs - b.eventTsMs || a.pointer.localeCompare(b.pointer))
      .map((record) => record.pointer),
    leaf: selectedLeaves
      .toSorted((a, b) => a.eventTsMs - b.eventTsMs || a.pointer.localeCompare(b.pointer))
      .map((record) => record.pointer),
    turn: selectedTurns
      .toSorted((a, b) => a.eventTsMs - b.eventTsMs || a.pointer.localeCompare(b.pointer))
      .map((record) => record.pointer),
  };
  const laneActiveSnapshot = collectDoltActiveLaneSnapshot({
    store: params.store,
    sessionId,
  });

  emitDoltTelemetryEvent({
    event_type: "dolt_bootstrap_hydration",
    session_id: sessionId,
    session_key: sessionKey ?? undefined,
    payload: {
      hydrated: selectedBindles.length + selectedLeaves.length + selectedTurns.length > 0,
      activated_pointer_counts: {
        bindle: activatedPointers.bindle.length,
        leaf: activatedPointers.leaf.length,
        turn: activatedPointers.turn.length,
      },
      lane_active_record_counts: laneActiveSnapshot.lane_active_record_counts,
      lane_active_token_totals: laneActiveSnapshot.lane_active_token_totals,
    },
  });

  return {
    hydrated: selectedBindles.length + selectedLeaves.length + selectedTurns.length > 0,
    activatedPointers,
    assembly,
  };
}

function selectLaneByRecency(params: {
  store: DoltStore;
  sessionId: string;
  level: DoltRecordLevel;
  laneBudget: number;
}): DoltRecord[] {
  if (params.laneBudget <= 0) {
    return [];
  }
  const recordsNewestFirst = params.store.listRecordsBySession({
    sessionId: params.sessionId,
    level: params.level,
    newestFirst: true,
  });
  const selectedNewestFirst: DoltRecord[] = [];
  let usedTokens = 0;
  for (const record of recordsNewestFirst) {
    if (usedTokens + record.tokenCount > params.laneBudget) {
      break;
    }
    selectedNewestFirst.push(record);
    usedTokens += record.tokenCount;
  }
  return selectedNewestFirst;
}

function upsertHydratedLane(params: {
  store: DoltStore;
  sessionId: string;
  sessionKey: string | null;
  level: DoltRecordLevel;
  selected: DoltRecord[];
}): void {
  params.store.deactivateLevelPointers({
    sessionId: params.sessionId,
    level: params.level,
  });

  for (const record of params.selected) {
    params.store.upsertActiveLane({
      sessionId: params.sessionId,
      sessionKey: params.sessionKey ?? record.sessionKey,
      level: params.level,
      pointer: record.pointer,
      isActive: true,
      lastEventTsMs: record.eventTsMs,
    });
  }
}

function normalizeNonNegativeInt(value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
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

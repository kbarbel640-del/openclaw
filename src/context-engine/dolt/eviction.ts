import type { DoltRecord, DoltStore } from "./store/types.js";

type DoltActiveBindle = {
  pointer: string;
  recencyTsMs: number;
  tokenCount: number;
};

export type DoltBindleEvictionBoundary = {
  pointer: string;
  recencyTsMs: number;
  tokenCount: number;
};

export type DoltBindleEvictionSnapshot = {
  activeCount: number;
  totalTokens: number;
  oldest: DoltBindleEvictionBoundary | null;
  newest: DoltBindleEvictionBoundary | null;
};

export type DoltBindleEvictionStep = {
  stepIndex: number;
  evictedPointer: string;
  before: DoltBindleEvictionSnapshot;
  after: DoltBindleEvictionSnapshot;
};

export type DoltBindleEvictionTelemetry = {
  targetTokens: number;
  before: DoltBindleEvictionSnapshot;
  after: DoltBindleEvictionSnapshot;
  evictedCount: number;
  evictedPointers: string[];
  steps: DoltBindleEvictionStep[];
};

export type DoltBindleEvictionResult = {
  activePointers: string[];
  evictedPointers: string[];
  telemetry: DoltBindleEvictionTelemetry;
};

/**
 * Enforce deterministic oldest-first bindle eviction until lane <= target.
 *
 * This mutates active-lane state only; persisted records/lineage remain intact.
 */
export function enforceDoltBindleOldestFirstEviction(params: {
  store: DoltStore;
  sessionId: string;
  sessionKey?: string | null;
  targetTokens: number;
}): DoltBindleEvictionResult {
  const sessionId = requireNonEmptyString(params.sessionId, "sessionId");
  const targetTokens = normalizeNonNegativeInt(params.targetTokens);
  const steps: DoltBindleEvictionStep[] = [];
  const evictedPointers: string[] = [];
  let activeBindles = listActiveBindlesByRecency({
    store: params.store,
    sessionId,
  });
  const before = buildSnapshot(activeBindles);

  while (sumTokenCount(activeBindles) > targetTokens && activeBindles.length > 0) {
    const beforeStep = buildSnapshot(activeBindles);
    const oldest = activeBindles[activeBindles.length - 1];
    params.store.upsertActiveLane({
      sessionId,
      sessionKey: params.sessionKey,
      level: "bindle",
      pointer: oldest.pointer,
      isActive: false,
      lastEventTsMs: oldest.recencyTsMs,
    });
    evictedPointers.push(oldest.pointer);
    activeBindles = listActiveBindlesByRecency({
      store: params.store,
      sessionId,
    });
    const afterStep = buildSnapshot(activeBindles);
    steps.push({
      stepIndex: steps.length,
      evictedPointer: oldest.pointer,
      before: beforeStep,
      after: afterStep,
    });
  }

  const after = buildSnapshot(activeBindles);
  return {
    activePointers: activeBindles.map((bindle) => bindle.pointer),
    evictedPointers,
    telemetry: {
      targetTokens,
      before,
      after,
      evictedCount: evictedPointers.length,
      evictedPointers: [...evictedPointers],
      steps,
    },
  };
}

function listActiveBindlesByRecency(params: {
  store: DoltStore;
  sessionId: string;
}): DoltActiveBindle[] {
  const laneEntries = params.store.listActiveLane({
    sessionId: params.sessionId,
    level: "bindle",
    activeOnly: true,
  });
  const records = laneEntries
    .map((laneEntry) => {
      const record = params.store.getRecord(laneEntry.pointer);
      if (!isSessionBindleRecord(record, params.sessionId)) {
        return null;
      }
      return {
        pointer: record.pointer,
        recencyTsMs: normalizeNonNegativeInt(laneEntry.lastEventTsMs),
        tokenCount: normalizeNonNegativeInt(record.tokenCount),
      };
    })
    .filter((candidate): candidate is DoltActiveBindle => !!candidate);

  return records.toSorted(
    (a, b) => b.recencyTsMs - a.recencyTsMs || b.pointer.localeCompare(a.pointer),
  );
}

function isSessionBindleRecord(
  record: DoltRecord | null,
  sessionId: string,
): record is DoltRecord & { level: "bindle" } {
  if (!record) {
    return false;
  }
  return record.sessionId === sessionId && record.level === "bindle";
}

function buildSnapshot(records: DoltActiveBindle[]): DoltBindleEvictionSnapshot {
  const newest = records[0] ?? null;
  const oldest = records[records.length - 1] ?? null;
  return {
    activeCount: records.length,
    totalTokens: sumTokenCount(records),
    oldest: oldest ? toBoundary(oldest) : null,
    newest: newest ? toBoundary(newest) : null,
  };
}

function toBoundary(record: DoltActiveBindle): DoltBindleEvictionBoundary {
  return {
    pointer: record.pointer,
    recencyTsMs: record.recencyTsMs,
    tokenCount: record.tokenCount,
  };
}

function sumTokenCount(records: DoltActiveBindle[]): number {
  return records.reduce((sum, record) => sum + record.tokenCount, 0);
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

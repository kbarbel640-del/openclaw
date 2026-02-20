import { afterEach, describe, expect, it, vi } from "vitest";
import type { DoltRecord } from "./store/types.js";
import type { DoltSummarizeParams, DoltSummarizeResult } from "./summarizer.js";
import type { DoltTelemetryEvent, DoltTelemetryEventType } from "./telemetry.js";
import { requireNodeSqlite } from "../../memory/sqlite.js";
import { hydrateDoltBootstrapState } from "./bootstrap.js";
import { serializeDoltSummaryFrontmatter } from "./contract.js";
import { evaluateDoltLanePressure, selectDoltTurnChunkForCompaction } from "./policy.js";
import { finalizeDoltReset } from "./reset-finalization.js";
import { executeDoltRollup } from "./rollup.js";
import { SqliteDoltStore } from "./store/sqlite-dolt-store.js";
import { onDoltTelemetryEvent, resetDoltTelemetryForTest } from "./telemetry.js";

type TestStore = {
  store: SqliteDoltStore;
  db: import("node:sqlite").DatabaseSync;
};

const createdStores: TestStore[] = [];

function createInMemoryStore(now: () => number = () => Date.now()): TestStore {
  const { DatabaseSync } = requireNodeSqlite();
  const db = new DatabaseSync(":memory:");
  const store = new SqliteDoltStore({ db, now });
  const created = { store, db };
  createdStores.push(created);
  return created;
}

afterEach(() => {
  for (const created of createdStores.splice(0, createdStores.length)) {
    created.store.close();
  }
  resetDoltTelemetryForTest();
});

describe("dolt telemetry runtime integration", () => {
  it("emits lane pressure trigger-path and turn chunk telemetry", () => {
    const events: DoltTelemetryEvent[] = [];
    const stop = onDoltTelemetryEvent((evt) => {
      events.push(evt);
    });

    evaluateDoltLanePressure({
      laneTokenCount: 45_000,
      policy: { soft: 40_000, delta: 4_000, target: 36_000 },
    });
    evaluateDoltLanePressure({
      laneTokenCount: 37_000,
      policy: { soft: 40_000, delta: 4_000, target: 36_000 },
      hardLimitSafetyMode: true,
    });
    selectDoltTurnChunkForCompaction({
      turns: [
        { pointer: "turn-1", tokenCount: 1_000 },
        { pointer: "turn-2", tokenCount: 2_000 },
        { pointer: "turn-3", tokenCount: 3_000 },
        { pointer: "turn-4", tokenCount: 4_000 },
      ],
      laneTokenCount: 10_000,
      policy: { soft: 40_000, delta: 4_000, target: 6_000 },
      freshTailMinTurns: 2,
      freshTailTokenLimit: 5_000,
      minChunkTurns: 2,
    });
    stop();

    const pressureEvents = events.filter((evt) => evt.event_type === "dolt_lane_pressure_decision");
    expect(pressureEvents).toHaveLength(2);
    expect(pressureEvents.map((evt) => evt.payload.trigger_path)).toEqual([
      "soft_delta",
      "hard_limit_bypass",
    ]);

    const chunkEvent = findEvent(events, "dolt_turn_chunk_selection");
    expect(chunkEvent).toBeDefined();
    expect(chunkEvent?.payload.selected_count).toBeGreaterThanOrEqual(2);
    expect(chunkEvent?.payload.fresh_tail_preserved_count).toBeGreaterThanOrEqual(2);
  });

  it("emits rollup, summary quality, and eviction telemetry in the runtime rollup path", async () => {
    const { store } = createInMemoryStore(() => 1_000);
    const sessionId = "session-rollup-telemetry";
    const events: DoltTelemetryEvent[] = [];
    const stop = onDoltTelemetryEvent((evt) => {
      events.push(evt);
    });

    const olderBindle = upsertSummary({
      store,
      sessionId,
      pointer: "bindle-old-1",
      level: "bindle",
      eventTsMs: 100,
      body: "older bindle",
      children: ["leaf-old-1"],
    });
    const newerBindle = upsertSummary({
      store,
      sessionId,
      pointer: "bindle-old-2",
      level: "bindle",
      eventTsMs: 200,
      body: "newer bindle",
      children: ["leaf-old-2"],
    });
    markActive(store, olderBindle);
    markActive(store, newerBindle);

    const leaf1 = upsertSummary({
      store,
      sessionId,
      pointer: "leaf-1",
      level: "leaf",
      eventTsMs: 1_000,
      body: "leaf one",
      children: ["turn-1", "turn-2"],
    });
    const leaf2 = upsertSummary({
      store,
      sessionId,
      pointer: "leaf-2",
      level: "leaf",
      eventTsMs: 2_000,
      body: "leaf two",
      children: ["turn-3", "turn-4"],
    });
    markActive(store, leaf1);
    markActive(store, leaf2);

    await executeDoltRollup({
      store,
      sessionId,
      targetLevel: "bindle",
      sourceRecords: [leaf1, leaf2],
      bindleEvictionTargetTokens: 0,
      summarize: buildSummaryStub("bindle"),
    });
    stop();

    const qualityEvent = findEvent(events, "dolt_rollup_summary_quality");
    expect(qualityEvent).toBeDefined();
    expect(qualityEvent?.payload.summary_mode).toBe("bindle");
    expect(qualityEvent?.payload.source_record_count).toBe(2);
    expect(qualityEvent?.payload.reset_forced_summary_count).toBe(0);

    const evictionEvent = findEvent(events, "dolt_bindle_eviction");
    expect(evictionEvent).toBeDefined();
    expect(evictionEvent?.payload.before_active_count).toBe(3);
    expect(evictionEvent?.payload.after_active_count).toBe(0);
    expect(evictionEvent?.payload.before_oldest_pointer).toBe("bindle-old-1");
    expect(evictionEvent?.payload.before_newest_pointer).not.toBeNull();

    const completedEvent = findEvent(events, "dolt_rollup_completed");
    expect(completedEvent).toBeDefined();
    expect(completedEvent?.payload.target_level).toBe("bindle");
    expect(completedEvent?.payload.child_pointer_count).toBe(2);
    expect(completedEvent?.payload.bindle_eviction_count).toBe(3);
    expect(completedEvent?.payload.lane_active_before_record_counts.bindle).toBe(2);
    expect(completedEvent?.payload.lane_active_after_record_counts.bindle).toBe(0);
  });

  it("emits bootstrap/assembly and reset finalization lifecycle telemetry", async () => {
    const { store } = createInMemoryStore(() => 2_000);
    const bootstrapSessionId = "session-bootstrap-telemetry";
    const resetSessionId = "session-reset-telemetry";
    const events: DoltTelemetryEvent[] = [];
    const stop = onDoltTelemetryEvent((evt) => {
      events.push(evt);
    });

    const bindle = upsertSummary({
      store,
      sessionId: bootstrapSessionId,
      pointer: "bindle-bootstrap-1",
      level: "bindle",
      eventTsMs: 100,
      body: "bootstrap bindle",
      children: ["leaf-bootstrap-1"],
    });
    const leaf = upsertSummary({
      store,
      sessionId: bootstrapSessionId,
      pointer: "leaf-bootstrap-1",
      level: "leaf",
      eventTsMs: 200,
      body: "bootstrap leaf",
      children: ["turn-bootstrap-1"],
    });
    const turn = upsertTurn({
      store,
      sessionId: bootstrapSessionId,
      pointer: "turn-bootstrap-1",
      eventTsMs: 300,
      content: "bootstrap turn",
    });
    markActive(store, bindle);
    markActive(store, leaf);
    markActive(store, turn);

    hydrateDoltBootstrapState({
      store,
      sessionId: bootstrapSessionId,
      tokenBudget: 50_000,
      runtimeReserveTokens: 0,
    });

    for (let index = 0; index < 4; index += 1) {
      const resetTurn = upsertTurn({
        store,
        sessionId: resetSessionId,
        pointer: `turn-reset-${index + 1}`,
        eventTsMs: (index + 1) * 100,
        content: `reset-turn-${index + 1}-${"x".repeat(15_000)}`,
      });
      markActive(store, resetTurn);
    }
    const priorLeaf = upsertSummary({
      store,
      sessionId: resetSessionId,
      pointer: "leaf-reset-prior",
      level: "leaf",
      eventTsMs: 450,
      body: "prior reset leaf",
      children: ["turn-old-a", "turn-old-b"],
    });
    markActive(store, priorLeaf);

    await finalizeDoltReset({
      store,
      sessionId: resetSessionId,
      summarize: buildSummaryStub("leaf"),
      ingestMissingTail: () => {
        const tail = upsertTurn({
          store,
          sessionId: resetSessionId,
          pointer: "turn-reset-tail",
          eventTsMs: 550,
          content: `tail-${"y".repeat(15_000)}`,
        });
        markActive(store, tail);
        return 1;
      },
    });
    stop();

    const assemblyEvent = findEventBySession(events, "dolt_assembly_snapshot", bootstrapSessionId);
    expect(assemblyEvent).toBeDefined();
    expect(assemblyEvent?.payload.lane_active_token_totals.bindle).toBeGreaterThan(0);
    expect(assemblyEvent?.payload.lane_selected_record_counts.turn).toBeGreaterThan(0);

    const bootstrapEvent = findEventBySession(
      events,
      "dolt_bootstrap_hydration",
      bootstrapSessionId,
    );
    expect(bootstrapEvent).toBeDefined();
    expect(bootstrapEvent?.payload.hydrated).toBe(true);
    expect(bootstrapEvent?.payload.activated_pointer_counts.bindle).toBeGreaterThan(0);

    const selectionEvents = events.filter(
      (evt) => evt.event_type === "dolt_turn_chunk_selection" && evt.session_id === undefined,
    );
    expect(selectionEvents.length).toBeGreaterThan(0);

    const resetSummaryQuality = findEventBySession(
      events,
      "dolt_reset_summary_quality",
      resetSessionId,
    );
    expect(resetSummaryQuality).toBeDefined();
    expect(resetSummaryQuality?.payload.reset_forced_summary_count).toBe(1);
    expect(resetSummaryQuality?.payload.source_record_count).toBeGreaterThan(0);

    const resetCompleted = findEventBySession(
      events,
      "dolt_reset_finalization_completed",
      resetSessionId,
    );
    expect(resetCompleted).toBeDefined();
    expect(resetCompleted?.payload.ingested_tail_count).toBe(1);
    expect(resetCompleted?.payload.short_bindle_created).toBe(true);
    expect(resetCompleted?.payload.short_bindle_created_count).toBe(1);
    expect(resetCompleted?.payload.turn_to_leaf_convergence_loops).toBeGreaterThan(0);
    expect(resetCompleted?.payload.leaf_to_bindle_convergence_loops).toBeGreaterThan(0);
  });
});

function findEvent<T extends DoltTelemetryEventType>(
  events: DoltTelemetryEvent[],
  eventType: T,
): DoltTelemetryEventOf<T> | undefined {
  return events.find((evt): evt is DoltTelemetryEventOf<T> => evt.event_type === eventType);
}

function findEventBySession<T extends DoltTelemetryEventType>(
  events: DoltTelemetryEvent[],
  eventType: T,
  sessionId: string,
): DoltTelemetryEventOf<T> | undefined {
  return events.find(
    (evt): evt is DoltTelemetryEventOf<T> =>
      evt.event_type === eventType && evt.session_id === sessionId,
  );
}

type DoltTelemetryEventOf<T extends DoltTelemetryEventType> = Extract<
  DoltTelemetryEvent,
  { event_type: T }
>;

function buildSummaryStub(summaryType: "leaf" | "bindle") {
  return vi.fn(
    async (params: DoltSummarizeParams): Promise<DoltSummarizeResult> => ({
      summary: makeSummaryPayload({
        summaryType: summaryTypeForMode(params.mode, summaryType),
        startEpochMs: params.datesCovered.startEpochMs,
        endEpochMs: params.datesCovered.endEpochMs,
        children: params.childPointers,
        body: `summary for ${params.mode}`,
        finalizedAtReset: params.mode === "reset-short-bindle",
      }),
      metadata: {
        summary_type: summaryTypeForMode(params.mode, summaryType),
        finalized_at_reset: params.mode === "reset-short-bindle",
        prompt_template: params.mode,
        max_output_tokens: 2_000,
      },
      modelSelection: {
        provider: "openai",
        modelId: "gpt-5",
      },
    }),
  );
}

function summaryTypeForMode(
  mode: DoltSummarizeParams["mode"],
  fallback: "leaf" | "bindle",
): "leaf" | "bindle" {
  if (mode === "leaf") {
    return "leaf";
  }
  if (mode === "bindle" || mode === "reset-short-bindle") {
    return "bindle";
  }
  return fallback;
}

function makeSummaryPayload(params: {
  summaryType: "leaf" | "bindle";
  startEpochMs: number;
  endEpochMs: number;
  children: string[];
  body: string;
  finalizedAtReset?: boolean;
}): string {
  const frontmatter = serializeDoltSummaryFrontmatter({
    summaryType: params.summaryType,
    datesCovered: {
      startEpochMs: params.startEpochMs,
      endEpochMs: params.endEpochMs,
    },
    children: params.children,
    finalizedAtReset: params.finalizedAtReset === true,
  });
  return `${frontmatter}\n${params.body}`;
}

function upsertTurn(params: {
  store: SqliteDoltStore;
  sessionId: string;
  pointer: string;
  eventTsMs: number;
  content: string;
}): DoltRecord {
  return params.store.upsertRecord({
    pointer: params.pointer,
    sessionId: params.sessionId,
    level: "turn",
    eventTsMs: params.eventTsMs,
    payload: {
      role: "user",
      content: params.content,
    },
  });
}

function upsertSummary(params: {
  store: SqliteDoltStore;
  sessionId: string;
  pointer: string;
  level: "leaf" | "bindle";
  eventTsMs: number;
  body: string;
  children: string[];
}): DoltRecord {
  return params.store.upsertRecord({
    pointer: params.pointer,
    sessionId: params.sessionId,
    level: params.level,
    eventTsMs: params.eventTsMs,
    payload: {
      summary: makeSummaryPayload({
        summaryType: params.level,
        startEpochMs: params.eventTsMs - 100,
        endEpochMs: params.eventTsMs,
        children: params.children,
        body: params.body,
      }),
    },
  });
}

function markActive(store: SqliteDoltStore, record: DoltRecord): void {
  store.upsertActiveLane({
    sessionId: record.sessionId,
    sessionKey: record.sessionKey,
    level: record.level,
    pointer: record.pointer,
    isActive: true,
    lastEventTsMs: record.eventTsMs,
  });
}

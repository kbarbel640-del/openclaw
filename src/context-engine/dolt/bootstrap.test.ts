import { afterEach, describe, expect, it } from "vitest";
import { requireNodeSqlite } from "../../memory/sqlite.js";
import { hydrateDoltBootstrapState } from "./bootstrap.js";
import { serializeDoltSummaryFrontmatter } from "./contract.js";
import { SqliteDoltStore } from "./store/sqlite-dolt-store.js";
import type { DoltRecord } from "./store/types.js";

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
});

describe("hydrateDoltBootstrapState", () => {
  it("hydrates newest records per lane and preserves final bucket ordering", () => {
    const { store } = createInMemoryStore(() => 30_000);
    const sessionId = "session-bootstrap-1";
    const bindle1 = upsertSummary({
      store,
      sessionId,
      pointer: "bindle-1",
      level: "bindle",
      eventTsMs: 100,
      body: "bindle one",
      children: ["leaf-1"],
    });
    const bindle2 = upsertSummary({
      store,
      sessionId,
      pointer: "bindle-2",
      level: "bindle",
      eventTsMs: 200,
      body: "bindle two",
      children: ["leaf-2"],
    });
    const leaf1 = upsertSummary({
      store,
      sessionId,
      pointer: "leaf-1",
      level: "leaf",
      eventTsMs: 300,
      body: "leaf one",
      children: ["turn-1"],
    });
    const leaf2 = upsertSummary({
      store,
      sessionId,
      pointer: "leaf-2",
      level: "leaf",
      eventTsMs: 400,
      body: "leaf two",
      children: ["turn-2"],
    });
    const turn1 = upsertTurn({
      store,
      sessionId,
      pointer: "turn-1",
      eventTsMs: 500,
      content: "turn one",
    });
    const turn2 = upsertTurn({
      store,
      sessionId,
      pointer: "turn-2",
      eventTsMs: 600,
      content: "turn two",
    });
    const turn3 = upsertTurn({
      store,
      sessionId,
      pointer: "turn-3",
      eventTsMs: 700,
      content: "turn three",
    });

    // Seed stale active state so hydration must replace it.
    markActive(store, bindle1);
    markActive(store, leaf1);
    markActive(store, turn1);

    const result = hydrateDoltBootstrapState({
      store,
      sessionId,
      tokenBudget: 50_000,
      lanePolicyOverrides: {
        bindle: {
          target: 50_000,
          soft: 50_000,
          delta: 0,
          summaryCap: bindle2.tokenCount + 1,
        },
        leaf: {
          target: 50_000,
          soft: 50_000,
          delta: 0,
          summaryCap: leaf2.tokenCount + 1,
        },
        turn: {
          target: turn2.tokenCount + turn3.tokenCount + 1,
          soft: turn2.tokenCount + turn3.tokenCount + 1,
          delta: 0,
        },
      },
    });

    expect(result.hydrated).toBe(true);
    expect(result.activatedPointers.bindle).toEqual(["bindle-2"]);
    expect(result.activatedPointers.leaf).toEqual(["leaf-2"]);
    expect(result.activatedPointers.turn).toEqual(["turn-2", "turn-3"]);

    expect(
      store
        .listActiveLane({ sessionId, level: "bindle", activeOnly: true })
        .map((row) => row.pointer),
    ).toEqual(["bindle-2"]);
    expect(
      store
        .listActiveLane({ sessionId, level: "leaf", activeOnly: true })
        .map((row) => row.pointer),
    ).toEqual(["leaf-2"]);
    expect(
      store
        .listActiveLane({ sessionId, level: "turn", activeOnly: true })
        .map((row) => row.pointer),
    ).toEqual(["turn-3", "turn-2"]);

    expect(result.assembly.selectedRecords.bindle.map((record) => record.pointer)).toEqual([
      "bindle-2",
    ]);
    expect(result.assembly.selectedRecords.leaf.map((record) => record.pointer)).toEqual([
      "leaf-2",
    ]);
    expect(result.assembly.selectedRecords.turn.map((record) => record.pointer)).toEqual([
      "turn-2",
      "turn-3",
    ]);
  });

  it("applies lane priority budget from bindles to turns", () => {
    const { store } = createInMemoryStore(() => 40_000);
    const sessionId = "session-bootstrap-2";
    const bindle = upsertSummary({
      store,
      sessionId,
      pointer: "bindle-only",
      level: "bindle",
      eventTsMs: 100,
      body: "bindle priority",
      children: ["leaf-x"],
    });
    upsertSummary({
      store,
      sessionId,
      pointer: "leaf-only",
      level: "leaf",
      eventTsMs: 200,
      body: "leaf fallback",
      children: ["turn-x"],
    });
    upsertTurn({
      store,
      sessionId,
      pointer: "turn-only",
      eventTsMs: 300,
      content: "turn fallback",
    });

    const result = hydrateDoltBootstrapState({
      store,
      sessionId,
      tokenBudget: bindle.tokenCount + 1,
      lanePolicyOverrides: {
        bindle: { target: 50_000, soft: 50_000, delta: 0, summaryCap: 50_000 },
        leaf: { target: 50_000, soft: 50_000, delta: 0, summaryCap: 50_000 },
        turn: { target: 50_000, soft: 50_000, delta: 0 },
      },
    });

    expect(result.activatedPointers.bindle).toEqual(["bindle-only"]);
    expect(result.activatedPointers.leaf).toEqual([]);
    expect(result.activatedPointers.turn).toEqual([]);
    expect(result.assembly.selectedRecords.bindle.map((record) => record.pointer)).toEqual([
      "bindle-only",
    ]);
    expect(result.assembly.selectedRecords.leaf).toEqual([]);
    expect(result.assembly.selectedRecords.turn).toEqual([]);
  });
});

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

import { afterEach, describe, expect, it } from "vitest";
import { requireNodeSqlite } from "../../memory/sqlite.js";
import { serializeDoltSummaryFrontmatter } from "./contract.js";
import { enforceDoltBindleOldestFirstEviction } from "./eviction.js";
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

describe("enforceDoltBindleOldestFirstEviction", () => {
  it("selects active membership by recency and evicts the oldest active bindle first", () => {
    const { store } = createInMemoryStore(() => 1_000);
    const oldByRecency = upsertBindle({
      store,
      sessionId: "session-a",
      pointer: "bindle-old-recency",
      eventTsMs: 9_000,
      body: "newer-event-but-older-recency",
    });
    const newByRecency = upsertBindle({
      store,
      sessionId: "session-a",
      pointer: "bindle-new-recency",
      eventTsMs: 1_000,
      body: "older-event-but-newer-recency",
    });
    markActive(store, oldByRecency, 10);
    markActive(store, newByRecency, 20);

    const result = enforceDoltBindleOldestFirstEviction({
      store,
      sessionId: "session-a",
      targetTokens: newByRecency.tokenCount,
    });

    expect(result.evictedPointers).toEqual(["bindle-old-recency"]);
    expect(result.activePointers).toEqual(["bindle-new-recency"]);
  });

  it("uses deterministic pointer ordering when recency ties", () => {
    const { store } = createInMemoryStore(() => 2_000);
    const tieA = upsertBindle({
      store,
      sessionId: "session-a",
      pointer: "bindle-a",
      eventTsMs: 100,
      body: "tie-a",
    });
    const tieB = upsertBindle({
      store,
      sessionId: "session-a",
      pointer: "bindle-b",
      eventTsMs: 100,
      body: "tie-b",
    });
    markActive(store, tieA, 100);
    markActive(store, tieB, 100);

    const result = enforceDoltBindleOldestFirstEviction({
      store,
      sessionId: "session-a",
      targetTokens: tieB.tokenCount,
    });

    expect(result.evictedPointers).toEqual(["bindle-a"]);
    expect(result.activePointers).toEqual(["bindle-b"]);
  });

  it("evicts one oldest bindle per step until lane is at or below target and reports telemetry", () => {
    const { store } = createInMemoryStore(() => 3_000);
    const bindle1 = upsertBindle({
      store,
      sessionId: "session-a",
      pointer: "bindle-1",
      eventTsMs: 100,
      body: "body-1",
    });
    const bindle2 = upsertBindle({
      store,
      sessionId: "session-a",
      pointer: "bindle-2",
      eventTsMs: 200,
      body: "body-2",
    });
    const bindle3 = upsertBindle({
      store,
      sessionId: "session-a",
      pointer: "bindle-3",
      eventTsMs: 300,
      body: "body-3",
    });
    const bindle4 = upsertBindle({
      store,
      sessionId: "session-a",
      pointer: "bindle-4",
      eventTsMs: 400,
      body: "body-4",
    });
    markActive(store, bindle1);
    markActive(store, bindle2);
    markActive(store, bindle3);
    markActive(store, bindle4);

    const targetTokens = bindle3.tokenCount + bindle4.tokenCount;
    const result = enforceDoltBindleOldestFirstEviction({
      store,
      sessionId: "session-a",
      targetTokens,
    });

    expect(result.evictedPointers).toEqual(["bindle-1", "bindle-2"]);
    expect(result.activePointers).toEqual(["bindle-4", "bindle-3"]);
    expect(result.telemetry.before.totalTokens).toBe(
      bindle1.tokenCount + bindle2.tokenCount + bindle3.tokenCount + bindle4.tokenCount,
    );
    expect(result.telemetry.before.oldest?.pointer).toBe("bindle-1");
    expect(result.telemetry.before.newest?.pointer).toBe("bindle-4");
    expect(result.telemetry.after.totalTokens).toBe(targetTokens);
    expect(result.telemetry.after.oldest?.pointer).toBe("bindle-3");
    expect(result.telemetry.after.newest?.pointer).toBe("bindle-4");
    expect(result.telemetry.steps).toHaveLength(2);
    expect(result.telemetry.steps[0]?.before.activeCount).toBe(4);
    expect(result.telemetry.steps[0]?.after.activeCount).toBe(3);
    expect(result.telemetry.steps[1]?.before.activeCount).toBe(3);
    expect(result.telemetry.steps[1]?.after.activeCount).toBe(2);

    // Eviction only flips active-lane state; persisted records remain readable.
    expect(store.getRecord("bindle-1")).not.toBeNull();
    expect(store.getRecord("bindle-2")).not.toBeNull();
  });
});

function upsertBindle(params: {
  store: SqliteDoltStore;
  sessionId: string;
  pointer: string;
  eventTsMs: number;
  body: string;
}): DoltRecord {
  return params.store.upsertRecord({
    pointer: params.pointer,
    sessionId: params.sessionId,
    level: "bindle",
    eventTsMs: params.eventTsMs,
    payload: {
      summary: makeBindleSummary({
        startEpochMs: params.eventTsMs - 100,
        endEpochMs: params.eventTsMs,
        children: [`leaf:${params.pointer}`],
        body: params.body,
      }),
    },
  });
}

function makeBindleSummary(params: {
  startEpochMs: number;
  endEpochMs: number;
  children: string[];
  body: string;
}): string {
  const frontmatter = serializeDoltSummaryFrontmatter({
    summaryType: "bindle",
    datesCovered: {
      startEpochMs: params.startEpochMs,
      endEpochMs: params.endEpochMs,
    },
    children: params.children,
    finalizedAtReset: false,
  });
  return `${frontmatter}\n${params.body}`;
}

function markActive(store: SqliteDoltStore, record: DoltRecord, lastEventTsMs?: number): void {
  store.upsertActiveLane({
    sessionId: record.sessionId,
    sessionKey: record.sessionKey,
    level: "bindle",
    pointer: record.pointer,
    isActive: true,
    lastEventTsMs: lastEventTsMs ?? record.eventTsMs,
  });
}

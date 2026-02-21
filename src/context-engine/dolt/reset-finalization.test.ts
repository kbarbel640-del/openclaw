import { afterEach, describe, expect, it, vi } from "vitest";
import { requireNodeSqlite } from "../../memory/sqlite.js";
import { parseDoltSummaryDocument, serializeDoltSummaryFrontmatter } from "./contract.js";
import { finalizeDoltReset } from "./reset-finalization.js";
import { SqliteDoltStore } from "./store/sqlite-dolt-store.js";
import type { DoltRecord } from "./store/types.js";
import type { DoltSummarizeParams, DoltSummarizeResult } from "./summarizer.js";

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

describe("finalizeDoltReset", () => {
  it("runs ordered reset finalization and emits reset short bindle metadata", async () => {
    const { store } = createInMemoryStore(() => 10_000);
    const sessionId = "session-reset-1";
    const events: string[] = [];

    for (let index = 0; index < 4; index += 1) {
      const turn = upsertTurn({
        store,
        sessionId,
        pointer: `turn-${index + 1}`,
        eventTsMs: (index + 1) * 100,
        content: `turn-body-${index + 1}-${"x".repeat(20_000)}`,
      });
      markActive(store, turn);
    }

    const priorLeaf = upsertSummary({
      store,
      sessionId,
      pointer: "leaf-prior",
      level: "leaf",
      eventTsMs: 450,
      children: ["turn-old-a", "turn-old-b"],
      body: "prior leaf body",
    });
    markActive(store, priorLeaf);

    const summarize = vi.fn(async (params: DoltSummarizeParams): Promise<DoltSummarizeResult> => {
      events.push(`summarize:${params.mode}`);
      return buildSummaryResult(params);
    });
    const result = await finalizeDoltReset({
      store,
      sessionId,
      summarize,
      ingestMissingTail: () => {
        events.push("ingest-tail");
        const tail = upsertTurn({
          store,
          sessionId,
          pointer: "turn-tail",
          eventTsMs: 550,
          content: `tail-${"y".repeat(20_000)}`,
        });
        markActive(store, tail);
        return 1;
      },
    });

    expect(events[0]).toBe("ingest-tail");
    expect(summarize.mock.calls.map(([call]) => call.mode)).toEqual([
      "leaf",
      "bindle",
      "reset-short-bindle",
    ]);
    expect(result.ingestedTailCount).toBe(1);
    expect(result.turnToLeafRollups).toBe(1);
    expect(result.leafToBindleRollups).toBe(1);
    expect(result.shortBindleCreated).toBe(true);
    expect(result.activeAfterFinalize.turns).toHaveLength(0);
    expect(result.activeAfterFinalize.leaves).toHaveLength(0);

    const shortBindle = store.getRecord(result.shortBindlePointer ?? "");
    expect(shortBindle).not.toBeNull();
    expect(shortBindle?.level).toBe("bindle");
    expect(shortBindle?.finalizedAtReset).toBe(true);

    const payload = shortBindle?.payload as {
      summary?: string;
      metadata?: { prompt_template?: string; finalized_at_reset?: boolean };
    };
    expect(payload.metadata?.prompt_template).toBe("reset-short-bindle");
    expect(payload.metadata?.finalized_at_reset).toBe(true);

    const parsed = parseDoltSummaryDocument(payload.summary ?? "");
    expect(parsed.frontmatter.summaryType).toBe("bindle");
    expect(parsed.frontmatter.finalizedAtReset).toBe(true);
  });

  it("enforces source floors and still emits reset short bindle for residual single turn", async () => {
    const { store } = createInMemoryStore(() => 20_000);
    const sessionId = "session-reset-2";
    const turn = upsertTurn({
      store,
      sessionId,
      pointer: "turn-only",
      eventTsMs: 100,
      content: `single-${"z".repeat(20_000)}`,
    });
    markActive(store, turn);

    const summarize = vi.fn(async (params: DoltSummarizeParams): Promise<DoltSummarizeResult> => {
      return buildSummaryResult(params);
    });
    const result = await finalizeDoltReset({
      store,
      sessionId,
      summarize,
    });

    expect(result.turnToLeafRollups).toBe(0);
    expect(result.leafToBindleRollups).toBe(0);
    expect(result.shortBindleCreated).toBe(true);
    expect(summarize.mock.calls.map(([call]) => call.mode)).toEqual(["reset-short-bindle"]);
    expect(result.activeAfterFinalize.turns).toHaveLength(0);
    expect(result.activeAfterFinalize.leaves).toHaveLength(0);

    const children = store.listDirectChildren(result.shortBindlePointer ?? "");
    expect(children).toHaveLength(0);
  });
});

function buildSummaryResult(params: DoltSummarizeParams): DoltSummarizeResult {
  const summaryType = params.mode === "leaf" ? "leaf" : "bindle";
  const finalizedAtReset = params.mode === "reset-short-bindle";
  const summary = makeSummaryPayload({
    summaryType,
    startEpochMs: params.datesCovered.startEpochMs,
    endEpochMs: params.datesCovered.endEpochMs,
    children: params.childPointers,
    body: `summary for ${params.mode}`,
    finalizedAtReset,
  });
  return {
    summary,
    metadata: {
      summary_type: summaryType,
      finalized_at_reset: finalizedAtReset,
      prompt_template: params.mode,
      max_output_tokens: 2000,
    },
    modelSelection: {
      provider: "openai",
      modelId: "gpt-5",
    },
  };
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
  children: string[];
  body: string;
}): DoltRecord {
  return params.store.upsertRecord({
    pointer: params.pointer,
    sessionId: params.sessionId,
    level: params.level,
    eventTsMs: params.eventTsMs,
    payload: {
      summary: makeSummaryPayload({
        summaryType: params.level,
        startEpochMs: params.eventTsMs - 50,
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

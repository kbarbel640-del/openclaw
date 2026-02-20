import { describe, expect, it } from "vitest";
import type {
  DoltQueryAvailability,
  DoltQueryRecord,
  DoltReadOnlyQueryHelpers,
} from "../read-only-dolt-store.js";
import { createDoltExpandTool } from "./dolt-expand.js";

function createRecord(overrides: Partial<DoltQueryRecord>): DoltQueryRecord {
  return {
    pointer: overrides.pointer ?? "record:pointer",
    sessionId: overrides.sessionId ?? "session-1",
    sessionKey: overrides.sessionKey ?? null,
    level: overrides.level ?? "leaf",
    eventTsMs: overrides.eventTsMs ?? 1_000,
    tokenCount: overrides.tokenCount ?? 7,
    tokenCountMethod: overrides.tokenCountMethod ?? "estimateTokens",
    payload: overrides.payload ?? {},
    payloadJson: overrides.payloadJson ?? JSON.stringify(overrides.payload ?? {}),
    finalizedAtReset: overrides.finalizedAtReset ?? false,
    createdAtMs: overrides.createdAtMs ?? 1_000,
    updatedAtMs: overrides.updatedAtMs ?? 1_000,
  };
}

function createQueries(params?: {
  availability?: DoltQueryAvailability;
  records?: Record<string, DoltQueryRecord>;
  childrenByParent?: Record<string, DoltQueryRecord[]>;
  activeBySessionLevel?: Record<string, string[]>;
  ghostSummaryByBindle?: Record<string, string>;
}): DoltReadOnlyQueryHelpers {
  const availability = params?.availability ?? {
    available: true,
    dbPath: "/tmp/dolt.db",
  };
  const records = params?.records ?? {};
  const childrenByParent = params?.childrenByParent ?? {};
  const activeBySessionLevel = params?.activeBySessionLevel ?? {};
  const ghostSummaryByBindle = params?.ghostSummaryByBindle ?? {};

  return {
    getAvailability: () => availability,
    getRecord: (pointer) => records[pointer] ?? null,
    listDirectChildren: (parentPointer) =>
      (childrenByParent[parentPointer] ?? []).map((child, idx) => ({
        parentPointer,
        childPointer: child.pointer,
        childIndex: idx,
        childLevel: child.level,
        createdAtMs: child.createdAtMs,
      })),
    listDirectChildRecords: (parentPointer) => childrenByParent[parentPointer] ?? [],
    listActiveLane: (sessionId, level) => {
      const key = `${sessionId}:${level}`;
      return (activeBySessionLevel[key] ?? []).map((pointer) => ({
        sessionId,
        sessionKey: null,
        level,
        pointer,
        isActive: true,
        lastEventTsMs: 1_000,
        updatedAtMs: 1_000,
      }));
    },
    getGhostSummary: (bindlePointer) => {
      const summary = ghostSummaryByBindle[bindlePointer];
      if (!summary) {
        return null;
      }
      return {
        bindlePointer,
        summaryText: summary,
        tokenCount: 10,
        row: {},
      };
    },
    searchTurnPayloads: () => [],
  };
}

function getText(
  result: Awaited<ReturnType<ReturnType<typeof createDoltExpandTool>["execute"]>>,
): string {
  return String(result.content?.[0]?.text ?? "");
}

describe("dolt_expand", () => {
  it("returns a no-context message when dolt.db is unavailable", async () => {
    const tool = createDoltExpandTool({
      sessionKey: "agent:main:subagent:worker",
      queries: createQueries({
        availability: {
          available: false,
          dbPath: "/tmp/missing/dolt.db",
          reason: "missing_db",
        },
      }),
    });

    const result = await tool.execute("call1", { pointer: "leaf:missing" });
    expect(getText(result)).toContain("No context data yet.");
  });

  it("rejects calls from main sessions", async () => {
    const tool = createDoltExpandTool({
      sessionKey: "agent:main:main",
      queries: createQueries(),
    });

    const result = await tool.execute("call2", { pointer: "leaf:session-1:100:1" });
    const text = getText(result);

    expect(text).toContain("ERROR: Only sub-agents can expand dolt pointers.");
    expect(text).toContain(
      'Task(prompt="Use dolt_expand on leaf:session-1:100:1 to find <your question>")',
    );
  });

  it("returns not found for missing pointers", async () => {
    const tool = createDoltExpandTool({
      sessionKey: "agent:main:subagent:worker",
      queries: createQueries(),
    });

    const result = await tool.execute("call3", { pointer: "leaf:missing" });
    expect(getText(result)).toBe('No Dolt record found for pointer "leaf:missing".');
  });

  it("rejects turn pointers with guidance", async () => {
    const turn = createRecord({
      pointer: "turn:session-1:100:1",
      level: "turn",
      payload: { role: "assistant", content: "hello" },
    });
    const tool = createDoltExpandTool({
      sessionKey: "agent:main:subagent:worker",
      queries: createQueries({
        records: {
          [turn.pointer]: turn,
        },
      }),
    });

    const result = await tool.execute("call4", { pointer: turn.pointer });
    const text = getText(result);
    expect(text).toContain("resolves to a turn record");
    expect(text).toContain("Use dolt_describe");
  });

  it("expands bindles into child leaf summaries", async () => {
    const bindle = createRecord({
      pointer: "bindle:session-1:100:1",
      level: "bindle",
      payload: { summary: "bindle payload summary" },
      tokenCount: 200,
    });
    const leaf1 = createRecord({
      pointer: "leaf:session-1:90:1",
      level: "leaf",
      payload: { summary: "first summary" },
      tokenCount: 90,
    });
    const leaf2 = createRecord({
      pointer: "leaf:session-1:95:1",
      level: "leaf",
      payload: { summary: "second summary" },
      tokenCount: 95,
    });

    const tool = createDoltExpandTool({
      sessionKey: "agent:main:subagent:worker",
      queries: createQueries({
        records: {
          [bindle.pointer]: bindle,
        },
        childrenByParent: {
          [bindle.pointer]: [leaf1, leaf2],
        },
        activeBySessionLevel: {
          "session-1:bindle": [bindle.pointer],
        },
        ghostSummaryByBindle: {
          [bindle.pointer]: "ghost summary text",
        },
      }),
    });

    const result = await tool.execute("call5", { pointer: bindle.pointer });
    const text = getText(result);
    expect(text).toContain(`Pointer: ${bindle.pointer}`);
    expect(text).toContain("Status: active");
    expect(text).toContain("Ghost summary: ghost summary text");
    expect(text).toContain("--- Child 1");
    expect(text).toContain("first summary");
    expect(text).toContain("--- Child 2");
    expect(text).toContain("second summary");
  });

  it("expands leaves into child turn content (role + content)", async () => {
    const leaf = createRecord({
      pointer: "leaf:session-2:100:1",
      level: "leaf",
      payload: { summary: "leaf summary" },
      tokenCount: 100,
    });
    const turn = createRecord({
      pointer: "turn:session-2:105:1",
      level: "turn",
      payload: {
        role: "assistant",
        content: [
          { type: "text", text: "hello" },
          { type: "text", text: "world" },
        ],
      },
      tokenCount: 20,
    });

    const tool = createDoltExpandTool({
      sessionKey: "agent:main:subagent:worker",
      queries: createQueries({
        records: {
          [leaf.pointer]: leaf,
        },
        childrenByParent: {
          [leaf.pointer]: [turn],
        },
      }),
    });

    const result = await tool.execute("call6", { pointer: leaf.pointer });
    const text = getText(result);
    expect(text).toContain(`Pointer: ${leaf.pointer}`);
    expect(text).toContain("Role: assistant");
    expect(text).toContain("hello\nworld");
  });

  it("falls back to payload text when no lineage children are found", async () => {
    const leaf = createRecord({
      pointer: "leaf:session-3:100:1",
      level: "leaf",
      payload: { summary: "self summary" },
      tokenCount: 100,
    });

    const tool = createDoltExpandTool({
      sessionKey: "agent:main:subagent:worker",
      queries: createQueries({
        records: {
          [leaf.pointer]: leaf,
        },
        childrenByParent: {
          [leaf.pointer]: [],
        },
      }),
    });

    const result = await tool.execute("call7", { pointer: leaf.pointer });
    const text = getText(result);
    expect(text).toContain("No lineage children were found for this pointer.");
    expect(text).toContain("self summary");
  });

  it("caps output near 40k and appends truncation guidance", async () => {
    const bindle = createRecord({
      pointer: "bindle:session-4:100:1",
      level: "bindle",
      payload: { summary: "root" },
      tokenCount: 400,
    });

    const children = Array.from({ length: 50 }, (_unused, idx) =>
      createRecord({
        pointer: `leaf:session-4:${idx}:1`,
        level: "leaf",
        tokenCount: 50,
        payload: {
          summary: `summary-${idx} ${"x".repeat(2_000)}`,
        },
      }),
    );

    const tool = createDoltExpandTool({
      sessionKey: "agent:main:subagent:worker",
      queries: createQueries({
        records: {
          [bindle.pointer]: bindle,
        },
        childrenByParent: {
          [bindle.pointer]: children,
        },
      }),
    });

    const result = await tool.execute("call8", { pointer: bindle.pointer });
    const text = getText(result);
    expect(text.length).toBeLessThanOrEqual(40_000);
    expect(text).toContain("--- Truncated:");
    expect(text).toContain("Use dolt_describe on individual child pointers.");
  });
});

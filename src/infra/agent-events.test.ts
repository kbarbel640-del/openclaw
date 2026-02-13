import { describe, expect, test } from "vitest";
import {
  clearAgentRunContext,
  emitAgentEvent,
  getAgentRunContext,
  onAgentEvent,
  registerAgentRunContext,
  resetAgentRunContextForTest,
  resolveRunIdBySessionKey,
} from "./agent-events.js";

describe("agent-events sequencing", () => {
  test("stores and clears run context", async () => {
    resetAgentRunContextForTest();
    registerAgentRunContext("run-1", { sessionKey: "main" });
    expect(getAgentRunContext("run-1")?.sessionKey).toBe("main");
    clearAgentRunContext("run-1");
    expect(getAgentRunContext("run-1")).toBeUndefined();
  });

  test("maintains monotonic seq per runId", async () => {
    const seen: Record<string, number[]> = {};
    const stop = onAgentEvent((evt) => {
      const list = seen[evt.runId] ?? [];
      seen[evt.runId] = list;
      list.push(evt.seq);
    });

    emitAgentEvent({ runId: "run-1", stream: "lifecycle", data: {} });
    emitAgentEvent({ runId: "run-1", stream: "lifecycle", data: {} });
    emitAgentEvent({ runId: "run-2", stream: "lifecycle", data: {} });
    emitAgentEvent({ runId: "run-1", stream: "lifecycle", data: {} });

    stop();

    expect(seen["run-1"]).toEqual([1, 2, 3]);
    expect(seen["run-2"]).toEqual([1]);
  });

  test("resolveRunIdBySessionKey returns runId after registration", () => {
    resetAgentRunContextForTest();
    registerAgentRunContext("run-A", { sessionKey: "sk-1" });
    expect(resolveRunIdBySessionKey("sk-1")).toBe("run-A");
    expect(resolveRunIdBySessionKey("sk-unknown")).toBeUndefined();
  });

  test("resolveRunIdBySessionKey updates on re-registration with new sessionKey", () => {
    resetAgentRunContextForTest();
    registerAgentRunContext("run-B", { sessionKey: "sk-old" });
    registerAgentRunContext("run-B", { sessionKey: "sk-new" });
    expect(resolveRunIdBySessionKey("sk-new")).toBe("run-B");
    expect(resolveRunIdBySessionKey("sk-old")).toBe("run-B");
  });

  test("resetAgentRunContextForTest clears sessionKey reverse map", () => {
    registerAgentRunContext("run-C", { sessionKey: "sk-clear" });
    expect(resolveRunIdBySessionKey("sk-clear")).toBe("run-C");
    resetAgentRunContextForTest();
    expect(resolveRunIdBySessionKey("sk-clear")).toBeUndefined();
  });

  test("preserves compaction ordering on the event bus", async () => {
    const phases: Array<string> = [];
    const stop = onAgentEvent((evt) => {
      if (evt.runId !== "run-1") {
        return;
      }
      if (evt.stream !== "compaction") {
        return;
      }
      if (typeof evt.data?.phase === "string") {
        phases.push(evt.data.phase);
      }
    });

    emitAgentEvent({ runId: "run-1", stream: "compaction", data: { phase: "start" } });
    emitAgentEvent({
      runId: "run-1",
      stream: "compaction",
      data: { phase: "end", willRetry: false },
    });

    stop();

    expect(phases).toEqual(["start", "end"]);
  });
});

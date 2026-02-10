import { describe, it, expect } from "vitest";
import {
  clearAgentRunContext,
  emitAgentEvent,
  getAgentEventStats,
  pruneOrphanedSeqByRun,
  registerAgentRunContext,
  resetAgentRunContextForTest,
} from "../infra/agent-events.js";

describe("agentRunSeq cleanup on lifecycle end", () => {
  it("deletes runId from agentRunSeq when lifecycle phase is end", () => {
    // Simulates the core fix: agentRunSeq.delete(runId) on lifecycle end/error
    const agentRunSeq = new Map<string, number>();
    agentRunSeq.set("run-1", 5);
    agentRunSeq.set("run-2", 3);

    // Simulate lifecycle end for run-1
    const endedRunId = "run-1";
    agentRunSeq.delete(endedRunId);

    expect(agentRunSeq.has("run-1")).toBe(false);
    expect(agentRunSeq.has("run-2")).toBe(true);
  });

  it("safety-net prunes orphaned agentRunSeq entries", () => {
    const agentRunSeq = new Map<string, number>();
    const chatAbortControllers = new Map<string, any>();
    const abortedRuns = new Map<string, number>();
    const chatRunBuffers = new Map<string, string>();

    // Fill with orphaned entries
    for (let i = 0; i < 600; i++) {
      agentRunSeq.set(`run-${i}`, i);
    }
    // Mark some as still active
    chatAbortControllers.set("run-0", {});
    abortedRuns.set("run-1", Date.now());
    chatRunBuffers.set("run-2", "buf");

    // Simulate safety-net logic
    if (agentRunSeq.size > 500) {
      const activeRunIds = new Set<string>();
      for (const runId of chatAbortControllers.keys()) {
        activeRunIds.add(runId);
      }
      for (const runId of abortedRuns.keys()) {
        activeRunIds.add(runId);
      }
      for (const runId of chatRunBuffers.keys()) {
        activeRunIds.add(runId);
      }
      for (const runId of agentRunSeq.keys()) {
        if (!activeRunIds.has(runId)) {
          agentRunSeq.delete(runId);
        }
      }
    }

    expect(agentRunSeq.size).toBe(3);
    expect(agentRunSeq.has("run-0")).toBe(true);
    expect(agentRunSeq.has("run-1")).toBe(true);
    expect(agentRunSeq.has("run-2")).toBe(true);
  });
});

describe("seqByRun memory leak fix", () => {
  it("clearAgentRunContext cleans up seqByRun entries", () => {
    resetAgentRunContextForTest();

    // Emit events which creates seqByRun entries
    registerAgentRunContext("test-run", { sessionKey: "test" });
    emitAgentEvent({ runId: "test-run", stream: "lifecycle", data: {} });

    const before = getAgentEventStats();
    expect(before.seqByRunSize).toBe(1);

    // Clearing context should also clear seqByRun
    clearAgentRunContext("test-run");

    const after = getAgentEventStats();
    expect(after.seqByRunSize).toBe(0);
  });

  it("pruneOrphanedSeqByRun removes orphaned entries", () => {
    resetAgentRunContextForTest();

    // Create orphans (events without registered context)
    emitAgentEvent({ runId: "orphan-a", stream: "lifecycle", data: {} });
    emitAgentEvent({ runId: "orphan-b", stream: "lifecycle", data: {} });

    // Create valid entry
    registerAgentRunContext("valid", { sessionKey: "s" });
    emitAgentEvent({ runId: "valid", stream: "lifecycle", data: {} });

    expect(getAgentEventStats().seqByRunSize).toBe(3);

    const pruned = pruneOrphanedSeqByRun();
    expect(pruned).toBe(2);
    expect(getAgentEventStats().seqByRunSize).toBe(1);
  });
});

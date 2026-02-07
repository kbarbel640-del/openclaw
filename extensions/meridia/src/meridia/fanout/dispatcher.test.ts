import { describe, expect, it } from "vitest";
import type { ExperienceKit } from "../types.js";
import { FanoutDispatcher } from "./dispatcher.js";

function makeKit(): ExperienceKit {
  return {
    version: 2,
    id: "kit-1",
    ts: new Date().toISOString(),
    kind: "tool_result",
    session: { key: "s1" },
    tool: { name: "bash", callId: "tc-1", isError: false },
    capture: {
      significance: 0.9,
      threshold: 0.6,
      mode: "full",
      reason: "test",
    },
    content: { summary: "test kit" },
  };
}

describe("fanout/dispatcher", () => {
  it("dispatches to registered handlers", async () => {
    const dispatcher = new FanoutDispatcher();
    const calls: string[] = [];

    dispatcher.register("graph", async () => {
      calls.push("graph");
    });
    dispatcher.register("vector", async () => {
      calls.push("vector");
    });

    const results = await dispatcher.dispatch(makeKit());

    expect(results).toHaveLength(2);
    expect(calls).toContain("graph");
    expect(calls).toContain("vector");
    expect(results.every((r) => r.success)).toBe(true);
  });

  it("reports failure for unregistered targets", async () => {
    const dispatcher = new FanoutDispatcher();
    const results = await dispatcher.dispatch(makeKit(), ["graph"]);

    expect(results).toHaveLength(1);
    expect(results[0]!.success).toBe(false);
    expect(results[0]!.error).toContain("No handler registered");
  });

  it("isolates errors from individual handlers", async () => {
    const dispatcher = new FanoutDispatcher();

    dispatcher.register("graph", async () => {
      throw new Error("Graph sync failed");
    });
    dispatcher.register("vector", async () => {
      // succeeds
    });

    const results = await dispatcher.dispatch(makeKit());

    expect(results).toHaveLength(2);
    const graphResult = results.find((r) => r.target === "graph");
    const vectorResult = results.find((r) => r.target === "vector");
    expect(graphResult!.success).toBe(false);
    expect(graphResult!.error).toBe("Graph sync failed");
    expect(vectorResult!.success).toBe(true);
  });

  it("measures duration", async () => {
    const dispatcher = new FanoutDispatcher();

    dispatcher.register("graph", async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const results = await dispatcher.dispatch(makeKit());
    expect(results[0]!.durationMs).toBeGreaterThanOrEqual(5);
  });

  it("dispatches to specific targets only", async () => {
    const dispatcher = new FanoutDispatcher();
    const calls: string[] = [];

    dispatcher.register("graph", async () => calls.push("graph"));
    dispatcher.register("vector", async () => calls.push("vector"));
    dispatcher.register("compaction", async () => calls.push("compaction"));

    const results = await dispatcher.dispatch(makeKit(), ["vector"]);

    expect(results).toHaveLength(1);
    expect(calls).toEqual(["vector"]);
  });

  it("getRegisteredTargets returns registered keys", () => {
    const dispatcher = new FanoutDispatcher();
    dispatcher.register("graph", async () => {});
    dispatcher.register("vector", async () => {});

    const targets = dispatcher.getRegisteredTargets();
    expect(targets).toContain("graph");
    expect(targets).toContain("vector");
    expect(targets).not.toContain("compaction");
  });

  it("handles empty dispatch (no registered handlers)", async () => {
    const dispatcher = new FanoutDispatcher();
    const results = await dispatcher.dispatch(makeKit());
    expect(results).toEqual([]);
  });

  it("handles handler that returns non-Error throw", async () => {
    const dispatcher = new FanoutDispatcher();
    dispatcher.register("graph", async () => {
      throw "string error";
    });

    const results = await dispatcher.dispatch(makeKit());
    expect(results[0]!.success).toBe(false);
    expect(results[0]!.error).toBe("string error");
  });

  it("overwrites handler when registering same target", async () => {
    const dispatcher = new FanoutDispatcher();
    const calls: string[] = [];

    dispatcher.register("graph", async () => calls.push("first"));
    dispatcher.register("graph", async () => calls.push("second"));

    await dispatcher.dispatch(makeKit());
    expect(calls).toEqual(["second"]);
  });
});

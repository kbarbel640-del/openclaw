import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import { DelegationAutoRunScheduler, type DelegationAutoRunItem } from "./delegation-auto-run.js";

describe("DelegationAutoRunScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("honors explicit disable via agents.defaults.delegation.autoRun=false", async () => {
    const runAgent = vi.fn(async () => {});
    const s = new DelegationAutoRunScheduler({
      now: () => Date.now(),
      setTimeout,
      clearTimeout,
      runAgent,
    });

    const cfg = {
      agents: { defaults: { delegation: { autoRun: false, debounceMs: 1 } } },
    } as unknown as OpenClawConfig;
    s.schedule({
      cfg,
      targetAgentId: "worker-1",
      item: {
        delegationId: "d1",
        direction: "downward",
        priority: "normal",
        fromAgentId: "orchestrator",
        task: "do thing",
        state: "assigned",
      },
    });

    await vi.runAllTimersAsync();
    expect(runAgent).toHaveBeenCalledTimes(0);
  });

  it("is enabled by default when delegation.autoRun is not configured", async () => {
    const runAgent = vi.fn(async () => {});
    const s = new DelegationAutoRunScheduler({
      now: () => Date.now(),
      setTimeout,
      clearTimeout,
      runAgent,
    });

    const cfg = {} as unknown as OpenClawConfig;
    s.schedule({
      cfg,
      targetAgentId: "worker-1",
      item: {
        delegationId: "d1",
        direction: "downward",
        priority: "normal",
        fromAgentId: "orchestrator",
        task: "do thing",
        state: "assigned",
      },
    });

    await vi.runAllTimersAsync();
    expect(runAgent).toHaveBeenCalledTimes(1);
  });

  it("debounces and batches multiple delegations per agent", async () => {
    const runAgent = vi.fn(async () => {});
    const s = new DelegationAutoRunScheduler({
      now: () => Date.now(),
      setTimeout,
      clearTimeout,
      runAgent,
    });

    const cfg = {
      agents: { defaults: { delegation: { autoRun: true, debounceMs: 50 } } },
    } as unknown as OpenClawConfig;
    const item1: DelegationAutoRunItem = {
      delegationId: "d1",
      direction: "downward",
      priority: "high",
      fromAgentId: "orchestrator",
      task: "first task",
      state: "assigned",
    };
    const item2: DelegationAutoRunItem = {
      delegationId: "d2",
      direction: "upward",
      priority: "normal",
      fromAgentId: "specialist",
      task: "second task",
      state: "pending_review",
    };

    s.schedule({ cfg, targetAgentId: "agent-a", item: item1 });
    s.schedule({ cfg, targetAgentId: "agent-a", item: item2 });

    expect(runAgent).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(60);

    expect(runAgent).toHaveBeenCalledTimes(1);
    const call = runAgent.mock.calls[0]?.[0];
    expect(call.agentId).toBe("agent-a");
    expect(call.message).toContain("d1");
    expect(call.message).toContain("d2");
    expect(call.message).toContain("For upward requests:");
    expect(call.message).toContain("For downward assignments:");
    expect(call.message).toContain(
      "- Use the delegation tool to review each request (approve/reject/redirect) with clear reasoning.",
    );
    expect(call.message).toContain(
      "- Use the delegation tool to accept, do the work, then complete with a concise result summary.",
    );
  });
});

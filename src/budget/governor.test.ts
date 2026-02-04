import { describe, expect, it, vi } from "vitest";
import { BudgetGovernor, createBudgetGovernor } from "./governor.js";
import { CHEAP_LIMITS, NORMAL_LIMITS } from "./profiles.js";

describe("BudgetGovernor", () => {
  describe("construction", () => {
    it("creates with default profile", () => {
      const governor = createBudgetGovernor();
      const status = governor.getStatus();
      expect(status.profileId).toBe("normal");
      expect(status.profileName).toBe("Normal");
    });

    it("creates with cheap profile", () => {
      const governor = createBudgetGovernor({ profileId: "cheap" });
      const status = governor.getStatus();
      expect(status.profileId).toBe("cheap");
    });

    it("throws when deep profile not armed", () => {
      expect(() => createBudgetGovernor({ profileId: "deep" })).toThrow(
        'Budget profile "deep" requires explicit arming',
      );
    });

    it("creates deep profile when armed", () => {
      const governor = createBudgetGovernor({ profileId: "deep", deepArmed: true });
      const status = governor.getStatus();
      expect(status.profileId).toBe("deep");
      expect(status.isArmed).toBe(true);
    });

    it("applies limit overrides", () => {
      const governor = createBudgetGovernor({
        profileId: "cheap",
        limitOverrides: { maxToolCalls: 20 },
      });
      const status = governor.getStatus();
      expect(status.limits.maxToolCalls).toBe(20);
    });
  });

  describe("recordToolCall", () => {
    it("increments tool call count", () => {
      const governor = createBudgetGovernor({ profileId: "cheap" });
      governor.recordToolCall();
      governor.recordToolCall();
      const usage = governor.getUsage();
      expect(usage.toolCalls).toBe(2);
    });

    it("tracks web_search calls separately", () => {
      const governor = createBudgetGovernor({ profileId: "normal" });
      governor.recordToolCall("web_search");
      governor.recordToolCall("other_tool");
      const usage = governor.getUsage();
      expect(usage.toolCalls).toBe(2);
      expect(usage.webSearchCalls).toBe(1);
    });

    it("tracks web_fetch calls separately", () => {
      const governor = createBudgetGovernor({ profileId: "cheap" });
      governor.recordToolCall("web_fetch");
      governor.recordToolCall("web_fetch");
      const usage = governor.getUsage();
      expect(usage.webFetchCalls).toBe(2);
    });

    it("returns allowed=true when under limit", () => {
      const governor = createBudgetGovernor({ profileId: "cheap" });
      const result = governor.recordToolCall();
      expect(result.allowed).toBe(true);
    });

    it("returns allowed=false when limit exceeded", () => {
      const governor = createBudgetGovernor({
        profileId: "cheap",
        limitOverrides: { maxToolCalls: 2 },
      });
      governor.recordToolCall();
      governor.recordToolCall();
      const result = governor.recordToolCall();
      expect(result.allowed).toBe(false);
      expect(result.exceededLimit).toBe("maxToolCalls");
      expect(result.currentValue).toBe(2);
      expect(result.limitValue).toBe(2);
    });
  });

  describe("recordLlmCall", () => {
    it("increments LLM call count", () => {
      const governor = createBudgetGovernor({ profileId: "normal" });
      governor.recordLlmCall();
      governor.recordLlmCall();
      const usage = governor.getUsage();
      expect(usage.llmCalls).toBe(2);
    });

    it("tracks token usage", () => {
      const governor = createBudgetGovernor({ profileId: "normal" });
      governor.recordLlmCall({
        input: 1000,
        output: 500,
        cacheRead: 200,
        cacheWrite: 100,
      });
      const usage = governor.getUsage();
      expect(usage.tokensInput).toBe(1000);
      expect(usage.tokensOutput).toBe(500);
      expect(usage.tokensCacheRead).toBe(200);
      expect(usage.tokensCacheWrite).toBe(100);
    });

    it("accumulates token usage across calls", () => {
      const governor = createBudgetGovernor({ profileId: "normal" });
      governor.recordLlmCall({ input: 1000, output: 500 });
      governor.recordLlmCall({ input: 2000, output: 1000 });
      const usage = governor.getUsage();
      expect(usage.tokensInput).toBe(3000);
      expect(usage.tokensOutput).toBe(1500);
    });

    it("tracks cost", () => {
      const governor = createBudgetGovernor({ profileId: "normal" });
      governor.recordLlmCall({ costUsd: 0.05 });
      governor.recordLlmCall({ costUsd: 0.1 });
      const usage = governor.getUsage();
      expect(usage.estimatedCostUsd).toBeCloseTo(0.15, 10);
    });

    it("stops when token limit exceeded", () => {
      const governor = createBudgetGovernor({
        profileId: "cheap",
        limitOverrides: { maxTokens: 1000 },
      });
      const result = governor.recordLlmCall({ input: 800, output: 300 });
      expect(result.allowed).toBe(false);
      expect(result.exceededLimit).toBe("maxTokens");
    });

    it("stops when cost limit exceeded", () => {
      const governor = createBudgetGovernor({
        profileId: "cheap",
        limitOverrides: { maxCostUsd: 0.05 },
      });
      const result = governor.recordLlmCall({ costUsd: 0.06 });
      expect(result.allowed).toBe(false);
      expect(result.exceededLimit).toBe("maxCostUsd");
    });
  });

  describe("recordSubagentSpawn", () => {
    it("increments subagent count", () => {
      const governor = createBudgetGovernor({ profileId: "normal" });
      governor.recordSubagentSpawn();
      const usage = governor.getUsage();
      expect(usage.subagentSpawns).toBe(1);
    });

    it("stops when subagent limit exceeded", () => {
      const governor = createBudgetGovernor({
        profileId: "cheap",
        limitOverrides: { maxSubagentSpawns: 1 },
      });
      governor.recordSubagentSpawn();
      const result = governor.recordSubagentSpawn();
      expect(result.allowed).toBe(false);
      expect(result.exceededLimit).toBe("maxSubagentSpawns");
    });

    it("cheap profile blocks subagents by default", () => {
      const governor = createBudgetGovernor({ profileId: "cheap" });
      const result = governor.recordSubagentSpawn();
      // maxSubagentSpawns is 0 for cheap profile
      expect(result.allowed).toBe(false);
    });
  });

  describe("recordRetry", () => {
    it("increments retry count", () => {
      const governor = createBudgetGovernor({ profileId: "normal" });
      governor.recordRetry();
      governor.recordRetry();
      const usage = governor.getUsage();
      expect(usage.retryAttempts).toBe(2);
    });

    it("stops when retry limit exceeded", () => {
      const governor = createBudgetGovernor({
        profileId: "cheap",
        limitOverrides: { maxRetryAttempts: 2 },
      });
      governor.recordRetry();
      governor.recordRetry();
      const result = governor.recordRetry();
      expect(result.allowed).toBe(false);
      expect(result.exceededLimit).toBe("maxRetryAttempts");
    });
  });

  describe("recordError (loop detection)", () => {
    it("allows first occurrence", () => {
      const governor = createBudgetGovernor({ profileId: "normal" });
      const result = governor.recordError(new Error("API timeout"));
      expect(result.allowed).toBe(true);
    });

    it("allows second occurrence", () => {
      const governor = createBudgetGovernor({ profileId: "normal" });
      const error = new Error("API timeout");
      governor.recordError(error);
      const result = governor.recordError(error);
      expect(result.allowed).toBe(true);
    });

    it("stops on third occurrence (loop detected)", () => {
      const governor = createBudgetGovernor({ profileId: "normal" });
      const error = new Error("API timeout");
      governor.recordError(error);
      governor.recordError(error);
      const result = governor.recordError(error);
      expect(result.allowed).toBe(false);
      expect(result.exceededLimit).toBe("errorLoopDetected");
      expect(result.currentValue).toBe(3);
    });

    it("tracks different errors separately", () => {
      const governor = createBudgetGovernor({ profileId: "normal" });
      governor.recordError(new Error("Error A"));
      governor.recordError(new Error("Error A"));
      governor.recordError(new Error("Error B"));
      governor.recordError(new Error("Error B"));
      // Neither has hit 3 yet
      const result = governor.recordError(new Error("Error C"));
      expect(result.allowed).toBe(true);
    });

    it("handles string errors", () => {
      const governor = createBudgetGovernor({ profileId: "normal" });
      governor.recordError("string error");
      governor.recordError("string error");
      const result = governor.recordError("string error");
      expect(result.allowed).toBe(false);
      expect(result.exceededLimit).toBe("errorLoopDetected");
    });
  });

  describe("checkBrowserAllowed", () => {
    it("returns allowed=false for cheap profile", () => {
      const governor = createBudgetGovernor({ profileId: "cheap" });
      const result = governor.checkBrowserAllowed();
      expect(result.allowed).toBe(false);
      expect(result.exceededLimit).toBe("browserEnabled");
    });

    it("returns allowed=false for normal profile", () => {
      const governor = createBudgetGovernor({ profileId: "normal" });
      const result = governor.checkBrowserAllowed();
      expect(result.allowed).toBe(false);
    });

    it("returns allowed=true for deep profile", () => {
      const governor = createBudgetGovernor({ profileId: "deep", deepArmed: true });
      const result = governor.checkBrowserAllowed();
      expect(result.allowed).toBe(true);
    });
  });

  describe("isStopped", () => {
    it("returns false initially", () => {
      const governor = createBudgetGovernor({ profileId: "normal" });
      expect(governor.isStopped()).toBe(false);
    });

    it("returns true after limit exceeded", () => {
      const governor = createBudgetGovernor({
        profileId: "cheap",
        limitOverrides: { maxToolCalls: 1 },
      });
      governor.recordToolCall();
      governor.recordToolCall();
      expect(governor.isStopped()).toBe(true);
    });

    it("returns true after forceStop", () => {
      const governor = createBudgetGovernor({ profileId: "normal" });
      governor.forceStop("Manual stop");
      expect(governor.isStopped()).toBe(true);
      expect(governor.getStopReason()?.message).toBe("Manual stop");
    });
  });

  describe("getStatus", () => {
    it("returns percentages", () => {
      const governor = createBudgetGovernor({
        profileId: "cheap",
        limitOverrides: { maxToolCalls: 10 },
      });
      governor.recordToolCall();
      governor.recordToolCall();
      governor.recordToolCall();
      const status = governor.getStatus();
      expect(status.percentages.toolCalls).toBe(30);
    });

    it("tracks runtime", () => {
      const governor = createBudgetGovernor({ profileId: "normal" });
      const status = governor.getStatus();
      expect(status.usage.runtimeMs).toBeGreaterThanOrEqual(0);
      expect(status.startedAt).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("callbacks", () => {
    it("calls onLimitExceeded when limit hit", () => {
      const onLimitExceeded = vi.fn();
      const governor = createBudgetGovernor({
        profileId: "cheap",
        limitOverrides: { maxToolCalls: 1 },
        onLimitExceeded,
      });
      governor.recordToolCall();
      governor.recordToolCall();
      expect(onLimitExceeded).toHaveBeenCalledTimes(1);
      expect(onLimitExceeded).toHaveBeenCalledWith(
        expect.objectContaining({ exceededLimit: "maxToolCalls" }),
      );
    });

    it("calls onUsageUpdate on each record", () => {
      const onUsageUpdate = vi.fn();
      const governor = createBudgetGovernor({
        profileId: "normal",
        onUsageUpdate,
      });
      governor.recordToolCall();
      governor.recordToolCall();
      expect(onUsageUpdate).toHaveBeenCalledTimes(2);
    });
  });

  describe("subscribe", () => {
    it("emits usage_update events", () => {
      const governor = createBudgetGovernor({ profileId: "normal" });
      const events: string[] = [];
      governor.subscribe((event) => events.push(event.type));
      governor.recordToolCall();
      expect(events).toContain("usage_update");
    });

    it("emits limit_exceeded event", () => {
      const governor = createBudgetGovernor({
        profileId: "cheap",
        limitOverrides: { maxToolCalls: 1 },
      });
      const events: string[] = [];
      governor.subscribe((event) => events.push(event.type));
      governor.recordToolCall();
      governor.recordToolCall();
      expect(events).toContain("limit_exceeded");
    });

    it("emits error_loop_detected event", () => {
      const governor = createBudgetGovernor({ profileId: "normal" });
      const events: string[] = [];
      governor.subscribe((event) => events.push(event.type));
      const error = new Error("repeat");
      governor.recordError(error);
      governor.recordError(error);
      governor.recordError(error);
      expect(events).toContain("error_loop_detected");
    });

    it("emits workflow_complete event", () => {
      const governor = createBudgetGovernor({ profileId: "normal" });
      const events: string[] = [];
      governor.subscribe((event) => events.push(event.type));
      governor.complete();
      expect(events).toContain("workflow_complete");
    });

    it("returns unsubscribe function", () => {
      const governor = createBudgetGovernor({ profileId: "normal" });
      const events: string[] = [];
      const unsubscribe = governor.subscribe((event) => events.push(event.type));
      governor.recordToolCall();
      expect(events.length).toBe(1);
      unsubscribe();
      governor.recordToolCall();
      expect(events.length).toBe(1); // No new events after unsubscribe
    });
  });

  describe("stopped workflow behavior", () => {
    it("rejects further tool calls after stop", () => {
      const governor = createBudgetGovernor({
        profileId: "cheap",
        limitOverrides: { maxToolCalls: 1 },
      });
      governor.recordToolCall();
      governor.recordToolCall(); // This stops it

      const result = governor.recordToolCall();
      expect(result.allowed).toBe(false);
      expect(governor.getUsage().toolCalls).toBe(1); // Count didn't increment
    });

    it("rejects LLM calls after stop", () => {
      const governor = createBudgetGovernor({ profileId: "normal" });
      governor.forceStop("Stopped");
      const result = governor.recordLlmCall({ input: 100 });
      expect(result.allowed).toBe(false);
    });
  });
});

describe("runtime cap", () => {
  it("stops after runtime limit exceeded", async () => {
    const governor = createBudgetGovernor({
      profileId: "normal",
      limitOverrides: { maxRuntimeMs: 50 },
    });

    // Wait for runtime to exceed limit
    await new Promise((resolve) => setTimeout(resolve, 60));

    const result = governor.checkLimits();
    expect(result.allowed).toBe(false);
    expect(result.exceededLimit).toBe("maxRuntimeMs");
  });

  it("allows operations within runtime limit", () => {
    const governor = createBudgetGovernor({
      profileId: "normal",
      limitOverrides: { maxRuntimeMs: 10000 },
    });

    const result = governor.checkLimits();
    expect(result.allowed).toBe(true);
  });
});

describe("deep mode auto-revert", () => {
  it("includes deep expiry info in status", () => {
    const governor = createBudgetGovernor({
      profileId: "deep",
      deepArmed: true,
      deepArmOptions: { expiresInMs: 60000 },
    });

    const status = governor.getStatus();
    expect(status.deepExpiresAt).toBeDefined();
    expect(status.deepExpiresAt).toBeGreaterThan(Date.now());
  });

  it("includes oneRun flag in status", () => {
    const governor = createBudgetGovernor({
      profileId: "deep",
      deepArmed: true,
      deepArmOptions: { oneRun: true },
    });

    const status = governor.getStatus();
    expect(status.deepOneRun).toBe(true);
  });

  it("auto-reverts on timeout", async () => {
    const onDeepReverted = vi.fn();
    const governor = createBudgetGovernor({
      profileId: "deep",
      deepArmed: true,
      deepArmOptions: { expiresInMs: 50 },
      onDeepReverted,
    });

    expect(governor.isDeepExpired()).toBe(false);
    expect(governor.isDeepReverted()).toBe(false);

    // Wait for expiry
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Trigger check (e.g., via checkLimits)
    governor.checkLimits();

    expect(governor.isDeepExpired()).toBe(true);
    expect(governor.isDeepReverted()).toBe(true);
    expect(onDeepReverted).toHaveBeenCalledTimes(1);
  });

  it("emits deep_reverted event on timeout", async () => {
    const governor = createBudgetGovernor({
      profileId: "deep",
      deepArmed: true,
      deepArmOptions: { expiresInMs: 50 },
    });

    const events: string[] = [];
    governor.subscribe((event) => events.push(event.type));

    await new Promise((resolve) => setTimeout(resolve, 60));
    governor.checkLimits();

    expect(events).toContain("deep_reverted");
  });

  it("auto-reverts on workflow complete when oneRun is set", () => {
    const onDeepReverted = vi.fn();
    const governor = createBudgetGovernor({
      profileId: "deep",
      deepArmed: true,
      deepArmOptions: { oneRun: true },
      onDeepReverted,
    });

    expect(governor.isDeepReverted()).toBe(false);

    governor.complete();

    expect(governor.isDeepReverted()).toBe(true);
    expect(onDeepReverted).toHaveBeenCalledTimes(1);
  });

  it("emits deep_reverted event with oneRun reason", () => {
    const governor = createBudgetGovernor({
      profileId: "deep",
      deepArmed: true,
      deepArmOptions: { oneRun: true },
    });

    const events: Array<{ type: string; reason?: string }> = [];
    governor.subscribe((event) => {
      if (event.type === "deep_reverted") {
        events.push({ type: event.type, reason: event.reason });
      }
    });

    governor.complete();

    expect(events).toContainEqual({ type: "deep_reverted", reason: "oneRun" });
  });

  it("status shows isArmed=false after revert", () => {
    const governor = createBudgetGovernor({
      profileId: "deep",
      deepArmed: true,
      deepArmOptions: { oneRun: true },
    });

    expect(governor.getStatus().isArmed).toBe(true);

    governor.complete();

    expect(governor.getStatus().isArmed).toBe(false);
  });

  it("does not auto-revert when oneRun is not set", () => {
    const onDeepReverted = vi.fn();
    const governor = createBudgetGovernor({
      profileId: "deep",
      deepArmed: true,
      onDeepReverted,
    });

    governor.complete();

    expect(governor.isDeepReverted()).toBe(false);
    expect(onDeepReverted).not.toHaveBeenCalled();
  });
});

describe("tool loop halting (integration)", () => {
  it("halts deterministically after repeated tool call errors", () => {
    const governor = createBudgetGovernor({ profileId: "normal" });
    const error = new Error("Tool execution failed: API rate limit");

    // Simulate a tool loop with repeated errors
    let halted = false;
    for (let i = 0; i < 10; i++) {
      const result = governor.recordError(error);
      if (!result.allowed) {
        halted = true;
        expect(result.exceededLimit).toBe("errorLoopDetected");
        expect(i).toBe(2); // Should halt on 3rd attempt (index 2)
        break;
      }
    }

    expect(halted).toBe(true);
    expect(governor.isStopped()).toBe(true);
  });

  it("halts after max tool calls in a tight loop", () => {
    const governor = createBudgetGovernor({
      profileId: "cheap",
      limitOverrides: { maxToolCalls: 5 },
    });

    // Simulate a runaway tool loop
    let halted = false;
    let iterations = 0;
    for (let i = 0; i < 100; i++) {
      iterations++;
      const result = governor.recordToolCall();
      if (!result.allowed) {
        halted = true;
        expect(result.exceededLimit).toBe("maxToolCalls");
        break;
      }
    }

    expect(halted).toBe(true);
    expect(iterations).toBe(5); // Stopped after exactly maxToolCalls
    expect(governor.isStopped()).toBe(true);
  });

  it("halts after max retry attempts", () => {
    const governor = createBudgetGovernor({
      profileId: "normal",
      limitOverrides: { maxRetryAttempts: 3 },
    });

    // Simulate retry loop
    let halted = false;
    for (let i = 0; i < 10; i++) {
      const result = governor.recordRetry();
      if (!result.allowed) {
        halted = true;
        expect(result.exceededLimit).toBe("maxRetryAttempts");
        break;
      }
    }

    expect(halted).toBe(true);
    expect(governor.getUsage().retryAttempts).toBe(3);
  });
});

describe("profiles", () => {
  it("cheap profile has expected limits", () => {
    expect(CHEAP_LIMITS.maxToolCalls).toBe(10);
    expect(CHEAP_LIMITS.maxSubagentSpawns).toBe(0);
    expect(CHEAP_LIMITS.browserEnabled).toBe(false);
    expect(CHEAP_LIMITS.preferredModelTier).toBe("local");
  });

  it("normal profile has expected limits", () => {
    expect(NORMAL_LIMITS.maxToolCalls).toBe(50);
    expect(NORMAL_LIMITS.maxSubagentSpawns).toBe(2);
    expect(NORMAL_LIMITS.browserEnabled).toBe(false);
    expect(NORMAL_LIMITS.preferredModelTier).toBe("standard");
  });
});

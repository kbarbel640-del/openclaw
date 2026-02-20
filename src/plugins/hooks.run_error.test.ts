import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHookRunner } from "./hooks.js";
import { createEmptyPluginRegistry, type PluginRegistry } from "./registry.js";
import type { PluginHookRunErrorResult, PluginHookRunErrorEvent } from "./types.js";

function addRunErrorHook(
  registry: PluginRegistry,
  pluginId: string,
  handler: (event: PluginHookRunErrorEvent) => PluginHookRunErrorResult | Promise<PluginHookRunErrorResult>,
  priority?: number,
) {
  registry.typedHooks.push({
    pluginId,
    hookName: "run_error",
    handler,
    priority,
    source: "test",
  } as unknown as any);
}

const stubCtx = {
  agentId: "test-agent",
  sessionKey: "sk",
  sessionId: "sid",
  workspaceDir: "/tmp",
};

describe("runRunError hook runner", () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = createEmptyPluginRegistry();
  });

  it("returns undefined when no hooks registered", async () => {
    const runner = createHookRunner(registry);
    const result = await runner.runRunError({ attempt: 0 } as any, stubCtx as any);
    expect(result).toBeUndefined();
  });

  it("returns plugin result when a single plugin returns a decision", async () => {
    addRunErrorHook(registry, "plugin-a", () => ({ action: "retry" } as PluginHookRunErrorResult));
    const runner = createHookRunner(registry);
    const result = await runner.runRunError({ attempt: 0 } as any, stubCtx as any);
    expect(result?.action).toBe("retry");
  });

  it("catches plugin errors when catchErrors=true (default)", async () => {
    addRunErrorHook(registry, "bad-plugin", () => {
      throw new Error("boom");
    });
    const runner = createHookRunner(registry, { catchErrors: true });
    // Should not throw, and should return undefined
    const result = await runner.runRunError({ attempt: 0 } as any, stubCtx as any);
    expect(result).toBeUndefined();
  });

  it("throws when plugin errors and catchErrors=false", async () => {
    addRunErrorHook(registry, "bad-plugin", () => {
      throw new Error("boom");
    });
    const runner = createHookRunner(registry, { catchErrors: false });
    await expect(runner.runRunError({ attempt: 0 } as any, stubCtx as any)).rejects.toThrow();
  });

  it("passes the event structure to the plugin handler", async () => {
    let received: PluginHookRunErrorEvent | undefined;
    addRunErrorHook(registry, "inspector", (event) => {
      received = event;
      return { action: "fail" };
    });
    const runner = createHookRunner(registry);
    const ev: PluginHookRunErrorEvent = {
      error: "something went wrong",
      runId: "run-123",
      sessionId: "session-abc",
      agentId: "agent-x",
      provider: "anthropic",
      model: "test-model",
      attempt: 2,
      timedOut: false,
      aborted: false,
    };
    await runner.runRunError(ev as any, stubCtx as any);
    expect(received).toBeDefined();
    expect(received?.runId).toBe("run-123");
    expect(received?.attempt).toBe(2);
  });
});

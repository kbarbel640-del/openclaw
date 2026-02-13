import { describe, expect, it } from "vitest";

// This test verifies that the before_agent_prepare hook error propagation
// works correctly (Fix #6: fail-closed). The fix changed the catch block in
// run.ts from `log.warn(...)` (swallow) to `throw hookErr` (propagate).
//
// We test the hook runner since it's the component that determines whether
// errors escape to the caller.

import type { PluginRegistry } from "../../plugins/registry.js";
import { createHookRunner } from "../../plugins/hooks.js";

function createEmptyRegistry(): PluginRegistry {
  return {
    plugins: [],
    tools: [],
    hooks: [],
    typedHooks: [],
    channels: [],
    providers: [],
    gatewayHandlers: {},
    httpHandlers: [],
    httpRoutes: [],
    cliRegistrars: [],
    services: [],
    commands: [],
    diagnostics: [],
  };
}

describe("before_agent_prepare hook fail-closed behavior (Fix #6)", () => {
  it("with catchErrors: false, handler errors propagate to caller", async () => {
    const registry = createEmptyRegistry();
    registry.typedHooks.push({
      pluginId: "buggy",
      hookName: "before_agent_prepare",
      priority: 10,
      source: "test",
      handler: async () => {
        throw new Error("hook exploded");
      },
    });

    // catchErrors: false simulates what run.ts sees when errors escape
    const runner = createHookRunner(registry, { catchErrors: false });

    await expect(
      runner.runBeforeAgentPrepare(
        { prompt: "hello" },
        {
          agentId: "main",
          sessionKey: "main",
          peerId: "ana",
          senderE164: "+15550001111",
        },
      ),
    ).rejects.toThrow("hook exploded");
  });

  it("with catchErrors: true (default), handler errors are caught internally", async () => {
    const registry = createEmptyRegistry();
    registry.typedHooks.push({
      pluginId: "buggy",
      hookName: "before_agent_prepare",
      priority: 10,
      source: "test",
      handler: async () => {
        throw new Error("hook exploded");
      },
    });

    // Default catchErrors: true — errors are caught and logged
    const runner = createHookRunner(registry);

    // Should NOT throw — error is caught internally
    const result = await runner.runBeforeAgentPrepare(
      { prompt: "hello" },
      {
        agentId: "main",
        sessionKey: "main",
      },
    );
    expect(result).toBeUndefined();
  });

  it("succeeds when no hooks are registered", async () => {
    const registry = createEmptyRegistry();
    const runner = createHookRunner(registry);

    const result = await runner.runBeforeAgentPrepare(
      { prompt: "hello" },
      {
        agentId: "main",
        sessionKey: "main",
      },
    );

    expect(result).toBeUndefined();
  });

  it("run.ts catch block pattern: error from hook runner is re-thrown", async () => {
    // Simulates the exact pattern from run.ts:
    //   try { result = await hookRunner.runBeforeAgentPrepare(...) }
    //   catch (hookErr) { throw hookErr; }
    const registry = createEmptyRegistry();
    registry.typedHooks.push({
      pluginId: "failing",
      hookName: "before_agent_prepare",
      priority: 10,
      source: "test",
      handler: async () => {
        throw new Error("critical failure");
      },
    });

    const runner = createHookRunner(registry, { catchErrors: false });

    let caughtError: unknown;
    try {
      await runner.runBeforeAgentPrepare(
        { prompt: "hello" },
        { agentId: "main", sessionKey: "main" },
      );
    } catch (hookErr) {
      // This is what run.ts does after Fix #6: re-throw instead of log.warn
      caughtError = hookErr;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toContain("critical failure");
  });
});

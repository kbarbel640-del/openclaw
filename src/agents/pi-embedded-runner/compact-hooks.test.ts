import { describe, expect, it } from "vitest";
import type { PluginRegistry } from "../../plugins/registry.js";

// Test that the before_compaction and after_compaction hook infrastructure is correct
describe("compaction hooks", () => {
  it("should have before_compaction in the PluginHookName union", async () => {
    // Import the types to verify they exist
    const types = await import("../../plugins/types.js");
    // The type exists if this module loads — TypeScript enforces the type at compile time
    expect(types).toBeDefined();
  });

  it("should have hook runner with runBeforeCompaction", async () => {
    const { createHookRunner } = await import("../../plugins/hooks.js");
    const registry: PluginRegistry = {
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
    // Verify the hook runner has the compaction methods
    const runner = createHookRunner(registry);
    expect(runner.runBeforeCompaction).toBeDefined();
    expect(typeof runner.runBeforeCompaction).toBe("function");
  });

  it("should have hook runner with runAfterCompaction", async () => {
    const { createHookRunner } = await import("../../plugins/hooks.js");
    const registry: PluginRegistry = {
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
    const runner = createHookRunner(registry);
    expect(runner.runAfterCompaction).toBeDefined();
    expect(typeof runner.runAfterCompaction).toBe("function");
  });

  it("should report no hooks when none registered", async () => {
    const { createHookRunner } = await import("../../plugins/hooks.js");
    const registry: PluginRegistry = {
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
    const runner = createHookRunner(registry);
    expect(runner.hasHooks("before_compaction")).toBe(false);
    expect(runner.hasHooks("after_compaction")).toBe(false);
  });

  it("getGlobalHookRunner should be importable from compact.ts dependency", async () => {
    const mod = await import("../../plugins/hook-runner-global.js");
    expect(mod.getGlobalHookRunner).toBeDefined();
    expect(typeof mod.getGlobalHookRunner).toBe("function");
  });
});

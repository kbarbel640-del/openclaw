import "./run.overflow-compaction.mocks.shared.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runEmbeddedPiAgent } from "./run.js";
import { runEmbeddedAttempt } from "./run/attempt.js";
import { makeAttemptResult } from "./run.overflow-compaction.fixture.js";
import { initializeGlobalHookRunner, resetGlobalHookRunner } from "../../plugins/hook-runner-global.js";
import { createEmptyPluginRegistry } from "../../plugins/registry.js";

const mockedRunEmbeddedAttempt = vi.mocked(runEmbeddedAttempt);

describe("run_error integration with embedded runner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGlobalHookRunner();
  });

  it("auto-retries when plugin returns 'retry' and autoRecover=true", async () => {
    const first = makeAttemptResult({
      lastAssistant: { stopReason: "error", errorMessage: "boom" },
      assistantTexts: [],
      messagesSnapshot: [],
    });
    const second = makeAttemptResult({ assistantTexts: ["ok"] });

    mockedRunEmbeddedAttempt.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    const registry = createEmptyPluginRegistry();
    let receivedEvent: any = null;
    registry.typedHooks.push({
      pluginId: "test-plugin",
      hookName: "run_error",
      handler: (event: unknown) => {
        receivedEvent = event;
        return { action: "retry" };
      },
      priority: 0,
      source: "test",
    } as any);

    initializeGlobalHookRunner(registry);

    await runEmbeddedPiAgent({
      sessionId: "test-session",
      sessionKey: "test-key",
      sessionFile: "/tmp/session.json",
      workspaceDir: "/tmp/workspace",
      prompt: "hello",
      timeoutMs: 30000,
      runId: "run-1",
      autoRecover: true,
    } as any);

    expect(mockedRunEmbeddedAttempt).toHaveBeenCalledTimes(2);
    expect(receivedEvent).toBeTruthy();
    expect(receivedEvent.attempt).toBe(0);
  });

  it("does not auto-retry when plugin returns 'retry' and autoRecover=false; suggests recovery in meta", async () => {
    const first = makeAttemptResult({
      lastAssistant: { stopReason: "error", errorMessage: "boom" },
      assistantTexts: [],
      messagesSnapshot: [],
    });
    mockedRunEmbeddedAttempt.mockResolvedValueOnce(first);

    const registry = createEmptyPluginRegistry();
    registry.typedHooks.push({
      pluginId: "test-plugin",
      hookName: "run_error",
      handler: () => ({ action: "retry" }),
      priority: 0,
      source: "test",
    } as any);

    initializeGlobalHookRunner(registry);

    const result = await runEmbeddedPiAgent({
      sessionId: "test-session",
      sessionKey: "test-key",
      sessionFile: "/tmp/session.json",
      workspaceDir: "/tmp/workspace",
      prompt: "hello",
      timeoutMs: 30000,
      runId: "run-2",
      autoRecover: false,
    } as any);

    expect(mockedRunEmbeddedAttempt).toHaveBeenCalledTimes(1);
    expect(result.meta?.recoverySuggestion).toBeDefined();
    expect(result.meta?.recoverySuggestion?.suggestedAction).toBe("retry");
  });

  it("switches model when plugin returns 'switch' + newModel and autoRecover=true", async () => {
    const first = makeAttemptResult({
      lastAssistant: { stopReason: "error", errorMessage: "boom" },
      assistantTexts: [],
      messagesSnapshot: [],
    });
    const second = makeAttemptResult({ assistantTexts: ["ok"] });

    mockedRunEmbeddedAttempt.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    const registry = createEmptyPluginRegistry();
    registry.typedHooks.push({
      pluginId: "test-plugin",
      hookName: "run_error",
      handler: () => ({ action: "switch", newModel: "new-model" }),
      priority: 0,
      source: "test",
    } as any);

    initializeGlobalHookRunner(registry);

    await runEmbeddedPiAgent({
      sessionId: "test-session",
      sessionKey: "test-key",
      sessionFile: "/tmp/session.json",
      workspaceDir: "/tmp/workspace",
      prompt: "hello",
      timeoutMs: 30000,
      runId: "run-3",
      autoRecover: true,
      model: "initial-model",
    } as any);

    // Should have attempted twice: original model then switched model
    expect(mockedRunEmbeddedAttempt).toHaveBeenCalledTimes(2);
    const firstCall = mockedRunEmbeddedAttempt.mock.calls[0][0];
    const secondCall = mockedRunEmbeddedAttempt.mock.calls[1][0];
    expect(firstCall.modelId).toBeDefined();
    expect(secondCall.modelId).toBe("new-model");
  });

  it("behaves normally when no plugin is present (backward compatibility)", async () => {
    const first = makeAttemptResult({
      lastAssistant: { stopReason: "error", errorMessage: "boom" },
      assistantTexts: [],
      messagesSnapshot: [],
    });
    mockedRunEmbeddedAttempt.mockResolvedValueOnce(first);

    // Ensure no global hook runner registered
    resetGlobalHookRunner();

    const result = await runEmbeddedPiAgent({
      sessionId: "test-session",
      sessionKey: "test-key",
      sessionFile: "/tmp/session.json",
      workspaceDir: "/tmp/workspace",
      prompt: "hello",
      timeoutMs: 30000,
      runId: "run-4",
    } as any);

    expect(mockedRunEmbeddedAttempt).toHaveBeenCalledTimes(1);
    expect(result.meta?.recoverySuggestion).toBeUndefined();
  });

  it("continues gracefully when plugin throws", async () => {
    const first = makeAttemptResult({
      lastAssistant: { stopReason: "error", errorMessage: "boom" },
      assistantTexts: [],
      messagesSnapshot: [],
    });
    mockedRunEmbeddedAttempt.mockResolvedValueOnce(first);

    const registry = createEmptyPluginRegistry();
    registry.typedHooks.push({
      pluginId: "test-plugin",
      hookName: "run_error",
      handler: () => {
        throw new Error("plugin failure");
      },
      priority: 0,
      source: "test",
    } as any);

    initializeGlobalHookRunner(registry);

    const result = await runEmbeddedPiAgent({
      sessionId: "test-session",
      sessionKey: "test-key",
      sessionFile: "/tmp/session.json",
      workspaceDir: "/tmp/workspace",
      prompt: "hello",
      timeoutMs: 30000,
      runId: "run-5",
    } as any);

    // Plugin threw, but runner should not crash. No recoverySuggestion.
    expect(mockedRunEmbeddedAttempt).toHaveBeenCalledTimes(1);
    expect(result.meta?.recoverySuggestion).toBeUndefined();
  });
});

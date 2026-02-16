import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const noop = () => {};
let lifecycleHandler:
  | ((evt: { stream?: string; runId: string; data?: { phase?: string } }) => void)
  | undefined;

const callGatewaySpy = vi.fn(async (opts: unknown) => {
  const request = opts as { method?: string };
  if (request.method === "agent.wait") {
    throw new Error("gateway unreachable");
  }
  return {};
});

vi.mock("../gateway/call.js", () => ({
  callGateway: (...args: unknown[]) => callGatewaySpy(...args),
}));

vi.mock("../infra/agent-events.js", () => ({
  onAgentEvent: vi.fn((handler: typeof lifecycleHandler) => {
    lifecycleHandler = handler;
    return noop;
  }),
}));

vi.mock("../config/config.js", () => ({
  loadConfig: vi.fn(() => ({
    agents: { defaults: { subagents: { archiveAfterMinutes: 0 }, timeoutSeconds: 60 } },
  })),
  STATE_DIR: "/tmp/openclaw-test",
}));

vi.mock("../config/sessions.js", () => ({
  loadSessionStore: vi.fn(() => ({})),
  resolveAgentIdFromSessionKey: vi.fn(() => "main"),
  resolveStorePath: vi.fn(() => "/tmp/test-store"),
}));

const errorSpy = vi.fn();
vi.mock("../runtime.js", () => ({
  defaultRuntime: { error: (...args: unknown[]) => errorSpy(...args) },
}));

vi.mock("./pi-embedded.js", () => ({
  abortEmbeddedPiRun: vi.fn(() => false),
}));

const announceSpy = vi.fn(async () => true);
vi.mock("./subagent-announce.js", () => ({
  runSubagentAnnounceFlow: (...args: unknown[]) => announceSpy(...args),
}));

vi.mock("./subagent-registry.store.js", () => ({
  loadSubagentRegistryFromDisk: vi.fn(() => new Map()),
  saveSubagentRegistryToDisk: vi.fn(() => {}),
}));

describe("subagent wait retry on RPC failure", () => {
  let mod: typeof import("./subagent-registry.js");

  beforeAll(async () => {
    mod = await import("./subagent-registry.js");
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    callGatewaySpy.mockReset();
    callGatewaySpy.mockImplementation(async (opts: unknown) => {
      const request = opts as { method?: string };
      if (request.method === "agent.wait") {
        throw new Error("gateway unreachable");
      }
      return {};
    });
    announceSpy.mockReset();
    announceSpy.mockResolvedValue(true);
    errorSpy.mockReset();
    lifecycleHandler = undefined;
    mod.resetSubagentRegistryForTests({ persist: false });
  });

  it("logs an error and schedules retry when agent.wait throws", async () => {
    mod.registerSubagentRun({
      runId: "run-1",
      childSessionKey: "agent:main:subagent:child-1",
      requesterSessionKey: "main",
      requesterDisplayKey: "main",
      task: "test task",
      cleanup: "keep",
    });

    // Wait for the initial waitForSubagentCompletion to fire and fail.
    await vi.advanceTimersByTimeAsync(100);

    // Should have logged an error about the RPC failure.
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Subagent wait RPC failed for run-1"),
    );

    // Should have logged scheduling a retry.
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("scheduling retry 1/3"));
  });

  it("marks run as failed after exhausting retries", async () => {
    mod.registerSubagentRun({
      runId: "run-2",
      childSessionKey: "agent:main:subagent:child-2",
      requesterSessionKey: "main",
      requesterDisplayKey: "main",
      task: "test task 2",
      cleanup: "keep",
    });

    // Initial call fails, retry 1 scheduled at 5s.
    await vi.advanceTimersByTimeAsync(100);

    // Advance past retry 1 (5s).
    await vi.advanceTimersByTimeAsync(6_000);

    // Advance past retry 2 (10s).
    await vi.advanceTimersByTimeAsync(11_000);

    // Advance past retry 3 (20s).
    await vi.advanceTimersByTimeAsync(21_000);

    // After 3 retries, should be marked as failed.
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("failed after 3 retries"));

    // Announce flow should have been triggered with error status.
    expect(announceSpy).toHaveBeenCalled();
  });

  it("clears retry state on successful wait", async () => {
    // Start with failures, then succeed.
    let callCount = 0;
    callGatewaySpy.mockImplementation(async (opts: unknown) => {
      const request = opts as { method?: string };
      if (request.method === "agent.wait") {
        callCount += 1;
        if (callCount <= 1) {
          throw new Error("gateway unreachable");
        }
        return { status: "ok", startedAt: Date.now(), endedAt: Date.now() };
      }
      return {};
    });

    mod.registerSubagentRun({
      runId: "run-3",
      childSessionKey: "agent:main:subagent:child-3",
      requesterSessionKey: "main",
      requesterDisplayKey: "main",
      task: "test task 3",
      cleanup: "keep",
    });

    // Initial call fails.
    await vi.advanceTimersByTimeAsync(100);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("scheduling retry 1/3"));

    // Advance past retry 1 — this time it succeeds.
    await vi.advanceTimersByTimeAsync(6_000);

    // Announce flow should be triggered with ok status.
    expect(announceSpy).toHaveBeenCalled();

    // Should NOT have logged exhausted retries.
    const exhaustedCalls = errorSpy.mock.calls.filter(
      (args: unknown[]) => typeof args[0] === "string" && args[0].includes("failed after"),
    );
    expect(exhaustedCalls).toHaveLength(0);
  });
});

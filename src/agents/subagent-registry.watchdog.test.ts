import { beforeEach, describe, expect, it, vi } from "vitest";

const callGatewayMock = vi.fn(async () => ({}));

vi.mock("../gateway/call.js", () => ({
  callGateway: (opts: unknown) => callGatewayMock(opts),
}));

describe("subagent continuity watchdog", () => {
  beforeEach(async () => {
    callGatewayMock.mockClear();
    const mod = await import("./subagent-registry.js");
    mod.resetSubagentRegistryForTests();
  });

  it("nudges stalled subagents in team chat", async () => {
    const mod = await import("./subagent-registry.js");
    const now = Date.now();
    mod.addSubagentRunForTests({
      runId: "run-stalled-1",
      childSessionKey: "agent:worker-1:subagent:test",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      task: "Implement API",
      cleanup: "idle",
      createdAt: now - 7 * 60_000,
      startedAt: now - 7 * 60_000,
    });

    await mod.runContinuityWatchdogForTests(now);

    const injectCalls = callGatewayMock.mock.calls
      .map((call) => call[0] as { method?: string; params?: { message?: string } })
      .filter((req) => req.method === "chat.inject");
    expect(injectCalls.length).toBe(1);
    expect(injectCalls[0]?.params?.message).toMatch(/continuity check/i);
    expect(injectCalls[0]?.params?.message).toMatch(/proxima tarefa|dispensa/i);
  });

  it("respects cooldown to avoid spam", async () => {
    const mod = await import("./subagent-registry.js");
    const now = Date.now();
    mod.addSubagentRunForTests({
      runId: "run-stalled-2",
      childSessionKey: "agent:worker-2:subagent:test",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      task: "Patch bug",
      cleanup: "idle",
      createdAt: now - 7 * 60_000,
      startedAt: now - 7 * 60_000,
    });

    await mod.runContinuityWatchdogForTests(now);
    await mod.runContinuityWatchdogForTests(now + 2 * 60_000);

    const injectCalls = callGatewayMock.mock.calls
      .map((call) => call[0] as { method?: string })
      .filter((req) => req.method === "chat.inject");
    expect(injectCalls.length).toBe(1);
  });

  it("does not nudge when progress is recent", async () => {
    const mod = await import("./subagent-registry.js");
    const now = Date.now();
    mod.addSubagentRunForTests({
      runId: "run-active-1",
      childSessionKey: "agent:worker-3:subagent:test",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      task: "Refactor module",
      cleanup: "idle",
      createdAt: now - 7 * 60_000,
      startedAt: now - 7 * 60_000,
    });
    mod.updateSubagentProgress("run-active-1", {
      percent: 65,
      status: "in progress",
    });

    await mod.runContinuityWatchdogForTests(now);

    const injectCalls = callGatewayMock.mock.calls
      .map((call) => call[0] as { method?: string })
      .filter((req) => req.method === "chat.inject");
    expect(injectCalls.length).toBe(0);
  });
});

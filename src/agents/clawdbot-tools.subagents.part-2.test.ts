import { beforeEach, describe, expect, it, vi } from "vitest";

const callGatewayMock = vi.fn();
vi.mock("../gateway/call.js", () => ({
  callGateway: (opts: unknown) => callGatewayMock(opts),
}));

let configOverride: ReturnType<
  typeof import("../config/config.js")["loadConfig"]
> = {
  session: {
    mainKey: "main",
    scope: "per-sender",
  },
};

vi.mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    loadConfig: () => configOverride,
    resolveGatewayPort: () => 18789,
  };
});

import { createClawdbotTools } from "./clawdbot-tools.js";
import { resetSubagentRegistryForTests } from "./subagent-registry.js";

describe("clawdbot-tools: subagents", () => {
  beforeEach(() => {
    configOverride = {
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
    };
  });

  // Note: Subagents now use the report_back tool to announce results,
  // so there's no secondary "announce step" agent call. The agent.wait
  // handler only does cleanup (label patching + session deletion).
  it("sessions_spawn runs cleanup via agent.wait when lifecycle events are missing", async () => {
    resetSubagentRegistryForTests();
    callGatewayMock.mockReset();
    const calls: Array<{ method?: string; params?: unknown }> = [];
    let agentCallCount = 0;
    let deletedKey: string | undefined;
    let childRunId: string | undefined;
    let childSessionKey: string | undefined;
    const waitCalls: Array<{ runId?: string; timeoutMs?: number }> = [];

    callGatewayMock.mockImplementation(async (opts: unknown) => {
      const request = opts as { method?: string; params?: unknown };
      calls.push(request);
      if (request.method === "agent") {
        agentCallCount += 1;
        const runId = `run-${agentCallCount}`;
        const params = request.params as {
          message?: string;
          sessionKey?: string;
          channel?: string;
          timeout?: number;
        };
        childRunId = runId;
        childSessionKey = params?.sessionKey ?? "";
        expect(params?.channel).toBe("discord");
        expect(params?.timeout).toBe(1);
        return {
          runId,
          status: "accepted",
          acceptedAt: 2000 + agentCallCount,
        };
      }
      if (request.method === "agent.wait") {
        const params = request.params as
          | { runId?: string; timeoutMs?: number }
          | undefined;
        waitCalls.push(params ?? {});
        return {
          runId: params?.runId ?? "run-1",
          status: "ok",
          startedAt: 3000,
          endedAt: 4000,
        };
      }
      if (request.method === "sessions.delete") {
        const params = request.params as { key?: string } | undefined;
        deletedKey = params?.key;
        return { ok: true };
      }
      return {};
    });

    const tool = createClawdbotTools({
      agentSessionKey: "discord:group:req",
      agentChannel: "discord",
    }).find((candidate) => candidate.name === "sessions_spawn");
    if (!tool) throw new Error("missing sessions_spawn tool");

    const result = await tool.execute("call1b", {
      task: "do thing",
      runTimeoutSeconds: 1,
      cleanup: "delete",
    });
    expect(result.details).toMatchObject({
      status: "accepted",
      runId: "run-1",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Verify agent.wait was called with correct timeout
    const childWait = waitCalls.find((call) => call.runId === childRunId);
    expect(childWait?.timeoutMs).toBe(1000);
    expect(childSessionKey?.startsWith("agent:main:subagent:")).toBe(true);

    // Verify only 1 agent call (the spawn, no announce step)
    // Subagents now use report_back tool to announce results
    const agentCalls = calls.filter((call) => call.method === "agent");
    expect(agentCalls).toHaveLength(1);
    const first = agentCalls[0]?.params as
      | {
          lane?: string;
          deliver?: boolean;
          sessionKey?: string;
          channel?: string;
        }
      | undefined;
    expect(first?.lane).toBe("subagent");
    expect(first?.deliver).toBe(false);
    expect(first?.channel).toBe("discord");

    // Verify cleanup deleted the session
    expect(deletedKey?.startsWith("agent:main:subagent:")).toBe(true);
  });
});

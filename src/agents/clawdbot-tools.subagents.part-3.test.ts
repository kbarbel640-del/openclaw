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

import { emitAgentEvent } from "../infra/agent-events.js";
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
  // so there's no secondary "announce step" agent call or send. The lifecycle
  // handler only does cleanup (label patching + optional session deletion).
  it("sessions_spawn runs cleanup on lifecycle end for main session requester", async () => {
    resetSubagentRegistryForTests();
    callGatewayMock.mockReset();
    const calls: Array<{ method?: string; params?: unknown }> = [];
    let agentCallCount = 0;
    let childRunId: string | undefined;
    let childSessionKey: string | undefined;
    const waitCalls: Array<{ runId?: string; timeoutMs?: number }> = [];

    callGatewayMock.mockImplementation(async (opts: unknown) => {
      const request = opts as { method?: string; params?: unknown };
      calls.push(request);
      if (request.method === "sessions.list") {
        return {
          sessions: [
            {
              key: "main",
              lastChannel: "whatsapp",
              lastTo: "+123",
            },
          ],
        };
      }
      if (request.method === "agent") {
        agentCallCount += 1;
        const runId = `run-${agentCallCount}`;
        const params = request.params as {
          message?: string;
          sessionKey?: string;
        };
        childRunId = runId;
        childSessionKey = params?.sessionKey ?? "";
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
        // Return timeout to let lifecycle event handle completion
        const status = params?.runId === childRunId ? "timeout" : "ok";
        return { runId: params?.runId ?? "run-1", status };
      }
      if (request.method === "sessions.delete") {
        return { ok: true };
      }
      return {};
    });

    const tool = createClawdbotTools({
      agentSessionKey: "main",
      agentChannel: "whatsapp",
    }).find((candidate) => candidate.name === "sessions_spawn");
    if (!tool) throw new Error("missing sessions_spawn tool");

    const result = await tool.execute("call2", {
      task: "do thing",
      runTimeoutSeconds: 1,
    });
    expect(result.details).toMatchObject({
      status: "accepted",
      runId: "run-1",
    });

    if (!childRunId) throw new Error("missing child runId");
    emitAgentEvent({
      runId: childRunId,
      stream: "lifecycle",
      data: {
        phase: "end",
        startedAt: 1000,
        endedAt: 2000,
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Verify agent.wait was called with correct timeout
    const childWait = waitCalls.find((call) => call.runId === childRunId);
    expect(childWait?.timeoutMs).toBe(1000);

    // Verify only 1 agent call (the spawn, no announce step)
    // Subagents now use report_back tool to announce results
    const agentCalls = calls.filter((call) => call.method === "agent");
    expect(agentCalls).toHaveLength(1);
    expect(childSessionKey?.startsWith("agent:main:subagent:")).toBe(true);
  });
  it("sessions_spawn only allows same-agent by default", async () => {
    resetSubagentRegistryForTests();
    callGatewayMock.mockReset();

    const tool = createClawdbotTools({
      agentSessionKey: "main",
      agentChannel: "whatsapp",
    }).find((candidate) => candidate.name === "sessions_spawn");
    if (!tool) throw new Error("missing sessions_spawn tool");

    const result = await tool.execute("call6", {
      task: "do thing",
      agentId: "beta",
    });
    expect(result.details).toMatchObject({
      status: "forbidden",
    });
    expect(callGatewayMock).not.toHaveBeenCalled();
  });
});

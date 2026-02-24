/**
 * Tests that the direct completion path (method:'send') also triggers an
 * agent turn (method:'agent') so the parent session can act on subagent results.
 *
 * Regression for:
 *   https://github.com/openclaw/openclaw/issues/22099
 *   https://github.com/openclaw/openclaw/issues/22673
 *   https://github.com/openclaw/openclaw/issues/25042
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

type GatewayCall = {
  method?: string;
  timeoutMs?: number;
  expectFinal?: boolean;
  params?: Record<string, unknown>;
};

const gatewayCalls: GatewayCall[] = [];
let sessionStore: Record<string, Record<string, unknown>> = {};
const configOverride = {
  session: {
    mainKey: "main",
    scope: "per-sender",
  },
};

vi.mock("../gateway/call.js", () => ({
  callGateway: vi.fn(async (request: GatewayCall) => {
    gatewayCalls.push(request);
    if (request.method === "chat.history") {
      return { messages: [] };
    }
    return {};
  }),
}));

vi.mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    loadConfig: () => configOverride,
  };
});

vi.mock("../config/sessions.js", () => ({
  loadSessionStore: vi.fn(() => sessionStore),
  resolveAgentIdFromSessionKey: () => "main",
  resolveStorePath: () => "/tmp/sessions-main.json",
  resolveMainSessionKey: () => "agent:main:main",
}));

vi.mock("./subagent-depth.js", () => ({
  getSubagentDepthFromSessionStore: () => 0,
}));

vi.mock("./pi-embedded.js", () => ({
  isEmbeddedPiRunActive: () => false,
  queueEmbeddedPiMessage: () => false,
  waitForEmbeddedPiRunEnd: async () => true,
}));

vi.mock("./subagent-registry.js", () => ({
  countActiveDescendantRuns: () => 0,
  isSubagentSessionRunActive: () => true,
  resolveRequesterForChildSession: () => null,
}));

import { runSubagentAnnounceFlow } from "./subagent-announce.js";

type AnnounceFlowParams = Parameters<typeof runSubagentAnnounceFlow>[0];

const baseParams = {
  childSessionKey: "agent:main:subagent:worker",
  requesterSessionKey: "agent:main:main",
  requesterDisplayKey: "main",
  task: "do thing",
  timeoutMs: 1_000,
  cleanup: "keep",
  roundOneReply: "done",
  waitForCompletion: false,
  outcome: { status: "ok" as const },
} satisfies Omit<AnnounceFlowParams, "childRunId">;

describe("direct completion path: agent turn after send", () => {
  beforeEach(() => {
    gatewayCalls.length = 0;
    sessionStore = {};
  });

  it("calls method:agent after method:send when expectsCompletionMessage is true and direct target is set", async () => {
    await runSubagentAnnounceFlow({
      ...baseParams,
      childRunId: "run-direct-agent-turn-001",
      expectsCompletionMessage: true,
      requesterOrigin: {
        channel: "telegram",
        to: "channel:99999",
        threadId: "99999",
      },
    });

    const sendCall = gatewayCalls.find((c) => c.method === "send");
    expect(sendCall, "method:send should be called for direct completion delivery").toBeDefined();

    const agentCall = gatewayCalls.find(
      (c) => c.method === "agent" && c.expectFinal !== true,
    );
    expect(
      agentCall,
      "method:agent should be called after method:send to give the parent session an agent turn",
    ).toBeDefined();
  });

  it("uses a distinct idempotency key for the agent turn to avoid gateway dedup collision", async () => {
    await runSubagentAnnounceFlow({
      ...baseParams,
      childRunId: "run-direct-agent-turn-002",
      expectsCompletionMessage: true,
      requesterOrigin: {
        channel: "telegram",
        to: "channel:99999",
        threadId: "99999",
      },
    });

    const sendCall = gatewayCalls.find((c) => c.method === "send");
    const agentCall = gatewayCalls.find(
      (c) => c.method === "agent" && c.expectFinal !== true,
    );

    expect(sendCall?.params?.idempotencyKey).toBeDefined();
    expect(agentCall?.params?.idempotencyKey).toBeDefined();
    expect(agentCall?.params?.idempotencyKey).not.toBe(sendCall?.params?.idempotencyKey);
    expect(String(agentCall?.params?.idempotencyKey)).toMatch(/-agent$/);
  });

  it("does NOT call method:send when expectsCompletionMessage is false (normal path)", async () => {
    await runSubagentAnnounceFlow({
      ...baseParams,
      childRunId: "run-no-direct-send-003",
      expectsCompletionMessage: false,
      requesterOrigin: {
        channel: "telegram",
        to: "channel:99999",
        threadId: "99999",
      },
    });

    const sendCall = gatewayCalls.find((c) => c.method === "send");
    expect(sendCall, "method:send should NOT be called in non-completion mode").toBeUndefined();

    // In non-completion mode the agent call goes through the normal path with expectFinal=true
    const agentCall = gatewayCalls.find((c) => c.method === "agent");
    expect(agentCall, "method:agent should still be called in non-completion mode").toBeDefined();
  });

  it("the agent turn call has deliver:false so it does not double-deliver to the user", async () => {
    await runSubagentAnnounceFlow({
      ...baseParams,
      childRunId: "run-direct-agent-turn-004",
      expectsCompletionMessage: true,
      requesterOrigin: {
        channel: "telegram",
        to: "channel:99999",
        threadId: "99999",
      },
    });

    const agentCall = gatewayCalls.find(
      (c) => c.method === "agent" && c.expectFinal !== true,
    );
    expect(agentCall?.params?.deliver).toBe(false);
  });
});

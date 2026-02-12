import { describe, expect, it, vi } from "vitest";

const callGatewayMock = vi.fn(async (_req: unknown) => ({}));

vi.mock("../../gateway/call.js", () => {
  return { callGateway: callGatewayMock };
});

vi.mock("../../config/config.js", () => {
  return {
    loadConfig: () => ({}),
  };
});

vi.mock("../identity.js", () => {
  return {
    resolveAgentIdentity: () => null,
  };
});

vi.mock("./sessions-announce-target.js", () => {
  return {
    resolveAnnounceTarget: async () => null,
  };
});

vi.mock("./agent-step.js", () => {
  return {
    readLatestAssistantReply: async () => null,
    runAgentStep: async (_params: { message: string }) => {
      // Simulate the fragile announce step being skipped by the target agent.
      return "ANNOUNCE_SKIP";
    },
  };
});

describe("runSessionsSendA2AFlow", () => {
  it("injects a fallback warning when no assistant output is captured", async () => {
    callGatewayMock.mockClear();

    const { runSessionsSendA2AFlow } = await import("./sessions-send-tool.a2a.js");

    await runSessionsSendA2AFlow({
      targetSessionKey: "agent:cto:main",
      displayKey: "agent:cto:main",
      message: "ping",
      announceTimeoutMs: 5000,
      maxPingPongTurns: 0,
      requesterSessionKey: "agent:main:main",
      requesterChannel: "webchat",
    });

    const injectCalls = callGatewayMock.mock.calls.filter(
      (c) => (c?.[0] as { method?: string } | undefined)?.method === "chat.inject",
    );
    expect(injectCalls.length).toBeGreaterThan(0);
    const lastInject = injectCalls[injectCalls.length - 1]?.[0] as
      | { params?: Record<string, unknown> }
      | undefined;
    const message = lastInject?.params?.message;
    expect(typeof message === "string" ? message : "").toContain(
      "completed without assistant text",
    );
    expect(lastInject?.params?.senderAgentId).toBe("cto");
  });

  it("falls back to injecting latestReply into team chat when announce target is not resolvable", async () => {
    callGatewayMock.mockClear();

    const { runSessionsSendA2AFlow } = await import("./sessions-send-tool.a2a.js");

    await runSessionsSendA2AFlow({
      targetSessionKey: "agent:cto:main",
      displayKey: "agent:cto:main",
      message: "ping",
      announceTimeoutMs: 5000,
      maxPingPongTurns: 0,
      requesterSessionKey: "agent:main:main",
      requesterChannel: "webchat",
      roundOneReply: "CTO_REPLY",
    });

    const injectCalls = callGatewayMock.mock.calls.filter(
      (c) => (c?.[0] as { method?: string } | undefined)?.method === "chat.inject",
    );
    expect(injectCalls.length).toBeGreaterThan(0);

    const lastInject = injectCalls[injectCalls.length - 1]?.[0] as
      | { params?: Record<string, unknown> }
      | undefined;
    expect(lastInject?.params?.message).toBe("CTO_REPLY");
    expect(lastInject?.params?.senderAgentId).toBe("cto");

    const sendCalls = callGatewayMock.mock.calls.filter(
      (c) => (c?.[0] as { method?: string } | undefined)?.method === "send",
    );
    expect(sendCalls).toHaveLength(0);
  });
});

import { describe, expect, it, vi } from "vitest";
import type { TemplateContext } from "../templating.js";
import type { FollowupRun, QueueSettings } from "./queue.js";
import { createMockTypingController } from "./test-helpers.js";

const runEmbeddedPiAgentMock = vi.fn();

vi.mock("../../agents/unified-agent-runner.js", () => ({
  runAgentWithUnifiedFailover: async (params: {
    provider?: string;
    model?: string;
    authProfileId?: string;
    authProfileIdSource?: string;
  }) => {
    // Simulate a cross-provider fallback - unified runner should drop authProfileId
    // when provider changes from anthropic to openai-codex
    const originalProvider = params.provider ?? "anthropic";
    const fallbackProvider = "openai-codex";
    const fallbackModel = "gpt-5.2";
    const providerChanged = fallbackProvider !== originalProvider;

    const result = await runEmbeddedPiAgentMock({
      ...params,
      provider: fallbackProvider,
      model: fallbackModel,
      // Drop auth profile when provider changes (the fix being tested)
      authProfileId: providerChanged ? undefined : params.authProfileId,
      authProfileIdSource: providerChanged ? undefined : params.authProfileIdSource,
    });
    return {
      result,
      runtime: "pi",
      provider: fallbackProvider,
      model: fallbackModel,
      attempts: [],
    };
  },
}));

vi.mock("../../agents/pi-embedded.js", () => ({
  queueEmbeddedPiMessage: vi.fn().mockReturnValue(false),
}));

vi.mock("./queue.js", async () => {
  const actual = await vi.importActual<typeof import("./queue.js")>("./queue.js");
  return {
    ...actual,
    enqueueFollowupRun: vi.fn(),
    scheduleFollowupDrain: vi.fn(),
  };
});

import { runReplyAgent } from "./agent-runner.js";

function createBaseRun(params: { runOverrides?: Partial<FollowupRun["run"]> }) {
  const typing = createMockTypingController();
  const sessionCtx = {
    Provider: "telegram",
    OriginatingTo: "chat",
    AccountId: "primary",
    MessageSid: "msg",
    Surface: "telegram",
  } as unknown as TemplateContext;

  const resolvedQueue = { mode: "interrupt" } as unknown as QueueSettings;

  const followupRun = {
    prompt: "hello",
    summaryLine: "hello",
    enqueuedAt: Date.now(),
    run: {
      agentId: "main",
      agentDir: "/tmp/agent",
      sessionId: "session",
      sessionKey: "main",
      messageProvider: "telegram",
      sessionFile: "/tmp/session.jsonl",
      workspaceDir: "/tmp",
      config: {},
      skillsSnapshot: {},
      provider: "anthropic",
      model: "claude-opus",
      authProfileId: "anthropic:clawd",
      authProfileIdSource: "manual",
      thinkLevel: "low",
      verboseLevel: "off",
      elevatedLevel: "off",
      bashElevated: {
        enabled: false,
        allowed: false,
        defaultLevel: "off",
      },
      timeoutMs: 5_000,
      blockReplyBreak: "message_end",
    },
  } as unknown as FollowupRun;

  return {
    typing,
    sessionCtx,
    resolvedQueue,
    followupRun: {
      ...followupRun,
      run: { ...followupRun.run, ...params.runOverrides },
    },
  };
}

describe("authProfileId fallback scoping", () => {
  it("drops authProfileId when provider changes during fallback", async () => {
    runEmbeddedPiAgentMock.mockReset();
    runEmbeddedPiAgentMock.mockResolvedValue({ payloads: [{ text: "ok" }], meta: {} });

    const sessionKey = "main";
    const sessionEntry = {
      sessionId: "session",
      updatedAt: Date.now(),
      totalTokens: 1,
      compactionCount: 0,
    };

    const { typing, sessionCtx, resolvedQueue, followupRun } = createBaseRun({
      runOverrides: {
        provider: "anthropic",
        model: "claude-opus",
        authProfileId: "anthropic:clawd",
        authProfileIdSource: "manual",
      },
    });

    await runReplyAgent({
      commandBody: "hello",
      followupRun,
      queueKey: sessionKey,
      resolvedQueue,
      shouldSteer: false,
      shouldFollowup: false,
      isActive: false,
      isStreaming: false,
      typing,
      sessionCtx,
      sessionEntry,
      sessionStore: { [sessionKey]: sessionEntry },
      sessionKey,
      storePath: undefined,
      defaultModel: "anthropic/claude-opus-4-5",
      agentCfgContextTokens: 100_000,
      resolvedVerboseLevel: "off",
      isNewSession: false,
      blockStreamingEnabled: false,
      resolvedBlockStreamingBreak: "message_end",
      shouldInjectGroupIntro: false,
      typingMode: "instant",
    });

    expect(runEmbeddedPiAgentMock).toHaveBeenCalledTimes(1);
    const call = runEmbeddedPiAgentMock.mock.calls[0]?.[0] as {
      authProfileId?: unknown;
      authProfileIdSource?: unknown;
      provider?: unknown;
    };

    expect(call.provider).toBe("openai-codex");
    expect(call.authProfileId).toBeUndefined();
    expect(call.authProfileIdSource).toBeUndefined();
  });
});

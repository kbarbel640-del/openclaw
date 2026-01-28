import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionEntry } from "../../config/sessions.js";
import type { TemplateContext } from "../templating.js";
import { DEFAULT_MEMORY_FLUSH_PROMPT } from "./memory-flush.js";
import type { FollowupRun, QueueSettings } from "./queue.js";
import { createMockTypingController } from "./test-helpers.js";

const runEmbeddedPiAgentMock = vi.fn();
const runAgentWithUnifiedFailoverMock = vi.fn();

vi.mock("../../agents/unified-agent-runner.js", () => ({
  runAgentWithUnifiedFailover: (params: unknown) => runAgentWithUnifiedFailoverMock(params),
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

type EmbeddedPiAgentParams = {
  enforceFinalTag?: boolean;
  prompt?: string;
};

function createRun(params?: {
  sessionEntry?: SessionEntry;
  sessionKey?: string;
  agentCfgContextTokens?: number;
}) {
  const typing = createMockTypingController();
  const sessionCtx = {
    Provider: "whatsapp",
    OriginatingTo: "+15550001111",
    AccountId: "primary",
    MessageSid: "msg",
  } as unknown as TemplateContext;
  const resolvedQueue = { mode: "interrupt" } as unknown as QueueSettings;
  const sessionKey = params?.sessionKey ?? "main";
  const followupRun = {
    prompt: "hello",
    summaryLine: "hello",
    enqueuedAt: Date.now(),
    run: {
      agentId: "main",
      agentDir: "/tmp/agent",
      sessionId: "session",
      sessionKey,
      messageProvider: "whatsapp",
      sessionFile: "/tmp/session.jsonl",
      workspaceDir: "/tmp",
      config: {},
      skillsSnapshot: {},
      provider: "anthropic",
      model: "claude",
      thinkLevel: "low",
      verboseLevel: "off",
      elevatedLevel: "off",
      bashElevated: {
        enabled: false,
        allowed: false,
        defaultLevel: "off",
      },
      timeoutMs: 1_000,
      blockReplyBreak: "message_end",
    },
  } as unknown as FollowupRun;

  return runReplyAgent({
    commandBody: "hello",
    followupRun,
    queueKey: "main",
    resolvedQueue,
    shouldSteer: false,
    shouldFollowup: false,
    isActive: false,
    isStreaming: false,
    typing,
    sessionCtx,
    sessionEntry: params?.sessionEntry,
    sessionKey,
    defaultModel: "anthropic/claude-opus-4-5",
    agentCfgContextTokens: params?.agentCfgContextTokens,
    resolvedVerboseLevel: "off",
    isNewSession: false,
    blockStreamingEnabled: false,
    resolvedBlockStreamingBreak: "message_end",
    shouldInjectGroupIntro: false,
    typingMode: "instant",
  });
}

describe("runReplyAgent fallback reasoning tags", () => {
  beforeEach(() => {
    runEmbeddedPiAgentMock.mockReset();
    runAgentWithUnifiedFailoverMock.mockReset();
  });

  it("enforces <final> when the fallback provider requires reasoning tags", async () => {
    // Simulate what the unified runner does: when falling back to google-antigravity,
    // it should set enforceFinalTag=true because that provider requires reasoning tags
    runAgentWithUnifiedFailoverMock.mockImplementationOnce(
      async (params: EmbeddedPiAgentParams & { piOptions?: { enforceFinalTag?: boolean } }) => {
        // The unified runner computes enforceFinalTag based on the current provider's
        // reasoning tag requirements. For google-antigravity, it should be true.
        const enforceFinalTag = true; // google-antigravity requires reasoning tags
        runEmbeddedPiAgentMock({
          ...params,
          provider: "google-antigravity",
          model: "gemini-3",
          enforceFinalTag,
        });
        return {
          result: { payloads: [{ text: "ok" }], meta: {} },
          runtime: "pi",
          provider: "google-antigravity",
          model: "gemini-3",
          attempts: [],
        };
      },
    );

    await createRun();

    const call = runEmbeddedPiAgentMock.mock.calls[0]?.[0] as EmbeddedPiAgentParams | undefined;
    expect(call?.enforceFinalTag).toBe(true);
  });

  it("enforces <final> during memory flush on fallback providers", async () => {
    // Simulate unified runner behavior for both main call and memory flush call
    runAgentWithUnifiedFailoverMock.mockImplementation(
      async (params: EmbeddedPiAgentParams & { piOptions?: { enforceFinalTag?: boolean } }) => {
        // The unified runner computes enforceFinalTag based on the current provider's
        // reasoning tag requirements. For google-antigravity, it should be true.
        const enforceFinalTag = true; // google-antigravity requires reasoning tags
        runEmbeddedPiAgentMock({
          ...params,
          provider: "google-antigravity",
          model: "gemini-3",
          enforceFinalTag,
        });
        const isFlush = params.prompt === DEFAULT_MEMORY_FLUSH_PROMPT;
        return {
          result: { payloads: isFlush ? [] : [{ text: "ok" }], meta: {} },
          runtime: "pi",
          provider: "google-antigravity",
          model: "gemini-3",
          attempts: [],
        };
      },
    );

    await createRun({
      sessionEntry: {
        sessionId: "session",
        updatedAt: Date.now(),
        totalTokens: 1_000_000,
        compactionCount: 0,
      },
    });

    const flushCall = runEmbeddedPiAgentMock.mock.calls.find(
      ([params]) =>
        (params as EmbeddedPiAgentParams | undefined)?.prompt === DEFAULT_MEMORY_FLUSH_PROMPT,
    )?.[0] as EmbeddedPiAgentParams | undefined;

    expect(flushCall?.enforceFinalTag).toBe(true);
  });
});

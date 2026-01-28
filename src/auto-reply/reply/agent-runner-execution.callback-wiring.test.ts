/**
 * Tests for agent-runner-execution callback wiring.
 *
 * These tests verify that callbacks (onBlockReply, onBlockReplyFlush, onReasoningStream)
 * are correctly wired through to the runtime, regardless of block streaming configuration.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import type { TemplateContext } from "../templating.js";
import type { FollowupRun, QueueSettings } from "./queue.js";
import { createMockTypingController } from "./test-helpers.js";

// Track what callbacks are passed to the unified runner
let capturedCallbacks: {
  onBlockReply?: unknown;
  onBlockReplyFlush?: unknown;
  onReasoningStream?: unknown;
  onPartialReply?: unknown;
} = {};

// Mock the unified runner to capture callbacks
vi.mock("../../agents/unified-agent-runner.js", () => ({
  runAgentWithUnifiedFailover: vi.fn(async (params) => {
    capturedCallbacks = {
      onBlockReply: params.onBlockReply,
      onBlockReplyFlush: params.onBlockReplyFlush,
      onReasoningStream: params.onReasoningStream,
      onPartialReply: params.onPartialReply,
    };
    return {
      result: {
        payloads: [{ text: "Test response" }],
        meta: {},
      },
      runtime: "pi",
      provider: "anthropic",
      model: "claude",
      attempts: [],
    };
  }),
}));

// Mock model fallback
vi.mock("../../agents/model-fallback.js", () => ({
  runWithModelFallback: async ({
    provider,
    model,
    run,
  }: {
    provider: string;
    model: string;
    run: (provider: string, model: string) => Promise<unknown>;
  }) => ({
    result: await run(provider, model),
    provider,
    model,
  }),
}));

// Mock Pi embedded
vi.mock("../../agents/pi-embedded.js", () => ({
  queueEmbeddedPiMessage: vi.fn().mockReturnValue(false),
  runEmbeddedPiAgent: vi.fn(async () => ({
    payloads: [{ text: "Pi response" }],
    meta: {},
  })),
}));

// Mock queue
vi.mock("./queue.js", async () => {
  const actual = await vi.importActual<typeof import("./queue.js")>("./queue.js");
  return {
    ...actual,
    enqueueFollowupRun: vi.fn(),
    scheduleFollowupDrain: vi.fn(),
  };
});

import { runReplyAgent } from "./agent-runner.js";

describe("agent-runner-execution callback wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedCallbacks = {};
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const createBaseParams = (overrides: {
    blockStreamingEnabled?: boolean;
    blockReplyPipeline?: unknown;
    onBlockReply?: () => void;
    onReasoningStream?: () => void;
  }) => {
    const typing = createMockTypingController();
    const sessionCtx = {
      Provider: "discord",
      OriginatingTo: "channel:C1",
      AccountId: "primary",
      MessageSid: "msg",
    } as unknown as TemplateContext;
    const resolvedQueue = { mode: "interrupt" } as unknown as QueueSettings;
    const followupRun = {
      prompt: "hello",
      summaryLine: "hello",
      enqueuedAt: Date.now(),
      run: {
        sessionId: "session",
        sessionKey: "main",
        messageProvider: "discord",
        sessionFile: "/tmp/session.jsonl",
        workspaceDir: "/tmp",
        config: {
          agents: {
            defaults: {
              blockStreamingCoalesce: {
                minChars: 1,
                maxChars: 200,
                idleMs: 0,
              },
            },
          },
        },
        skillsSnapshot: {},
        provider: "anthropic",
        model: "claude",
        thinkLevel: "high",
        verboseLevel: "off",
        elevatedLevel: "off",
        bashElevated: {
          enabled: false,
          allowed: false,
          defaultLevel: "off",
        },
        timeoutMs: 1_000,
        blockReplyBreak: "text_end",
      },
    } as unknown as FollowupRun;

    return {
      commandBody: "hello",
      followupRun,
      queueKey: "main",
      resolvedQueue,
      shouldSteer: false,
      shouldFollowup: false,
      isActive: false,
      isStreaming: false,
      opts: {
        onBlockReply: overrides.onBlockReply,
        onReasoningStream: overrides.onReasoningStream,
      },
      typing,
      sessionCtx,
      defaultModel: "anthropic/claude-opus-4-5",
      resolvedVerboseLevel: "off" as const,
      isNewSession: false,
      blockStreamingEnabled: overrides.blockStreamingEnabled ?? false,
      blockReplyChunking: {
        minChars: 1,
        maxChars: 200,
        breakPreference: "paragraph" as const,
      },
      resolvedBlockStreamingBreak: "text_end" as const,
      shouldInjectGroupIntro: false,
      typingMode: "instant" as const,
    };
  };

  describe("onBlockReply forwarding", () => {
    it("provides onBlockReply when blockStreamingEnabled=true and callback exists", async () => {
      const onBlockReply = vi.fn();
      const params = createBaseParams({ blockStreamingEnabled: true, onBlockReply });

      await runReplyAgent(params);

      // Callback should be wired through
      expect(capturedCallbacks.onBlockReply).toBeDefined();
      expect(typeof capturedCallbacks.onBlockReply).toBe("function");
    });

    it("provides onBlockReply when blockStreamingEnabled=false and callback exists", async () => {
      const onBlockReply = vi.fn();
      const params = createBaseParams({ blockStreamingEnabled: false, onBlockReply });

      await runReplyAgent(params);

      // Callback should STILL be wired through (critical for CCSDK)
      expect(capturedCallbacks.onBlockReply).toBeDefined();
      expect(typeof capturedCallbacks.onBlockReply).toBe("function");
    });

    it("does not provide onBlockReply when no callback exists", async () => {
      const params = createBaseParams({ blockStreamingEnabled: true });

      await runReplyAgent(params);

      // No callback provided, so none should be wired
      expect(capturedCallbacks.onBlockReply).toBeUndefined();
    });
  });

  describe("onBlockReplyFlush forwarding", () => {
    it("provides onBlockReplyFlush when blockStreamingEnabled=true and onBlockReply exists", async () => {
      const onBlockReply = vi.fn();
      const params = createBaseParams({ blockStreamingEnabled: true, onBlockReply });

      await runReplyAgent(params);

      // Flush callback should be provided
      expect(capturedCallbacks.onBlockReplyFlush).toBeDefined();
      expect(typeof capturedCallbacks.onBlockReplyFlush).toBe("function");
    });

    it("provides onBlockReplyFlush when blockStreamingEnabled=false but onBlockReply exists", async () => {
      const onBlockReply = vi.fn();
      const params = createBaseParams({ blockStreamingEnabled: false, onBlockReply });

      await runReplyAgent(params);

      // Flush callback should STILL be provided (critical for CCSDK message completion)
      expect(capturedCallbacks.onBlockReplyFlush).toBeDefined();
      expect(typeof capturedCallbacks.onBlockReplyFlush).toBe("function");
    });

    it("does not provide onBlockReplyFlush when no onBlockReply callback exists", async () => {
      const params = createBaseParams({ blockStreamingEnabled: true });

      await runReplyAgent(params);

      // No block reply callback means no flush needed
      expect(capturedCallbacks.onBlockReplyFlush).toBeUndefined();
    });
  });

  describe("onReasoningStream forwarding", () => {
    it("provides onReasoningStream when callback exists", async () => {
      const onReasoningStream = vi.fn();
      const params = createBaseParams({ blockStreamingEnabled: false, onReasoningStream });

      await runReplyAgent(params);

      // Reasoning stream callback should be wired through
      expect(capturedCallbacks.onReasoningStream).toBeDefined();
      expect(typeof capturedCallbacks.onReasoningStream).toBe("function");
    });

    it("does not provide onReasoningStream when no callback exists and typing mode is not thinking", async () => {
      const params = createBaseParams({ blockStreamingEnabled: false });
      // Default typing mode is "instant", not "thinking"

      await runReplyAgent(params);

      // No reasoning stream callback expected
      expect(capturedCallbacks.onReasoningStream).toBeUndefined();
    });
  });

  describe("callback combination scenarios", () => {
    it("provides all callbacks when all are specified", async () => {
      const onBlockReply = vi.fn();
      const onReasoningStream = vi.fn();
      const params = createBaseParams({
        blockStreamingEnabled: true,
        onBlockReply,
        onReasoningStream,
      });

      await runReplyAgent(params);

      // All callbacks should be wired
      expect(capturedCallbacks.onBlockReply).toBeDefined();
      expect(capturedCallbacks.onBlockReplyFlush).toBeDefined();
      expect(capturedCallbacks.onReasoningStream).toBeDefined();
    });

    it("CCSDK scenario: blockStreamingEnabled=false with onBlockReply", async () => {
      // This is the critical CCSDK scenario where block streaming is disabled
      // but the CCSDK runtime still sends text through onBlockReply callbacks
      const onBlockReply = vi.fn();
      const params = createBaseParams({ blockStreamingEnabled: false, onBlockReply });

      await runReplyAgent(params);

      // Both onBlockReply and onBlockReplyFlush must be provided
      expect(capturedCallbacks.onBlockReply).toBeDefined();
      expect(capturedCallbacks.onBlockReplyFlush).toBeDefined();
    });
  });
});

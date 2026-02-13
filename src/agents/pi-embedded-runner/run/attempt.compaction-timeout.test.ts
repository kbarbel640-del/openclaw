import { describe, expect, it, vi } from "vitest";

const createAgentSession = vi.fn();
const subscribeEmbeddedPiSession = vi.fn();
const setActiveEmbeddedRun = vi.fn();
const clearActiveEmbeddedRun = vi.fn();

vi.mock("@mariozechner/pi-ai", () => ({
  streamSimple: vi.fn(),
}));

vi.mock("@mariozechner/pi-coding-agent", () => ({
  createAgentSession,
  SessionManager: {
    open: vi.fn(() => ({
      flushPendingToolResults: vi.fn(),
      getLeafEntry: vi.fn(() => undefined),
      branch: vi.fn(),
      resetLeaf: vi.fn(),
      buildSessionContext: vi.fn(() => ({ messages: [] })),
    })),
  },
  SettingsManager: {
    create: vi.fn(() => ({})),
  },
}));

vi.mock("../../../auto-reply/heartbeat.js", () => ({
  resolveHeartbeatPrompt: vi.fn(() => undefined),
}));

vi.mock("../../../config/channel-capabilities.js", () => ({
  resolveChannelCapabilities: vi.fn(() => []),
}));

vi.mock("../../../infra/machine-name.js", () => ({
  getMachineDisplayName: vi.fn(async () => "test-machine"),
}));

vi.mock("../../../media/constants.js", () => ({
  MAX_IMAGE_BYTES: 10_000_000,
}));

vi.mock("../../../plugins/hook-runner-global.js", () => ({
  getGlobalHookRunner: vi.fn(() => null),
}));

vi.mock("../../../routing/session-key.js", () => ({
  isSubagentSessionKey: vi.fn(() => false),
  normalizeAgentId: vi.fn((id: string) => id),
}));

vi.mock("../../../signal/reaction-level.js", () => ({
  resolveSignalReactionLevel: vi.fn(() => ({ agentReactionGuidance: undefined })),
}));

vi.mock("../../../telegram/inline-buttons.js", () => ({
  resolveTelegramInlineButtonsScope: vi.fn(() => "off"),
}));

vi.mock("../../../telegram/reaction-level.js", () => ({
  resolveTelegramReactionLevel: vi.fn(() => ({ agentReactionGuidance: undefined })),
}));

vi.mock("../../../tts/tts.js", () => ({
  buildTtsSystemPromptHint: vi.fn(() => undefined),
}));

vi.mock("../../../utils.js", () => ({
  resolveUserPath: vi.fn((p: string) => p),
}));

vi.mock("../../../utils/message-channel.js", () => ({
  normalizeMessageChannel: vi.fn(() => undefined),
}));

vi.mock("../../../utils/provider-utils.js", () => ({
  isReasoningTagProvider: vi.fn(() => false),
}));

vi.mock("../../agent-paths.js", () => ({
  resolveOpenClawAgentDir: vi.fn(() => "/tmp/openclaw-agent"),
}));

vi.mock("../../agent-scope.js", () => ({
  resolveSessionAgentIds: vi.fn(() => ({ defaultAgentId: "main", sessionAgentId: "main" })),
}));

vi.mock("../../anthropic-payload-log.js", () => ({
  createAnthropicPayloadLogger: vi.fn(() => null),
}));

vi.mock("../../bootstrap-files.js", () => ({
  makeBootstrapWarn: vi.fn(() => () => {}),
  resolveBootstrapContextForRun: vi.fn(async () => ({ bootstrapFiles: [], contextFiles: [] })),
}));

vi.mock("../../cache-trace.js", () => ({
  createCacheTrace: vi.fn(() => null),
}));

vi.mock("../../channel-tools.js", () => ({
  listChannelSupportedActions: vi.fn(() => []),
  resolveChannelMessageToolHints: vi.fn(() => undefined),
}));

vi.mock("../../docs-path.js", () => ({
  resolveOpenClawDocsPath: vi.fn(async () => null),
}));

vi.mock("../../failover-error.js", () => ({
  isTimeoutError: vi.fn(() => false),
}));

vi.mock("../../model-auth.js", () => ({
  resolveModelAuthMode: vi.fn(() => "env"),
}));

vi.mock("../../model-selection.js", () => ({
  resolveDefaultModelForAgent: vi.fn(() => ({ provider: "test", model: "test" })),
}));

vi.mock("../../pi-embedded-helpers.js", () => ({
  isCloudCodeAssistFormatError: vi.fn(() => false),
  resolveBootstrapMaxChars: vi.fn(() => 0),
  validateAnthropicTurns: vi.fn((m: unknown) => m),
  validateGeminiTurns: vi.fn((m: unknown) => m),
}));

vi.mock("../../pi-embedded-subscribe.js", () => ({
  subscribeEmbeddedPiSession,
}));

vi.mock("../../pi-settings.js", () => ({
  ensurePiCompactionReserveTokens: vi.fn(() => {}),
  resolveCompactionReserveTokensFloor: vi.fn(() => 0),
}));

vi.mock("../../pi-tool-definition-adapter.js", () => ({
  toClientToolDefinitions: vi.fn(() => []),
}));

vi.mock("../../pi-tools.js", () => ({
  createOpenClawCodingTools: vi.fn(() => []),
}));

vi.mock("../../sandbox.js", () => ({
  resolveSandboxContext: vi.fn(async () => null),
}));

vi.mock("../../sandbox/runtime-status.js", () => ({
  resolveSandboxRuntimeStatus: vi.fn(() => ({ mode: "off", sandboxed: false })),
}));

vi.mock("../../session-file-repair.js", () => ({
  repairSessionFileIfNeeded: vi.fn(async () => {}),
}));

vi.mock("../../session-tool-result-guard-wrapper.js", () => ({
  guardSessionManager: vi.fn((mgr: unknown) => mgr),
}));

vi.mock("../../session-transcript-repair.js", () => ({
  sanitizeToolUseResultPairing: vi.fn((m: unknown) => m),
}));

vi.mock("../../session-write-lock.js", () => ({
  acquireSessionWriteLock: vi.fn(async () => ({ release: vi.fn(async () => {}) })),
}));

vi.mock("../../shell-utils.js", () => ({
  detectRuntimeShell: vi.fn(() => "zsh"),
}));

vi.mock("../../skills.js", () => ({
  applySkillEnvOverrides: vi.fn(() => () => {}),
  applySkillEnvOverridesFromSnapshot: vi.fn(() => () => {}),
  loadWorkspaceSkillEntries: vi.fn(() => []),
  resolveSkillsPromptForRun: vi.fn(() => ""),
}));

vi.mock("../../system-prompt-params.js", () => ({
  buildSystemPromptParams: vi.fn(() => ({
    runtimeInfo: {},
    userTimezone: "UTC",
    userTime: "",
    userTimeFormat: "",
  })),
}));

vi.mock("../../system-prompt-report.js", () => ({
  buildSystemPromptReport: vi.fn(() => ({})),
}));

vi.mock("../../transcript-policy.js", () => ({
  resolveTranscriptPolicy: vi.fn(() => ({
    allowSyntheticToolResults: true,
    validateGeminiTurns: false,
    validateAnthropicTurns: false,
    repairToolUseResultPairing: false,
  })),
}));

vi.mock("../../workspace.js", () => ({
  DEFAULT_BOOTSTRAP_FILENAME: "AGENTS.md",
}));

vi.mock("../extensions.js", () => ({
  buildEmbeddedExtensionPaths: vi.fn(() => []),
}));

vi.mock("../extra-params.js", () => ({
  applyExtraParamsToAgent: vi.fn(() => {}),
}));

vi.mock("../google.js", () => ({
  logToolSchemasForGoogle: vi.fn(() => {}),
  sanitizeAntigravityThinkingBlocks: vi.fn((m: unknown) => m),
  sanitizeSessionHistory: vi.fn(async () => []),
  sanitizeToolsForGoogle: vi.fn(({ tools }: { tools: unknown[] }) => tools),
}));

vi.mock("../history.js", () => ({
  getDmHistoryLimitFromSessionKey: vi.fn(() => 0),
  limitHistoryTurns: vi.fn((m: unknown) => m),
}));

vi.mock("../logger.js", () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../model.js", () => ({
  buildModelAliasLines: vi.fn(() => []),
}));

vi.mock("../runs.js", () => ({
  setActiveEmbeddedRun,
  clearActiveEmbeddedRun,
}));

vi.mock("../sandbox-info.js", () => ({
  buildEmbeddedSandboxInfo: vi.fn(() => ({})),
}));

vi.mock("../session-manager-cache.js", () => ({
  prewarmSessionFile: vi.fn(async () => {}),
  trackSessionManagerAccess: vi.fn(() => {}),
}));

vi.mock("../session-manager-init.js", () => ({
  prepareSessionManagerForRun: vi.fn(async () => {}),
}));

vi.mock("../system-prompt.js", () => ({
  applySystemPromptOverrideToSession: vi.fn(() => {}),
  buildEmbeddedSystemPrompt: vi.fn(() => ""),
  createSystemPromptOverride: vi.fn(() => () => ""),
}));

vi.mock("../tool-split.js", () => ({
  splitSdkTools: vi.fn(() => ({ builtInTools: [], customTools: [] })),
}));

vi.mock("../utils.js", () => ({
  describeUnknownError: vi.fn((err: unknown) => String(err)),
  mapThinkingLevel: vi.fn((v: unknown) => v),
}));

vi.mock("./images.js", () => ({
  detectAndLoadPromptImages: vi.fn(async () => ({
    images: [],
    historyImagesByIndex: new Map(),
  })),
}));

describe("runEmbeddedAttempt", () => {
  it("should return after timeout even if compaction retry wait never resolves", async () => {
    vi.useFakeTimers();

    let resolveWaitCalled: (() => void) | undefined;
    const waitCalled = new Promise<void>((resolve) => {
      resolveWaitCalled = resolve;
    });

    let resolveCompaction: (() => void) | undefined;
    const compactionPromise = new Promise<void>((resolve) => {
      resolveCompaction = resolve;
    });

    const session = {
      sessionId: "session-used",
      messages: [],
      agent: {
        replaceMessages: vi.fn(),
        streamFn: undefined as unknown,
      },
      isStreaming: false,
      prompt: vi.fn(async () => {}),
      steer: vi.fn(async () => {}),
      abort: vi.fn(async () => {}),
      dispose: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    };

    createAgentSession.mockResolvedValue({ session });

    subscribeEmbeddedPiSession.mockImplementation(() => ({
      assistantTexts: [],
      toolMetas: [],
      unsubscribe: vi.fn(),
      isCompacting: () => true,
      waitForCompactionRetry: () => {
        resolveWaitCalled?.();
        return compactionPromise;
      },
      getMessagingToolSentTexts: () => [],
      getMessagingToolSentTargets: () => [],
      didSendViaMessagingTool: () => false,
      getLastToolError: () => undefined,
      getUsageTotals: () => undefined,
      getCompactionCount: () => 0,
    }));

    const { runEmbeddedAttempt } = await import("./attempt.js");

    const timeoutMs = 50;
    const runPromise = runEmbeddedAttempt({
      sessionId: "session-id",
      sessionFile: "/tmp/openclaw-session.jsonl",
      workspaceDir: "/tmp/openclaw-workspace",
      prompt: "hi",
      provider: "test-provider",
      modelId: "test-model",
      model: { provider: "test", api: "responses", input: ["text"] },
      authStorage: {},
      modelRegistry: {},
      thinkLevel: "off",
      timeoutMs,
      runId: "run-1",
    } as never);

    let finished = false;
    void runPromise.finally(() => {
      finished = true;
    });

    try {
      await waitCalled;
      await vi.advanceTimersByTimeAsync(timeoutMs + 1);
      await Promise.resolve();

      // Expect runner to end on timeout instead of hanging in compaction wait.
      expect(finished).toBe(true);
      expect(clearActiveEmbeddedRun).toHaveBeenCalledTimes(1);
    } finally {
      // Ensure we don't leave the promise pending on failure.
      resolveCompaction?.();
      await runPromise.catch(() => {});
      vi.useRealTimers();
    }
  });
});

/**
 * Test: before_compaction & after_compaction hook wiring
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const hookMocks = vi.hoisted(() => ({
  runner: {
    hasHooks: vi.fn(() => false),
    runBeforeCompaction: vi.fn(async () => {}),
    runAfterCompaction: vi.fn(async () => {}),
  },
}));

vi.mock("../plugins/hook-runner-global.js", () => ({
  getGlobalHookRunner: () => hookMocks.runner,
}));

vi.mock("../infra/agent-events.js", () => ({
  emitAgentEvent: vi.fn(),
}));

describe("compaction hook wiring", () => {
  let handleAutoCompactionStart: typeof import("../agents/pi-embedded-subscribe.handlers.compaction.js").handleAutoCompactionStart;
  let handleAutoCompactionEnd: typeof import("../agents/pi-embedded-subscribe.handlers.compaction.js").handleAutoCompactionEnd;

  beforeAll(async () => {
    ({ handleAutoCompactionStart, handleAutoCompactionEnd } =
      await import("../agents/pi-embedded-subscribe.handlers.compaction.js"));
  });

  beforeEach(() => {
    hookMocks.runner.hasHooks.mockClear();
    hookMocks.runner.hasHooks.mockReturnValue(false);
    hookMocks.runner.runBeforeCompaction.mockClear();
    hookMocks.runner.runBeforeCompaction.mockResolvedValue(undefined);
    hookMocks.runner.runAfterCompaction.mockClear();
    hookMocks.runner.runAfterCompaction.mockResolvedValue(undefined);
  });

  it("calls runBeforeCompaction in handleAutoCompactionStart", () => {
    hookMocks.runner.hasHooks.mockReturnValue(true);

    const ctx = {
      params: {
        runId: "r1",
        sessionKey: "agent:main:web-abc123",
        session: { messages: [1, 2, 3], sessionFile: "/tmp/test.jsonl" },
      },
      state: { compactionInFlight: false },
      log: { debug: vi.fn(), warn: vi.fn() },
      incrementCompactionCount: vi.fn(),
      ensureCompactionPromise: vi.fn(),
    };

    handleAutoCompactionStart(ctx as never);

    expect(hookMocks.runner.runBeforeCompaction).toHaveBeenCalledTimes(1);

    const beforeCalls = hookMocks.runner.runBeforeCompaction.mock.calls as unknown as Array<
      [unknown, unknown]
    >;
    const event = beforeCalls[0]?.[0] as
      | { messageCount?: number; messages?: unknown[]; sessionFile?: string }
      | undefined;
    expect(event?.messageCount).toBe(3);
    expect(event?.messages).toEqual([1, 2, 3]);
    expect(event?.sessionFile).toBe("/tmp/test.jsonl");
    const hookCtx = beforeCalls[0]?.[1] as { sessionKey?: string } | undefined;
    expect(hookCtx?.sessionKey).toBe("agent:main:web-abc123");
  });

  it("calls runAfterCompaction when willRetry is false", () => {
    hookMocks.runner.hasHooks.mockReturnValue(true);

    const ctx = {
      params: { runId: "r2", session: { messages: [1, 2] } },
      state: { compactionInFlight: true },
      log: { debug: vi.fn(), warn: vi.fn() },
      maybeResolveCompactionWait: vi.fn(),
      getCompactionCount: () => 1,
    };

    handleAutoCompactionEnd(
      ctx as never,
      {
        type: "auto_compaction_end",
        willRetry: false,
      } as never,
    );

    expect(hookMocks.runner.runAfterCompaction).toHaveBeenCalledTimes(1);

    const afterCalls = hookMocks.runner.runAfterCompaction.mock.calls as unknown as Array<
      [unknown]
    >;
    const event = afterCalls[0]?.[0] as
      | { messageCount?: number; compactedCount?: number }
      | undefined;
    expect(event?.messageCount).toBe(2);
    expect(event?.compactedCount).toBe(1);
  });

  it("does not call runAfterCompaction when willRetry is true", () => {
    hookMocks.runner.hasHooks.mockReturnValue(true);

    const ctx = {
      params: { runId: "r3", session: { messages: [] } },
      state: { compactionInFlight: true },
      log: { debug: vi.fn(), warn: vi.fn() },
      noteCompactionRetry: vi.fn(),
      resetForCompactionRetry: vi.fn(),
      getCompactionCount: () => 0,
    };

    handleAutoCompactionEnd(
      ctx as never,
      {
        type: "auto_compaction_end",
        willRetry: true,
      } as never,
    );

    expect(hookMocks.runner.runAfterCompaction).not.toHaveBeenCalled();
  });

  it("clears stale usage.totalTokens from preserved assistant messages after final compaction", () => {
    const messages = [
      { role: "system", content: "compaction summary" },
      { role: "user", content: "hello" },
      {
        role: "assistant",
        content: "hi",
        usage: { totalTokens: 184_297, inputTokens: 100, outputTokens: 200 },
      },
      { role: "user", content: "test" },
      {
        role: "assistant",
        content: "response",
        usage: { totalTokens: 180_000, inputTokens: 50, outputTokens: 100 },
      },
    ];

    const ctx = {
      params: { runId: "r4", session: { messages } },
      state: { compactionInFlight: true },
      log: { debug: vi.fn(), warn: vi.fn() },
      maybeResolveCompactionWait: vi.fn(),
      incrementCompactionCount: vi.fn(),
      getCompactionCount: () => 1,
    };

    handleAutoCompactionEnd(
      ctx as never,
      {
        type: "auto_compaction_end",
        willRetry: false,
      } as never,
    );

    // totalTokens should be cleared on assistant messages
    const assistant1 = messages[2] as { usage: Record<string, unknown> };
    const assistant2 = messages[4] as { usage: Record<string, unknown> };
    expect(assistant1.usage.totalTokens).toBeUndefined();
    expect(assistant2.usage.totalTokens).toBeUndefined();
    // Other usage fields should be preserved
    expect(assistant1.usage.inputTokens).toBe(100);
    expect(assistant2.usage.outputTokens).toBe(100);

    // Non-assistant messages should be untouched
    expect(messages[0]).toEqual({ role: "system", content: "compaction summary" });
    expect(messages[1]).toEqual({ role: "user", content: "hello" });
  });

  it("does not clear usage.totalTokens when willRetry is true", () => {
    const messages = [
      {
        role: "assistant",
        content: "hi",
        usage: { totalTokens: 184_297 },
      },
    ];

    const ctx = {
      params: { runId: "r5", session: { messages } },
      state: { compactionInFlight: true },
      log: { debug: vi.fn(), warn: vi.fn() },
      noteCompactionRetry: vi.fn(),
      resetForCompactionRetry: vi.fn(),
      getCompactionCount: () => 0,
    };

    handleAutoCompactionEnd(
      ctx as never,
      {
        type: "auto_compaction_end",
        willRetry: true,
      } as never,
    );

    const assistant = messages[0] as { usage: Record<string, unknown> };
    expect(assistant.usage.totalTokens).toBe(184_297);
  });
});

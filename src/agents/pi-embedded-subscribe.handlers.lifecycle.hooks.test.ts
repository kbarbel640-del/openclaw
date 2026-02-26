import { describe, expect, it, vi } from "vitest";
import { getGlobalHookRunner } from "../plugins/hook-runner-global.js";
import {
  handleAutoCompactionEnd,
  handleAutoCompactionStart,
} from "./pi-embedded-subscribe.handlers.lifecycle.js";

vi.mock("../plugins/hook-runner-global.js");

const mockGetGlobalHookRunner = vi.mocked(getGlobalHookRunner);

describe("embedded subscribe lifecycle hook wiring", () => {
  it("fires before_compaction and after_compaction around compaction events", () => {
    const runBeforeCompaction = vi.fn().mockResolvedValue(undefined);
    const runAfterCompaction = vi.fn().mockResolvedValue(undefined);
    mockGetGlobalHookRunner.mockReturnValue({
      hasHooks: (name: string) => name === "before_compaction" || name === "after_compaction",
      runBeforeCompaction,
      runAfterCompaction,
    } as never);

    const ctx = {
      params: {
        runId: "r1",
        session: { messages: [{ role: "user" }, { role: "assistant" }, { role: "user" }] },
      },
      state: {
        compactionInFlight: false,
        compactionStartMessageCount: undefined,
      },
      log: { debug: vi.fn(), warn: vi.fn() },
      incrementCompactionCount: vi.fn(),
      ensureCompactionPromise: vi.fn(),
      noteCompactionRetry: vi.fn(),
      resetForCompactionRetry: vi.fn(),
      maybeResolveCompactionWait: vi.fn(),
      getCompactionCount: vi.fn(() => 2),
      paramsOnAgentEvent: vi.fn(),
    } as unknown as Parameters<typeof handleAutoCompactionStart>[0];

    handleAutoCompactionStart(ctx);
    (ctx.params.session as { messages: Array<{ role: string }> }).messages = [{ role: "user" }];
    handleAutoCompactionEnd(ctx, { type: "agent_end", willRetry: false } as never);

    expect(runBeforeCompaction).toHaveBeenCalledWith(
      expect.objectContaining({
        messageCount: 3,
        messages: [{ role: "user" }, { role: "assistant" }, { role: "user" }],
        sessionFile: undefined,
      }),
      { sessionKey: undefined },
    );
    expect(runAfterCompaction).toHaveBeenCalledWith({ messageCount: 1, compactedCount: 2 }, {});
  });
});

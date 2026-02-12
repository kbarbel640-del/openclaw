import { describe, expect, it, vi } from "vitest";
import type { EmbeddedPiSubscribeContext } from "./pi-embedded-subscribe.handlers.types.js";
import { handleToolExecutionStart } from "./pi-embedded-subscribe.handlers.tools.js";

function createContext() {
  const warn = vi.fn<(message: string) => void>();
  const debug = vi.fn<(message: string) => void>();
  const ctx = {
    flushBlockReplyBuffer: () => {},
    params: { runId: "run-1" },
    log: { warn, debug },
    state: {
      toolMetaById: new Map<string, string | undefined>(),
      toolSummaryById: new Set<string>(),
      pendingMessagingTargets: new Map<string, never>(),
      pendingMessagingTexts: new Map<string, string>(),
    },
    shouldEmitToolResult: () => false,
    emitToolSummary: () => {},
  } satisfies Partial<EmbeddedPiSubscribeContext>;
  return {
    ctx: ctx as unknown as EmbeddedPiSubscribeContext,
    warn,
  };
}

describe("handleToolExecutionStart read path checks", () => {
  it("does not warn when file_path is present", async () => {
    const { ctx, warn } = createContext();

    await handleToolExecutionStart(ctx, {
      type: "tool_execution_start",
      toolName: "read",
      toolCallId: "call-1",
      args: { file_path: "src/infra/errors.ts" },
    });

    expect(warn).not.toHaveBeenCalled();
  });

  it("warns when neither path nor file_path is present", async () => {
    const { ctx, warn } = createContext();

    await handleToolExecutionStart(ctx, {
      type: "tool_execution_start",
      toolName: "read",
      toolCallId: "call-2",
      args: {},
    });

    expect(warn).toHaveBeenCalledTimes(1);
  });
});

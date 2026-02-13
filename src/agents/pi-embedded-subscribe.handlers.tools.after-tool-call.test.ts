import { describe, expect, it, vi } from "vitest";
import { getGlobalHookRunner } from "../plugins/hook-runner-global.js";
import {
  handleToolExecutionEnd,
  handleToolExecutionStart,
} from "./pi-embedded-subscribe.handlers.tools.js";

vi.mock("../plugins/hook-runner-global.js");

const mockGetGlobalHookRunner = vi.mocked(getGlobalHookRunner);

describe("handleToolExecutionEnd after_tool_call hook", () => {
  it("emits after_tool_call with params and duration", async () => {
    const runAfterToolCall = vi.fn().mockResolvedValue(undefined);
    mockGetGlobalHookRunner.mockReturnValue({
      hasHooks: (name: string) => name === "after_tool_call",
      runAfterToolCall,
    } as never);

    const ctx = {
      params: {
        runId: "run-1",
        agentId: "agent-main",
        sessionKey: "session-main",
        workspaceDir: "/tmp/workspace",
        agentWorkspaceDir: "/tmp/workspace-real",
        messageProvider: "whatsapp",
        peerId: "peer-1",
        senderE164: "+15551234567",
        onAgentEvent: undefined,
        onToolResult: undefined,
      },
      state: {
        toolMetas: [],
        toolMetaById: new Map<string, string | undefined>(),
        toolStartTimes: new Map<string, number>(),
        toolParamsById: new Map<string, Record<string, unknown>>(),
        toolSummaryById: new Set<string>(),
        pendingMessagingTexts: new Map<string, string>(),
        pendingMessagingTargets: new Map<string, { tool: string; provider: string }>(),
        messagingToolSentTexts: [],
        messagingToolSentTextsNormalized: [],
        messagingToolSentTargets: [],
        lastToolError: undefined,
      },
      log: { debug: vi.fn(), warn: vi.fn() },
      flushBlockReplyBuffer: vi.fn(),
      shouldEmitToolResult: () => false,
      shouldEmitToolOutput: () => false,
      emitToolSummary: vi.fn(),
      emitToolOutput: vi.fn(),
      trimMessagingToolSent: vi.fn(),
    } as never;

    await handleToolExecutionStart(ctx, {
      type: "tool_execution_start",
      toolName: "read",
      toolCallId: "call-1",
      args: { path: "memory/shared/foo.md" },
    } as never);

    expect(ctx.state.toolParamsById.get("call-1")).toEqual({ path: "memory/shared/foo.md" });
    expect(ctx.state.toolStartTimes.has("call-1")).toBe(true);

    handleToolExecutionEnd(ctx, {
      type: "tool_execution_end",
      toolName: "read",
      toolCallId: "call-1",
      isError: false,
      result: { content: [{ type: "text", text: "ok" }] },
    } as never);

    await Promise.resolve();

    expect(ctx.state.toolParamsById.has("call-1")).toBe(false);
    expect(ctx.state.toolStartTimes.has("call-1")).toBe(false);
    expect(runAfterToolCall).toHaveBeenCalledTimes(1);
    const [event, hookCtx] = runAfterToolCall.mock.calls[0] ?? [];
    expect(event).toMatchObject({
      toolName: "read",
      params: { path: "memory/shared/foo.md" },
    });
    expect(typeof event.durationMs === "number" || event.durationMs === undefined).toBe(true);
    expect(hookCtx).toEqual({
      toolName: "read",
      agentId: "agent-main",
      sessionKey: "session-main",
      workspaceDir: "/tmp/workspace",
      agentWorkspaceDir: "/tmp/workspace-real",
      messageProvider: "whatsapp",
      peerId: "peer-1",
      senderE164: "+15551234567",
    });
  });
});

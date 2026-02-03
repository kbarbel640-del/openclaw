import { describe, expect, it, vi } from "vitest";
import { createAgentEventHandler, createChatRunState } from "./server-chat.js";

describe("agent event handler", () => {
  it("emits chat delta for assistant text-only events", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const broadcast = vi.fn();
    const nodeSendToSession = vi.fn();
    const agentRunSeq = new Map<string, number>();
    const chatRunState = createChatRunState();
    chatRunState.registry.add("run-1", { sessionKey: "session-1", clientRunId: "client-1" });

    const handler = createAgentEventHandler({
      broadcast,
      nodeSendToSession,
      agentRunSeq,
      chatRunState,
      resolveSessionKeyForRun: () => undefined,
      clearAgentRunContext: vi.fn(),
    });

    handler({
      runId: "run-1",
      seq: 1,
      stream: "assistant",
      ts: Date.now(),
      data: { text: "Hello world" },
    });

    const chatCalls = broadcast.mock.calls.filter(([event]) => event === "chat");
    expect(chatCalls).toHaveLength(1);
    const payload = chatCalls[0]?.[1] as {
      state?: string;
      message?: { content?: Array<{ text?: string }> };
    };
    expect(payload.state).toBe("delta");
    expect(payload.message?.content?.[0]?.text).toBe("Hello world");
    const sessionChatCalls = nodeSendToSession.mock.calls.filter(([, event]) => event === "chat");
    expect(sessionChatCalls).toHaveLength(1);
    nowSpy.mockRestore();
  });

  it("filters compaction events from broadcast but sends to session", () => {
    const broadcast = vi.fn();
    const nodeSendToSession = vi.fn();
    const agentRunSeq = new Map<string, number>();
    const chatRunState = createChatRunState();

    const handler = createAgentEventHandler({
      broadcast,
      nodeSendToSession,
      agentRunSeq,
      chatRunState,
      resolveSessionKeyForRun: () => "session-1",
      clearAgentRunContext: vi.fn(),
    });

    // Send a compaction event
    handler({
      runId: "run-1",
      seq: 1,
      stream: "compaction",
      ts: Date.now(),
      data: {
        action: "compacting",
        reason: "token_threshold",
      },
    });

    // Verify compaction event was NOT broadcast to WebSocket clients
    const agentBroadcasts = broadcast.mock.calls.filter(([event]) => event === "agent");
    const compactionBroadcasts = agentBroadcasts.filter(
      ([, payload]: [string, { stream?: string }]) => payload.stream === "compaction",
    );
    expect(compactionBroadcasts).toHaveLength(0);

    // Verify compaction event WAS sent to session-specific handler
    const sessionAgentCalls = nodeSendToSession.mock.calls.filter(
      ([sessionKey, event]) => sessionKey === "session-1" && event === "agent",
    );
    expect(sessionAgentCalls).toHaveLength(1);
    const sessionPayload = sessionAgentCalls[0]?.[2] as { stream?: string };
    expect(sessionPayload.stream).toBe("compaction");
  });

  it("allows other event types through broadcast", () => {
    const broadcast = vi.fn();
    const nodeSendToSession = vi.fn();
    const agentRunSeq = new Map<string, number>();
    const chatRunState = createChatRunState();

    const handler = createAgentEventHandler({
      broadcast,
      nodeSendToSession,
      agentRunSeq,
      chatRunState,
      resolveSessionKeyForRun: () => "session-1",
      clearAgentRunContext: vi.fn(),
    });

    // Send a lifecycle event (should be broadcast)
    handler({
      runId: "run-1",
      seq: 1,
      stream: "lifecycle",
      ts: Date.now(),
      data: { phase: "start" },
    });

    // Verify lifecycle event WAS broadcast
    const agentBroadcasts = broadcast.mock.calls.filter(([event]) => event === "agent");
    const lifecycleBroadcasts = agentBroadcasts.filter(
      ([, payload]: [string, { stream?: string }]) => payload.stream === "lifecycle",
    );
    expect(lifecycleBroadcasts).toHaveLength(1);
  });
});

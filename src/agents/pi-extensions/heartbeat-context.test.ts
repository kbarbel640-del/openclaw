import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";

import { applyHeartbeatContext } from "./heartbeat-context.js";

function makeToolResult(params: {
  toolCallId: string;
  toolName: string;
  text: string;
}): AgentMessage {
  return {
    role: "toolResult",
    toolCallId: params.toolCallId,
    toolName: params.toolName,
    content: [{ type: "text", text: params.text }],
    isError: false,
    timestamp: Date.now(),
  };
}

function toolText(msg: AgentMessage): string {
  if (msg.role !== "toolResult") throw new Error("expected toolResult");
  const first = msg.content.find((b) => b.type === "text");
  if (!first || first.type !== "text") return "";
  return first.text;
}

function makeAssistant(text: string): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "openai-responses",
    provider: "openai",
    model: "fake",
    usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, total: 2 },
    stopReason: "stop",
    timestamp: Date.now(),
  };
}

function makeUser(text: string): AgentMessage {
  return { role: "user", content: text, timestamp: Date.now() };
}

describe("heartbeat-context", () => {
  it("summarizes large tool results", () => {
    const messages: AgentMessage[] = [
      makeUser("u1"),
      makeAssistant("a1"),
      makeToolResult({ toolCallId: "t1", toolName: "browser", text: "x".repeat(100) }),
    ];

    const next = applyHeartbeatContext(messages, {
      mode: "summarize-tools",
      toolSummaryMaxChars: 50,
    });

    expect(toolText(next[2])).toContain("tool result omitted");
    expect(toolText(next[2])).toContain("browser");
  });

  it("keeps small tool results when under the limit", () => {
    const messages: AgentMessage[] = [
      makeToolResult({ toolCallId: "t1", toolName: "exec", text: "ok" }),
    ];

    const next = applyHeartbeatContext(messages, {
      mode: "summarize-tools",
      toolSummaryMaxChars: 10,
    });

    expect(toolText(next[0])).toBe("ok");
  });

  it("keeps only the last N messages", () => {
    const messages: AgentMessage[] = [
      makeUser("u1"),
      makeAssistant("a1"),
      makeUser("u2"),
      makeAssistant("a2"),
      makeUser("u3"),
    ];

    const next = applyHeartbeatContext(messages, {
      mode: "recent-messages",
      maxMessages: 2,
    });

    expect(next).toHaveLength(2);
    expect(next[0]?.role).toBe("assistant");
    expect(next[1]?.role).toBe("user");
  });

  it("returns original messages when mode is all", () => {
    const messages: AgentMessage[] = [makeUser("u1")];
    const next = applyHeartbeatContext(messages, { mode: "all" });
    expect(next).toBe(messages);
  });
});

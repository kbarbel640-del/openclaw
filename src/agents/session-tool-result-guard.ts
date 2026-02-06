import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { SessionManager } from "@mariozechner/pi-coding-agent";
import { emitSessionTranscriptUpdate } from "../sessions/transcript-events.js";
import { makeMissingToolResult, sanitizeToolCallInputs } from "./session-transcript-repair.js";

type ToolCall = { id: string; name?: string };

type PendingToolCall = {
  name: string | undefined;
  deadline: number;
};

type PendingDeadlineInfo = {
  toolCallId: string;
  name: string | undefined;
  deadline: number;
  remainingMs: number;
};

function extractAssistantToolCalls(msg: Extract<AgentMessage, { role: "assistant" }>): ToolCall[] {
  const content = msg.content;
  if (!Array.isArray(content)) {
    return [];
  }
  const toolCalls: ToolCall[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const rec = block as { type?: unknown; id?: unknown; name?: unknown };
    if (typeof rec.id !== "string" || !rec.id) {
      continue;
    }
    if (rec.type === "toolCall" || rec.type === "toolUse" || rec.type === "functionCall") {
      toolCalls.push({
        id: rec.id,
        name: typeof rec.name === "string" ? rec.name : undefined,
      });
    }
  }
  return toolCalls;
}

function extractToolResultId(msg: Extract<AgentMessage, { role: "toolResult" }>): string | null {
  const toolCallId = (msg as { toolCallId?: unknown }).toolCallId;
  if (typeof toolCallId === "string" && toolCallId) {
    return toolCallId;
  }
  const toolUseId = (msg as { toolUseId?: unknown }).toolUseId;
  if (typeof toolUseId === "string" && toolUseId) {
    return toolUseId;
  }
  return null;
}

export function installSessionToolResultGuard(
  sessionManager: SessionManager,
  opts?: {
    transformToolResultForPersistence?: (
      message: AgentMessage,
      meta: { toolCallId?: string; toolName?: string; isSynthetic?: boolean },
    ) => AgentMessage;
    allowSyntheticToolResults?: boolean;
    toolCallTimeoutMs?: number;
    timeoutCheckIntervalMs?: number;
  },
): {
  flushPendingToolResults: () => void;
  getPendingIds: () => string[];
  getPendingDeadlines: () => PendingDeadlineInfo[];
} {
  const originalAppend = sessionManager.appendMessage.bind(sessionManager);
  const pending = new Map<string, PendingToolCall>();
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

  const DEFAULT_TOOL_TIMEOUT_MS = opts?.toolCallTimeoutMs ?? 30000;
  const TIMEOUT_CHECK_INTERVAL_MS = opts?.timeoutCheckIntervalMs ?? 1000;

  function clearTimeoutCheck() {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
  }

  function startTimeoutCheck() {
    clearTimeoutCheck();
    if (pending.size === 0) {
      return;
    }

    let nearestDeadline = Infinity;
    for (const toolCall of pending.values()) {
      if (toolCall.deadline < nearestDeadline) {
        nearestDeadline = toolCall.deadline;
      }
    }

    if (nearestDeadline !== Infinity) {
      const delay = Math.max(0, nearestDeadline - Date.now());
      timeoutTimer = setTimeout(checkExpiredToolCalls, Math.min(delay, TIMEOUT_CHECK_INTERVAL_MS));
    }
  }

  function checkExpiredToolCalls() {
    const now = Date.now();
    const expiredToolCallIds: string[] = [];

    for (const [id, toolCall] of pending.entries()) {
      if (now >= toolCall.deadline) {
        expiredToolCallIds.push(id);
      }
    }

    for (const id of expiredToolCallIds) {
      const toolCall = pending.get(id);
      if (toolCall) {
        pending.delete(id);

        const timeoutResult = {
          role: "toolResult" as const,
          toolCallId: id,
          content: [
            {
              type: "text" as const,
              text: `Tool "${toolCall.name ?? "unknown"}" timed out after ${DEFAULT_TOOL_TIMEOUT_MS}ms`,
            },
          ],
          isError: true,
        };

        originalAppend(
          persistToolResult(timeoutResult as unknown as AgentMessage, {
            toolCallId: id,
            toolName: toolCall.name,
            isSynthetic: true,
          }) as never,
        );
      }
    }

    startTimeoutCheck();
  }

  const persistToolResult = (
    message: AgentMessage,
    meta: { toolCallId?: string; toolName?: string; isSynthetic?: boolean },
  ) => {
    const transformer = opts?.transformToolResultForPersistence;
    return transformer ? transformer(message, meta) : message;
  };

  const allowSyntheticToolResults = opts?.allowSyntheticToolResults ?? true;

  const flushPendingToolResults = () => {
    clearTimeoutCheck();
    if (pending.size === 0) {
      return;
    }
    if (allowSyntheticToolResults) {
      for (const [id, toolCall] of pending.entries()) {
        const synthetic = makeMissingToolResult({
          toolCallId: id,
          toolName: toolCall.name,
        });
        originalAppend(
          persistToolResult(synthetic, {
            toolCallId: id,
            toolName: toolCall.name,
            isSynthetic: true,
          }) as never,
        );
      }
    }
    pending.clear();
  };

  const getPendingDeadlines = (): PendingDeadlineInfo[] => {
    const now = Date.now();
    const result: PendingDeadlineInfo[] = [];
    for (const [id, toolCall] of pending.entries()) {
      result.push({
        toolCallId: id,
        name: toolCall.name,
        deadline: toolCall.deadline,
        remainingMs: Math.max(0, toolCall.deadline - now),
      });
    }
    return result;
  };

  const guardedAppend = (message: AgentMessage) => {
    let nextMessage = message;
    const role = (message as { role?: unknown }).role;
    if (role === "assistant") {
      const sanitized = sanitizeToolCallInputs([message]);
      if (sanitized.length === 0) {
        if (allowSyntheticToolResults && pending.size > 0) {
          flushPendingToolResults();
        }
        return undefined;
      }
      nextMessage = sanitized[0];
    }

    const nextRole = (nextMessage as { role?: unknown }).role;
    if (nextRole === "toolResult") {
      const id = extractToolResultId(nextMessage as Extract<AgentMessage, { role: "toolResult" }>);
      const toolCall = id ? pending.get(id) : undefined;
      if (id) {
        pending.delete(id);
      }
      startTimeoutCheck();
      return originalAppend(
        persistToolResult(nextMessage, {
          toolCallId: id ?? undefined,
          toolName: toolCall?.name,
          isSynthetic: false,
        }) as never,
      );
    }

    const toolCalls =
      nextRole === "assistant"
        ? extractAssistantToolCalls(nextMessage as Extract<AgentMessage, { role: "assistant" }>)
        : [];
    if (allowSyntheticToolResults) {
      if (pending.size > 0 && (toolCalls.length === 0 || nextRole !== "assistant")) {
        flushPendingToolResults();
      }
      if (pending.size > 0 && toolCalls.length > 0) {
        flushPendingToolResults();
      }
    }
    const result = originalAppend(nextMessage as never);
    const sessionFile = (
      sessionManager as { getSessionFile?: () => string | null }
    ).getSessionFile?.();
    if (sessionFile) {
      emitSessionTranscriptUpdate(sessionFile);
    }
    if (toolCalls.length > 0) {
      for (const call of toolCalls) {
        pending.set(call.id, {
          name: call.name,
          deadline: Date.now() + DEFAULT_TOOL_TIMEOUT_MS,
        });
      }
      startTimeoutCheck();
    }
    return result;
  };

  sessionManager.appendMessage = guardedAppend as SessionManager["appendMessage"];
  return {
    flushPendingToolResults,
    getPendingIds: () => Array.from(pending.keys()),
    getPendingDeadlines,
  };
}

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { SessionManager } from "@mariozechner/pi-coding-agent";
import { redactSensitiveText } from "../logging/redact.js";
import { getGlobalHookRunner } from "../plugins/hook-runner-global.js";
import {
  applyInputProvenanceToUserMessage,
  type InputProvenance,
} from "../sessions/input-provenance.js";
import { installSessionToolResultGuard } from "./session-tool-result-guard.js";

/**
 * Redact sensitive content (API keys, tokens, secrets) from tool result messages
 * before they are persisted to session transcripts.
 */
function redactToolResultContent(message: AgentMessage): AgentMessage {
  const role = (message as { role?: unknown }).role;
  if (role !== "toolResult") {
    return message;
  }

  const content = (message as { content?: unknown }).content;

  // Handle string content (some tool results use plain strings)
  if (typeof content === "string") {
    const redacted = redactSensitiveText(content, { mode: "tools" });
    if (redacted !== content) {
      return { ...message, content: redacted } as AgentMessage;
    }
    return message;
  }

  // Handle array content (standard block format)
  if (!Array.isArray(content)) {
    return message;
  }

  let modified = false;
  const redactedContent = content.map((block) => {
    if (
      block &&
      typeof block === "object" &&
      (block as { type?: unknown }).type === "text" &&
      typeof (block as { text?: unknown }).text === "string"
    ) {
      const original = (block as { text: string }).text;
      const redacted = redactSensitiveText(original, { mode: "tools" });
      if (redacted !== original) {
        modified = true;
        return { ...block, text: redacted };
      }
    }
    return block;
  });

  if (!modified) {
    return message;
  }

  return { ...message, content: redactedContent } as AgentMessage;
}

export type GuardedSessionManager = SessionManager & {
  /** Flush any synthetic tool results for pending tool calls. Idempotent. */
  flushPendingToolResults?: () => void;
};

/**
 * Apply the tool-result guard to a SessionManager exactly once and expose
 * a flush method on the instance for easy teardown handling.
 */
export function guardSessionManager(
  sessionManager: SessionManager,
  opts?: {
    agentId?: string;
    sessionKey?: string;
    inputProvenance?: InputProvenance;
    allowSyntheticToolResults?: boolean;
  },
): GuardedSessionManager {
  if (typeof (sessionManager as GuardedSessionManager).flushPendingToolResults === "function") {
    return sessionManager as GuardedSessionManager;
  }

  const hookRunner = getGlobalHookRunner();
  const beforeMessageWrite = hookRunner?.hasHooks("before_message_write")
    ? (event: { message: import("@mariozechner/pi-agent-core").AgentMessage }) => {
        return hookRunner.runBeforeMessageWrite(event, {
          agentId: opts?.agentId,
          sessionKey: opts?.sessionKey,
        });
      }
    : undefined;

  // Always redact secrets from tool results before persistence.
  // Redaction runs both before and after plugin hooks to ensure secrets
  // cannot leak even if a hook reintroduces sensitive content.
  const transform = (
    message: AgentMessage,
    meta: { toolCallId?: string; toolName?: string; isSynthetic?: boolean },
  ): AgentMessage => {
    // First pass: redact sensitive content (API keys, tokens, secrets)
    let result = redactToolResultContent(message);

    // Apply plugin hooks if registered
    if (hookRunner?.hasHooks("tool_result_persist")) {
      const out = hookRunner.runToolResultPersist(
        {
          toolName: meta.toolName,
          toolCallId: meta.toolCallId,
          message: result,
          isSynthetic: meta.isSynthetic,
        },
        {
          agentId: opts?.agentId,
          sessionKey: opts?.sessionKey,
          toolName: meta.toolName,
          toolCallId: meta.toolCallId,
        },
      );
      result = out?.message ?? result;

      // Second pass: ensure hooks didn't reintroduce secrets
      result = redactToolResultContent(result);
    }

    return result;
  };

  const guard = installSessionToolResultGuard(sessionManager, {
    transformMessageForPersistence: (message) =>
      applyInputProvenanceToUserMessage(message, opts?.inputProvenance),
    transformToolResultForPersistence: transform,
    allowSyntheticToolResults: opts?.allowSyntheticToolResults,
    beforeMessageWriteHook: beforeMessageWrite,
  });
  (sessionManager as GuardedSessionManager).flushPendingToolResults = guard.flushPendingToolResults;
  return sessionManager as GuardedSessionManager;
}

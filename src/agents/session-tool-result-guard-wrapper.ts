import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { SessionManager } from "@mariozechner/pi-coding-agent";

import { getGlobalHookRunner } from "../plugins/hook-runner-global.js";
import { getPiiMasker } from "../plugins/pii-masker.js";
import { installSessionToolResultGuard } from "./session-tool-result-guard.js";

/**
 * Create a transform that masks PII in message content before persistence.
 */
/**
 * Recursively mask PII in any string values within an object/array.
 */
function maskPiiInValue(
  value: unknown,
  masker: (text: string) => string,
): { value: unknown; changed: boolean } {
  if (typeof value === "string") {
    const masked = masker(value);
    return { value: masked, changed: masked !== value };
  }
  if (Array.isArray(value)) {
    let changed = false;
    const newArr = value.map((item) => {
      const result = maskPiiInValue(item, masker);
      if (result.changed) changed = true;
      return result.value;
    });
    return { value: changed ? newArr : value, changed };
  }
  if (value && typeof value === "object") {
    let changed = false;
    const newObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const result = maskPiiInValue(v, masker);
      newObj[k] = result.value;
      if (result.changed) changed = true;
    }
    return { value: changed ? newObj : value, changed };
  }
  return { value, changed: false };
}

function createPiiMaskingTransform(): ((message: AgentMessage) => AgentMessage) | undefined {
  return (message: AgentMessage): AgentMessage => {
    const masker = getPiiMasker();
    if (!masker) return message;

    const content = (message as { content?: unknown }).content;
    if (!content) return message;

    // Handle string content
    if (typeof content === "string") {
      const masked = masker(content);
      return masked !== content ? ({ ...message, content: masked } as AgentMessage) : message;
    }

    // Handle array content (text blocks, tool calls, etc.)
    if (Array.isArray(content)) {
      let changed = false;
      const newContent = content.map((block) => {
        if (!block || typeof block !== "object") return block;
        const rec = block as { type?: string; text?: string; arguments?: unknown };

        // Handle text blocks
        if (rec.type === "text" && typeof rec.text === "string") {
          const masked = masker(rec.text);
          if (masked !== rec.text) {
            changed = true;
            return { ...rec, text: masked };
          }
        }

        // Handle tool calls - mask PII in arguments and partialJson
        if (rec.type === "toolCall" || rec.type === "toolUse" || rec.type === "functionCall") {
          let blockChanged = false;
          let newBlock = { ...rec };

          // Mask arguments object
          if (rec.arguments) {
            const result = maskPiiInValue(rec.arguments, masker);
            if (result.changed) {
              blockChanged = true;
              newBlock = { ...newBlock, arguments: result.value };
            }
          }

          // Mask partialJson string (contains raw streamed JSON)
          const partialJson = (rec as { partialJson?: string }).partialJson;
          if (typeof partialJson === "string") {
            const masked = masker(partialJson);
            if (masked !== partialJson) {
              blockChanged = true;
              (newBlock as { partialJson?: string }).partialJson = masked;
            }
          }

          if (blockChanged) {
            changed = true;
            return newBlock;
          }
        }

        return block;
      });
      return changed ? ({ ...message, content: newContent } as AgentMessage) : message;
    }

    return message;
  };
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
    allowSyntheticToolResults?: boolean;
  },
): GuardedSessionManager {
  if (typeof (sessionManager as GuardedSessionManager).flushPendingToolResults === "function") {
    return sessionManager as GuardedSessionManager;
  }

  const hookRunner = getGlobalHookRunner();
  const toolResultTransform = hookRunner?.hasHooks("tool_result_persist")
    ? (message: any, meta: { toolCallId?: string; toolName?: string; isSynthetic?: boolean }) => {
        const out = hookRunner.runToolResultPersist(
          {
            toolName: meta.toolName,
            toolCallId: meta.toolCallId,
            message,
            isSynthetic: meta.isSynthetic,
          },
          {
            agentId: opts?.agentId,
            sessionKey: opts?.sessionKey,
            toolName: meta.toolName,
            toolCallId: meta.toolCallId,
          },
        );
        return out?.message ?? message;
      }
    : undefined;

  // Create PII masking transform if a masker is registered
  const piiMaskingTransform = createPiiMaskingTransform();

  const guard = installSessionToolResultGuard(sessionManager, {
    transformToolResultForPersistence: toolResultTransform,
    transformMessageForPersistence: piiMaskingTransform,
    allowSyntheticToolResults: opts?.allowSyntheticToolResults,
  });
  (sessionManager as GuardedSessionManager).flushPendingToolResults = guard.flushPendingToolResults;
  return sessionManager as GuardedSessionManager;
}

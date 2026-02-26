import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { SessionManager } from "@mariozechner/pi-coding-agent";

type AssistantContentBlock = Extract<AgentMessage, { role: "assistant" }>["content"][number];
type AssistantMessage = Extract<AgentMessage, { role: "assistant" }>;

export function isAssistantMessageWithContent(message: AgentMessage): message is AssistantMessage {
  return (
    !!message &&
    typeof message === "object" &&
    message.role === "assistant" &&
    Array.isArray(message.content)
  );
}

/**
 * Strip all `type: "thinking"` content blocks from assistant messages.
 *
 * If an assistant message becomes empty after stripping, it is replaced with
 * a synthetic `{ type: "text", text: "" }` block to preserve turn structure
 * (some providers require strict user/assistant alternation).
 *
 * Returns the original array reference when nothing was changed (callers can
 * use reference equality to skip downstream work).
 */
export function dropThinkingBlocks(messages: AgentMessage[]): AgentMessage[] {
  let touched = false;
  const out: AgentMessage[] = [];
  for (const msg of messages) {
    if (!isAssistantMessageWithContent(msg)) {
      out.push(msg);
      continue;
    }
    const nextContent: AssistantContentBlock[] = [];
    let changed = false;
    for (const block of msg.content) {
      if (block && typeof block === "object" && (block as { type?: unknown }).type === "thinking") {
        touched = true;
        changed = true;
        continue;
      }
      nextContent.push(block);
    }
    if (!changed) {
      out.push(msg);
      continue;
    }
    // Preserve the assistant turn even if all blocks were thinking-only.
    const content =
      nextContent.length > 0 ? nextContent : [{ type: "text", text: "" } as AssistantContentBlock];
    out.push({ ...msg, content });
  }
  return touched ? out : messages;
}

/**
 * Open a session file, strip all thinking blocks, and save if changed.
 * This walks the current branch and rewrites it from the first changed entry.
 */
export async function dropThinkingBlocksFromSession(params: { sessionFile: string }) {
  const manager = SessionManager.open(params.sessionFile);
  const branch = manager.getBranch();

  let firstChangedIdx = -1;
  const sanitizedMessages: AgentMessage[] = [];

  for (let i = 0; i < branch.length; i++) {
    const entry = branch[i];
    if (entry.type !== "message") {
      sanitizedMessages.push(undefined as unknown as AgentMessage); // Placeholder for non-message entries
      continue;
    }

    const msg = entry.message;
    const sanitizedMsg = dropThinkingBlocks([msg])[0];
    sanitizedMessages.push(sanitizedMsg);

    if (sanitizedMsg !== msg && firstChangedIdx === -1) {
      firstChangedIdx = i;
    }
  }

  if (firstChangedIdx === -1) {
    return { droppedCount: 0 };
  }

  // Rewrite branch from the parent of the first changed entry
  const firstChangedEntry = branch[firstChangedIdx];
  const branchFromId = firstChangedEntry.parentId;

  if (!branchFromId) {
    manager.resetLeaf();
  } else {
    manager.branch(branchFromId);
  }

  // Re-append all entries from that point onwards
  for (let i = firstChangedIdx; i < branch.length; i++) {
    const entry = branch[i];
    if (entry.type === "message") {
      manager.appendMessage(
        sanitizedMessages[i] as unknown as Parameters<typeof manager.appendMessage>[0],
      );
    } else if (entry.type === "compaction") {
      manager.appendCompaction(
        entry.summary,
        entry.firstKeptEntryId,
        entry.tokensBefore,
        entry.details,
        entry.fromHook,
      );
    } else if (entry.type === "thinking_level_change") {
      manager.appendThinkingLevelChange(entry.thinkingLevel);
    } else if (entry.type === "model_change") {
      manager.appendModelChange(entry.provider, entry.modelId);
    } else if (entry.type === "custom") {
      manager.appendCustomEntry(entry.customType, entry.data);
    } else if (entry.type === "custom_message") {
      manager.appendCustomMessageEntry(
        entry.customType,
        entry.content,
        entry.display,
        entry.details,
      );
    } else if (entry.type === "session_info") {
      if (entry.name) {
        manager.appendSessionInfo(entry.name);
      }
    }
  }

  return { droppedCount: 1 };
}

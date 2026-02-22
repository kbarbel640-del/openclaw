/**
 * Filters system-generated messages (heartbeats, memory flushes, NO_REPLY responses)
 * from chat history before displaying in the TUI.
 *
 * These messages are injected by OpenClaw internally and should not appear as
 * regular user/assistant messages in the chat log.
 */

import { SILENT_REPLY_TOKEN } from "../auto-reply/tokens.js";

/**
 * Known patterns that identify system-generated user messages.
 * These are substrings that appear in heartbeat prompts and memory flush prompts.
 */
const SYSTEM_USER_MESSAGE_PATTERNS = [
  // Heartbeat prompts (default and customized variants)
  "reply HEARTBEAT_OK",
  "reply heartbeat_ok",
  // Memory flush prompts (default)
  "Pre-compaction memory flush",
  "pre-compaction memory flush",
  // Memory flush prompts (custom) — ensureNoReplyHint always appends this
  "If no user-visible reply is needed, start with NO_REPLY",
  // Post-compaction audit (system-injected)
  "Post-Compaction Audit:",
  "post-compaction audit:",
  // Compaction notice
  "Compaction failed:",
  "Compacted •",
] as const;

/**
 * Known patterns for system-generated assistant responses that should be hidden.
 */
const SILENT_ASSISTANT_PATTERNS = [
  SILENT_REPLY_TOKEN, // "NO_REPLY"
  "HEARTBEAT_OK",
  "NO_FLUSH",
] as const;

/**
 * Extract the text content from a message record (handles both string and
 * content-array formats).
 */
function getMessageText(message: Record<string, unknown>): string {
  if (typeof message.content === "string") {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return (message.content as Array<Record<string, unknown>>)
      .filter((item) => item?.type === "text" && typeof item.text === "string")
      .map((item) => item.text as string)
      .join("\n");
  }
  if (typeof message.text === "string") {
    return message.text;
  }
  return "";
}

/**
 * Check if a user message is system-generated (heartbeat, memory flush, etc.).
 */
function isSystemGeneratedUserMessage(message: Record<string, unknown>): boolean {
  const text = getMessageText(message);
  if (!text) {
    return false;
  }
  return SYSTEM_USER_MESSAGE_PATTERNS.some((pattern) => text.includes(pattern));
}

/**
 * Check if an assistant message is a silent/no-op response that should be hidden.
 * Only matches messages where the entire content (trimmed) is one of the silent tokens.
 */
function isSilentAssistantMessage(message: Record<string, unknown>): boolean {
  const text = getMessageText(message).trim();
  if (!text) {
    return false;
  }
  // Must be a short message that is essentially just the token
  // (allow minor surrounding whitespace/punctuation but not real content)
  const normalized = text
    .replace(/^[\s*_`~]+/, "")
    .replace(/[\s*_`~]+$/, "")
    .trim();
  return SILENT_ASSISTANT_PATTERNS.some((pattern) => normalized === pattern);
}

/**
 * Filter system-generated messages from chat history.
 * Removes heartbeat/memory-flush user messages and their corresponding
 * NO_REPLY/HEARTBEAT_OK assistant responses.
 *
 * Messages are removed in pairs: if a user message is system-generated,
 * the immediately following assistant message is also removed (if it's silent).
 */
export function filterSystemMessages(messages: unknown[]): unknown[] {
  if (messages.length === 0) {
    return messages;
  }

  const result: unknown[] = [];
  let skipNextAssistant = false;

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") {
      result.push(msg);
      continue;
    }

    const message = msg as Record<string, unknown>;
    const role = typeof message.role === "string" ? message.role : "";

    if (role === "user" && isSystemGeneratedUserMessage(message)) {
      // Skip this system-generated user message and flag to skip the next assistant response
      skipNextAssistant = true;
      continue;
    }

    if (role === "assistant" && skipNextAssistant) {
      skipNextAssistant = false;
      // Always skip the assistant response paired with a system-generated user message,
      // whether it's silent or contains an alert
      if (isSilentAssistantMessage(message)) {
        continue;
      }
      // If the assistant response has real content (e.g., a heartbeat alert),
      // show it as a system message instead of hiding it
      result.push(message);
      continue;
    }

    // Standalone silent assistant messages (not paired with system user messages)
    if (role === "assistant" && isSilentAssistantMessage(message)) {
      continue;
    }

    skipNextAssistant = false;
    result.push(msg);
  }

  return result;
}

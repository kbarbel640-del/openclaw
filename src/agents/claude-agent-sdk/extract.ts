/**
 * Text extraction utilities for Claude Agent SDK events.
 *
 * Provides defensive multi-level extraction to handle evolving SDK event shapes.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Result of extracting content from a Claude Agent SDK event.
 * Both fields may be present if the event contains both text and thinking content.
 */
export type SdkEventExtraction = {
  /** Assistant text content (visible to user). */
  text?: string;
  /** Thinking/reasoning content (internal reasoning, may be shown as breadcrumbs). */
  thinking?: string;
};

/**
 * Extract text content from a value, recursively checking common structures.
 * Does NOT extract thinking content - that's handled separately.
 */
function extractTextFromContent(value: unknown): string | undefined {
  if (typeof value === "string") return value;

  // Common Claude-style content: [{type:"text", text:"..."}]
  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const entry of value) {
      if (typeof entry === "string") {
        parts.push(entry);
        continue;
      }
      if (!isRecord(entry)) continue;
      // Only extract from text-type blocks, not thinking blocks
      if (entry.type === "thinking") continue;
      const text = entry.text;
      if (typeof text === "string" && text.trim()) parts.push(text);
    }
    const joined = parts.join("\n").trim();
    return joined || undefined;
  }

  if (isRecord(value)) {
    // Some SDKs emit {text:"..."} or {delta:"..."}.
    const text = value.text;
    if (typeof text === "string" && text.trim()) return text;
    const delta = value.delta;
    if (typeof delta === "string" && delta.trim()) return delta;

    // Some SDKs nest deltas (e.g. Claude stream_event: { event: { delta: { text } } }).
    const nestedDelta = extractTextFromContent(delta);
    if (nestedDelta) return nestedDelta;

    const event = value.event;
    const nestedEvent = extractTextFromContent(event);
    if (nestedEvent) return nestedEvent;

    const content = value.content;
    const nested = extractTextFromContent(content);
    if (nested) return nested;
  }

  return undefined;
}

/**
 * Extract thinking content from a value, checking common SDK structures.
 */
function extractThinkingFromValue(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;

  // Direct thinking field
  const thinking = value.thinking;
  if (typeof thinking === "string" && thinking.trim()) return thinking;

  // content_block with type="thinking"
  const contentBlock = value.content_block as Record<string, unknown> | undefined;
  if (isRecord(contentBlock) && contentBlock.type === "thinking") {
    const blockThinking = contentBlock.thinking;
    if (typeof blockThinking === "string" && blockThinking.trim()) return blockThinking;
  }

  // delta with type="thinking_delta"
  const delta = value.delta as Record<string, unknown> | undefined;
  if (isRecord(delta)) {
    if (delta.type === "thinking_delta") {
      const deltaThinking = delta.thinking;
      if (typeof deltaThinking === "string" && deltaThinking.trim()) return deltaThinking;
    }
    // Also check direct thinking on delta (without type check)
    const directDeltaThinking = delta.thinking;
    if (typeof directDeltaThinking === "string" && directDeltaThinking.trim())
      return directDeltaThinking;
  }

  // Check content array for thinking blocks
  const content = value.content;
  if (Array.isArray(content)) {
    for (const entry of content) {
      if (!isRecord(entry)) continue;
      if (entry.type === "thinking") {
        const entryThinking = entry.thinking;
        if (typeof entryThinking === "string" && entryThinking.trim()) return entryThinking;
      }
    }
  }

  return undefined;
}

/**
 * Unified extraction of both text and thinking content from a Claude Agent SDK event.
 *
 * This is the preferred extraction function - it returns both text and thinking
 * content if present, allowing callers to handle both in a single call.
 *
 * @param event - The SDK event to extract content from
 * @returns Object with optional `text` and `thinking` fields
 */
export function extractFromClaudeAgentSdkEvent(event: unknown): SdkEventExtraction {
  const result: SdkEventExtraction = {};

  if (typeof event === "string") {
    result.text = event;
    return result;
  }

  if (!isRecord(event)) return result;

  // Extract thinking from the event
  const thinking = extractThinkingFromValue(event);
  if (thinking) result.thinking = thinking;

  // Also check nested message/data for thinking
  if (!result.thinking) {
    const message = event.message as Record<string, unknown> | undefined;
    if (isRecord(message)) {
      const msgThinking = extractThinkingFromValue(message);
      if (msgThinking) result.thinking = msgThinking;
    }
  }
  if (!result.thinking) {
    const data = event.data as Record<string, unknown> | undefined;
    if (isRecord(data)) {
      const dataThinking = extractThinkingFromValue(data);
      if (dataThinking) result.thinking = dataThinking;
    }
  }

  // Extract text from the event (separate from thinking)
  const direct = extractTextFromContent(event);
  if (direct) {
    result.text = direct;
    return result;
  }

  // Common wrapper shapes: {message:{...}}, {data:{...}}.
  const message = event.message;
  const fromMessage = extractTextFromContent(message);
  if (fromMessage) {
    result.text = fromMessage;
    return result;
  }

  const data = event.data;
  const fromData = extractTextFromContent(data);
  if (fromData) {
    result.text = fromData;
    return result;
  }

  // Nested message/data objects with content.
  if (isRecord(message)) {
    const fromMessageContent = extractTextFromContent(message.content);
    if (fromMessageContent) {
      result.text = fromMessageContent;
      return result;
    }
  }
  if (isRecord(data)) {
    const fromDataContent = extractTextFromContent(data.content);
    if (fromDataContent) {
      result.text = fromDataContent;
      return result;
    }
  }

  return result;
}

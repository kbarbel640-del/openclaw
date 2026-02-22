/**
 * Anthropic server-side tool block types (executed by Anthropic, not by the client).
 * These should be preserved when processing assistant message content; do not
 * treat them as client tool calls (no toolResult pairing needed).
 */
export const ANTHROPIC_SERVER_CONTENT_BLOCK_TYPES = [
  "server_tool_use",
  "web_search_tool_result",
] as const;

export type AnthropicServerContentBlockType = (typeof ANTHROPIC_SERVER_CONTENT_BLOCK_TYPES)[number];

export function isAnthropicServerContentBlock(block: unknown): boolean {
  if (!block || typeof block !== "object") {
    return false;
  }
  const type = (block as { type?: unknown }).type;
  return (
    typeof type === "string" &&
    (ANTHROPIC_SERVER_CONTENT_BLOCK_TYPES as readonly string[]).includes(type)
  );
}

export function collectTextContentBlocks(content: unknown): string[] {
  if (!Array.isArray(content)) {
    return [];
  }
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const rec = block as { type?: unknown; text?: unknown };
    if (rec.type === "text" && typeof rec.text === "string") {
      parts.push(rec.text);
    }
  }
  return parts;
}

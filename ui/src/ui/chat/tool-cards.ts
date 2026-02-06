import { html, nothing } from "lit";
import type { ToolCard, ToolCardImage } from "../types/chat-types.ts";
import { icons } from "../icons.ts";
import { formatToolDetail, resolveToolDisplay } from "../tool-display.ts";
import { TOOL_INLINE_THRESHOLD } from "./constants.ts";
import { extractTextCached } from "./message-extract.ts";
import { isToolResultMessage } from "./message-normalizer.ts";
import { formatToolOutputForSidebar, getTruncatedPreview } from "./tool-helpers.ts";

export function extractToolCards(message: unknown): ToolCard[] {
  const m = message as Record<string, unknown>;
  const content = normalizeContent(m.content);
  const cards: ToolCard[] = [];

  for (const item of content) {
    const kind = (typeof item.type === "string" ? item.type : "").toLowerCase();
    const isToolCall =
      ["toolcall", "tool_call", "tooluse", "tool_use"].includes(kind) ||
      (typeof item.name === "string" && item.arguments != null);
    if (isToolCall) {
      cards.push({
        kind: "call",
        name: (item.name as string) ?? "tool",
        args: coerceArgs(item.arguments ?? item.args),
      });
    }
  }

  for (const item of content) {
    const kind = (typeof item.type === "string" ? item.type : "").toLowerCase();
    if (kind !== "toolresult" && kind !== "tool_result") {
      continue;
    }
    const text = extractToolText(item);
    const name = typeof item.name === "string" ? item.name : "tool";
    cards.push({ kind: "result", name, text });
  }

  if (isToolResultMessage(message) && !cards.some((card) => card.kind === "result")) {
    const name =
      (typeof m.toolName === "string" && m.toolName) ||
      (typeof m.tool_name === "string" && m.tool_name) ||
      "tool";
    const text = extractTextCached(message) ?? undefined;
    const images = extractToolImages(m.content);
    cards.push({ kind: "result", name, text, images: images.length > 0 ? images : undefined });
  }

  return cards;
}

export function renderToolCardSidebar(
  card: ToolCard,
  onOpenSidebar?: (content: string, images?: Array<{ url: string; alt?: string }>) => void,
) {
  const display = resolveToolDisplay({ name: card.name, args: card.args });
  const detail = formatToolDetail(display);
  const hasText = Boolean(card.text?.trim());
  const hasImages = Boolean(card.images?.length);

  const canClick = Boolean(onOpenSidebar);
  const handleClick = canClick
    ? () => {
        const images = hasImages ? card.images : undefined;

        if (hasText) {
          onOpenSidebar!(formatToolOutputForSidebar(card.text!), images);
          return;
        }

        if (hasImages) {
          // Images only, no text content
          onOpenSidebar!("", images);
          return;
        }

        const info = `## ${display.label}\n\n${
          detail ? `**Command:** \`${detail}\`\n\n` : ""
        }*No output — tool completed successfully.*`;
        onOpenSidebar!(info);
      }
    : undefined;

  const isShort = hasText && (card.text?.length ?? 0) <= TOOL_INLINE_THRESHOLD;
  const showCollapsed = hasText && !isShort;
  const showInline = hasText && isShort;
  const isEmpty = !hasText && !hasImages;
  const hasContent = hasText || hasImages;

  return html`
    <div
      class="chat-tool-card ${canClick ? "chat-tool-card--clickable" : ""}"
      @click=${handleClick}
      role=${canClick ? "button" : nothing}
      tabindex=${canClick ? "0" : nothing}
      @keydown=${
        canClick
          ? (e: KeyboardEvent) => {
              if (e.key !== "Enter" && e.key !== " ") {
                return;
              }
              e.preventDefault();
              handleClick?.();
            }
          : nothing
      }
    >
      <div class="chat-tool-card__header">
        <div class="chat-tool-card__title">
          <span class="chat-tool-card__icon">${icons[display.icon]}</span>
          <span>${display.label}</span>
        </div>
        ${
          canClick
            ? html`<span class="chat-tool-card__action">${hasContent ? "View" : ""} ${icons.check}</span>`
            : nothing
        }
        ${isEmpty && !canClick ? html`<span class="chat-tool-card__status">${icons.check}</span>` : nothing}
      </div>
      ${detail ? html`<div class="chat-tool-card__detail">${detail}</div>` : nothing}
      ${
        isEmpty
          ? html`
              <div class="chat-tool-card__status-text muted">Completed</div>
            `
          : nothing
      }
      ${
        showCollapsed
          ? html`<div class="chat-tool-card__preview mono">${getTruncatedPreview(card.text!)}</div>`
          : nothing
      }
      ${showInline ? html`<div class="chat-tool-card__inline mono">${card.text}</div>` : nothing}
    </div>
  `;
}

function normalizeContent(content: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(content)) {
    return [];
  }
  return content.filter(Boolean) as Array<Record<string, unknown>>;
}

function coerceArgs(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return value;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function extractToolText(item: Record<string, unknown>): string | undefined {
  if (typeof item.text === "string") {
    return item.text;
  }
  if (typeof item.content === "string") {
    return item.content;
  }
  return undefined;
}

function extractToolImages(content: unknown): ToolCardImage[] {
  if (!Array.isArray(content)) {
    return [];
  }
  const images: ToolCardImage[] = [];
  for (const block of content) {
    if (typeof block !== "object" || block === null) {
      continue;
    }
    const b = block as Record<string, unknown>;
    if (b.type === "image") {
      // Handle source object format (Anthropic format)
      const source = b.source as Record<string, unknown> | undefined;
      if (source?.type === "base64" && typeof source.data === "string") {
        const data = source.data;
        const mediaType = (source.media_type as string) || "image/png";
        const url = data.startsWith("data:") ? data : `data:${mediaType};base64,${data}`;
        images.push({ url });
      } else if (typeof b.data === "string" && b.data.length > 0) {
        // Handle tool result format: { type: "image", data: base64, mimeType: "image/png" }
        const data = b.data;
        const mimeType = typeof b.mimeType === "string" ? b.mimeType : "image/png";
        const url = data.startsWith("data:") ? data : `data:${mimeType};base64,${data}`;
        images.push({ url });
      } else if (typeof b.url === "string") {
        images.push({ url: b.url });
      }
    } else if (b.type === "image_url") {
      // OpenAI format
      const imageUrl = b.image_url as Record<string, unknown> | undefined;
      if (typeof imageUrl?.url === "string") {
        images.push({ url: imageUrl.url });
      }
    }
  }
  return images;
}

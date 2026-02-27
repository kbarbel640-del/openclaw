import type { Block, KnownBlock } from "@slack/web-api";
import type { SlackBlock } from "./types.js";

type PlainTextObject = { text?: string };

type SlackBlockWithFields = {
  type?: string;
  text?: PlainTextObject & { type?: string };
  title?: PlainTextObject;
  alt_text?: string;
  elements?: Array<{ text?: string; type?: string }>;
};

function cleanCandidate(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function readSectionText(block: SlackBlockWithFields): string | undefined {
  return cleanCandidate(block.text?.text);
}

function readHeaderText(block: SlackBlockWithFields): string | undefined {
  return cleanCandidate(block.text?.text);
}

function readImageText(block: SlackBlockWithFields): string | undefined {
  return cleanCandidate(block.alt_text) ?? cleanCandidate(block.title?.text);
}

function readVideoText(block: SlackBlockWithFields): string | undefined {
  return cleanCandidate(block.title?.text) ?? cleanCandidate(block.alt_text);
}

function readContextText(block: SlackBlockWithFields): string | undefined {
  if (!Array.isArray(block.elements)) {
    return undefined;
  }
  const textParts = block.elements
    .map((element) => cleanCandidate(element.text))
    .filter((value): value is string => Boolean(value));
  return textParts.length > 0 ? textParts.join(" ") : undefined;
}

export function extractFullTextFromBlocks(blocks: SlackBlock[]): string | undefined {
  const parts: string[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "section":
      case "header": {
        const text = block.text?.text?.replace(/\s+/g, " ").trim();
        if (text) {
          parts.push(text);
        }
        break;
      }
      case "context": {
        if (Array.isArray(block.elements)) {
          const contextParts = block.elements
            .map((el) => el.text?.replace(/\s+/g, " ").trim())
            .filter(Boolean);
          if (contextParts.length > 0) {
            parts.push(contextParts.join(" "));
          }
        }
        break;
      }
      default:
        break;
    }
  }
  return parts.length > 0 ? parts.join("\n") : undefined;
}

export function buildSlackBlocksFallbackText(blocks: (Block | KnownBlock)[]): string {
  const parts: string[] = [];
  for (const raw of blocks) {
    const block = raw as SlackBlockWithFields;
    switch (block.type) {
      case "header": {
        const text = readHeaderText(block);
        if (text) {
          parts.push(text);
        }
        break;
      }
      case "section": {
        const text = readSectionText(block);
        if (text) {
          parts.push(text);
        }
        break;
      }
      case "image": {
        const text = readImageText(block);
        parts.push(text ?? "Shared an image");
        break;
      }
      case "video": {
        const text = readVideoText(block);
        parts.push(text ?? "Shared a video");
        break;
      }
      case "file": {
        parts.push("Shared a file");
        break;
      }
      case "context": {
        const text = readContextText(block);
        if (text) {
          parts.push(text);
        }
        break;
      }
      default:
        break;
    }
  }

  return parts.length > 0 ? parts.join("\n") : "Shared a Block Kit message";
}

import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { OpenClawConfig } from "../../config/config.js";
import { extractAssistantText } from "../pi-embedded-utils.js";

export type ImageModelConfig = { primary?: string; fallbacks?: string[] };

export function decodeDataUrl(dataUrl: string): {
  buffer: Buffer;
  mimeType: string;
  kind: "image";
} {
  const trimmed = dataUrl.trim();
  const match = /^data:([^;,]+);base64,([a-z0-9+/=\r\n]+)$/i.exec(trimmed);
  if (!match) {
    throw new Error("Invalid data URL (expected base64 data: URL).");
  }
  const mimeType = (match[1] ?? "").trim().toLowerCase();
  if (!mimeType.startsWith("image/")) {
    throw new Error(`Unsupported data URL type: ${mimeType || "unknown"}`);
  }
  const b64 = (match[2] ?? "").trim();
  const buffer = Buffer.from(b64, "base64");
  if (buffer.length === 0) {
    throw new Error("Invalid data URL: empty payload.");
  }
  return { buffer, mimeType, kind: "image" };
}

/**
 * Extract assistant response content from GLM API response format.
 * Handles the specific response structure: { choices: [{ message: { content: "..." } }] }
 * and ensures we return only the assistant's response, not system prompts.
 */
function extractGlmResponseContent(response: any): string {
  // Handle GLM API response structure: { choices: [{ message: { content: "..." } }] }
  if (response && typeof response === "object" && Array.isArray(response.choices)) {
    const choice = response.choices[0];
    if (
      choice &&
      typeof choice === "object" &&
      choice.message &&
      typeof choice.message.content === "string"
    ) {
      const content = choice.message.content.trim();
      // Filter out OCR system prompts from the extracted content
      return filterOcrSystemPrompt(content);
    }
  }

  // Fallback to direct content extraction
  return "";
}

// Match if text starts with known OCR prompt patterns
const ocrPromptStartPatterns = [
  /^You are a precise OCR/i,
  /^Your task is to extract/i,
  /^Extract all readable text/i,
  /^Extract text from/i,
];

/**
 * Check if the text looks like an echoed OCR prompt (no actual content).
 * This happens when GLM OCR fails to process the image and returns the prompt.
 */
function isOcrPromptEcho(text: string): boolean {
  const trimmed = text.trim();
  // If it starts with OCR prompt and is short (< 500 chars), it's likely an echo
  if (trimmed.length < 500) {
    return ocrPromptStartPatterns.some((pattern) => pattern.test(trimmed));
  }
  return false;
}

/**
 * Filter out OCR system prompts and instructions from extracted text.
 * This ensures that only the actual document content is returned, not OCR instructions.
 */
function filterOcrSystemPrompt(text: string): string {
  // Handle multi-line OCR responses
  const ocrSystemPatterns = [
    /^You are a precise OCR.*$/im,
    /^Your task is to extract.*$/im,
    /^Please extract.*$/im,
    /^Extract all readable text.*$/im,
    /^OCR.*$/im,
    /^Optical Character Recognition.*$/im,
  ];

  // Split text into lines and filter out OCR system prompt lines
  const lines = text.split("\n");
  const filteredLines: string[] = [];
  let inOcrPrompt = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check if line contains OCR system prompt indicators
    const isOcrPromptLine = ocrSystemPatterns.some((pattern) => pattern.test(trimmedLine));

    if (isOcrPromptLine) {
      inOcrPrompt = true;
      continue;
    }

    // If we're not in an OCR prompt section, keep the line
    if (!inOcrPrompt) {
      filteredLines.push(line);
    } else {
      // For multi-line prompts, check if this line looks like actual content
      if (
        !isOcrPromptLine &&
        trimmedLine.length > 5 &&
        !trimmedLine.match(/^(and|or|but|so|then|next|finally)$/i)
      ) {
        inOcrPrompt = false;
        filteredLines.push(line);
      }
    }
  }

  const filtered = filteredLines.join("\n").trim();

  // If filtering removed too much content, return the original text
  // This prevents over-filtering actual document content
  if (filtered.length < text.length * 0.1) {
    return text;
  }

  return filtered;
}

export function coerceImageAssistantText(params: {
  message: AssistantMessage;
  provider: string;
  model: string;
}): string {
  const stop = params.message.stopReason;
  const errorMessage = params.message.errorMessage?.trim();
  if (stop === "error" || stop === "aborted") {
    throw new Error(
      errorMessage
        ? `Image model failed (${params.provider}/${params.model}): ${errorMessage}`
        : `Image model failed (${params.provider}/${params.model})`,
    );
  }
  if (errorMessage) {
    throw new Error(`Image model failed (${params.provider}/${params.model}): ${errorMessage}`);
  }

  let text = "";

  // For GLM OCR processing, try to extract from the raw response format first
  if (
    (params.provider === "zai" || params.model.includes("glm")) &&
    (params.message as any).rawResponse
  ) {
    text = extractGlmResponseContent((params.message as any).rawResponse);
  }

  // Fallback to standard assistant text extraction
  if (!text) {
    text = extractAssistantText(params.message);
  }

  // If GLM OCR echoes back the prompt instead of extracting text, throw an error
  if ((params.provider === "zai" || params.model.includes("glm")) && isOcrPromptEcho(text)) {
    throw new Error(
      `GLM-OCR: Model returned the OCR prompt instead of extracted text. The image may be unreadable or in an unsupported format. (${params.provider}/${params.model})`,
    );
  }

  // Additional filtering for GLM/OCR models to remove system prompts
  if (params.provider === "zai" || params.model.includes("glm")) {
    text = filterOcrSystemPrompt(text);
  }

  if (text.trim()) {
    return text.trim();
  }

  // GLM-OCR specific error handling - provide helpful diagnostics
  if (params.provider === "zai" || params.model.includes("glm")) {
    const rawContent = extractAssistantText(params.message);
    const isBluryResponse = rawContent?.toLowerCase().includes("blur");
    if (isBluryResponse) {
      throw new Error(
        `GLM-OCR: Image too blurry or low resolution. Increase PDF rendering quality in openclaw config. (${params.provider}/${params.model})`,
      );
    }
  }

  throw new Error(`Image model returned no text (${params.provider}/${params.model}).`);
}

export function coerceImageModelConfig(cfg?: OpenClawConfig): ImageModelConfig {
  const imageModel = cfg?.agents?.defaults?.imageModel as
    | { primary?: string; fallbacks?: string[] }
    | string
    | undefined;
  const primary = typeof imageModel === "string" ? imageModel.trim() : imageModel?.primary;
  const fallbacks = typeof imageModel === "object" ? (imageModel?.fallbacks ?? []) : [];
  return {
    ...(primary?.trim() ? { primary: primary.trim() } : {}),
    ...(fallbacks.length > 0 ? { fallbacks } : {}),
  };
}

export function resolveProviderVisionModelFromConfig(params: {
  cfg?: OpenClawConfig;
  provider: string;
}): string | null {
  const providerCfg = params.cfg?.models?.providers?.[params.provider] as unknown as
    | { models?: Array<{ id?: string; input?: string[] }> }
    | undefined;
  const models = providerCfg?.models ?? [];
  const preferMinimaxVl =
    params.provider === "minimax"
      ? models.find(
          (m) =>
            (m?.id ?? "").trim() === "MiniMax-VL-01" &&
            Array.isArray(m?.input) &&
            m.input.includes("image"),
        )
      : null;
  const picked =
    preferMinimaxVl ??
    models.find((m) => Boolean((m?.id ?? "").trim()) && m.input?.includes("image"));
  const id = (picked?.id ?? "").trim();
  return id ? `${params.provider}/${id}` : null;
}

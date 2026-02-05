import { detectMime } from "../media/mime.js";

export type ChatAttachment = {
  type?: string;
  mimeType?: string;
  fileName?: string;
  content?: unknown;
};

export type ChatImageContent = {
  type: "image";
  data: string;
  mimeType: string;
};

export type ParsedMessageWithImages = {
  message: string;
  images: ChatImageContent[];
};

type AttachmentLog = {
  warn: (message: string) => void;
};

function normalizeMime(mime?: string): string | undefined {
  if (!mime) {
    return undefined;
  }
  const cleaned = mime.split(";")[0]?.trim().toLowerCase();
  return cleaned || undefined;
}

async function sniffMimeFromBase64(base64: string): Promise<string | undefined> {
  const trimmed = base64.trim();
  if (!trimmed) {
    return undefined;
  }

  const take = Math.min(256, trimmed.length);
  const sliceLen = take - (take % 4);
  if (sliceLen < 8) {
    return undefined;
  }

  try {
    const head = Buffer.from(trimmed.slice(0, sliceLen), "base64");
    return await detectMime({ buffer: head });
  } catch {
    return undefined;
  }
}

function isImageMime(mime?: string): boolean {
  return typeof mime === "string" && mime.startsWith("image/");
}

function isAudioMime(mime?: string): boolean {
  return typeof mime === "string" && mime.startsWith("audio/");
}

export type NormalizedAttachment = {
  type?: string;
  mimeType?: string;
  fileName?: string;
  content: string;
};

export type FirstAudioResult = {
  buffer: Buffer;
  mimeType: string;
};

/**
 * Find the first audio attachment in normalized attachments, validate base64 and size,
 * and return its decoded buffer and mime type. Returns null if no audio attachment found.
 * Throws on invalid base64 or when size exceeds maxBytes.
 */
export async function getFirstAudioAttachment(
  attachments: NormalizedAttachment[] | undefined,
  maxBytes: number,
): Promise<FirstAudioResult | null> {
  if (!attachments || attachments.length === 0) {
    return null;
  }
  for (const [idx, att] of attachments.entries()) {
    if (!att || typeof att.content !== "string") {
      continue;
    }
    const mime = att.mimeType ?? "";
    const providedMime = normalizeMime(mime);
    if (providedMime && isAudioMime(providedMime)) {
      const result = await decodeAndValidateAudioAttachment(att, idx, maxBytes);
      if (result) {
        return result;
      }
    }
    const sniffedMime = normalizeMime(await sniffMimeFromBase64(att.content));
    if (sniffedMime && isAudioMime(sniffedMime)) {
      const result = await decodeAndValidateAudioAttachment(att, idx, maxBytes);
      if (result) {
        return result;
      }
    }
  }
  return null;
}

async function decodeAndValidateAudioAttachment(
  att: NormalizedAttachment,
  idx: number,
  maxBytes: number,
): Promise<FirstAudioResult | null> {
  const label = att.fileName || att.type || `attachment-${idx + 1}`;
  let b64 = att.content.trim();
  const dataUrlMatch = /^data:[^;]+;base64,(.*)$/.exec(b64);
  if (dataUrlMatch) {
    b64 = dataUrlMatch[1];
  }
  if (b64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(b64)) {
    throw new Error(`attachment ${label}: invalid base64 content`);
  }
  let buffer: Buffer;
  try {
    buffer = Buffer.from(b64, "base64");
  } catch {
    throw new Error(`attachment ${label}: invalid base64 content`);
  }
  if (buffer.byteLength <= 0 || buffer.byteLength > maxBytes) {
    throw new Error(
      `attachment ${label}: exceeds size limit (${buffer.byteLength} > ${maxBytes} bytes)`,
    );
  }
  const mimeType =
    normalizeMime(att.mimeType) ?? (await detectMime({ buffer })) ?? "audio/octet-stream";
  if (!isAudioMime(mimeType)) {
    return null;
  }
  return { buffer, mimeType };
}

/**
 * Parse attachments and extract images as structured content blocks.
 * Returns the message text and an array of image content blocks
 * compatible with Claude API's image format.
 */
export async function parseMessageWithAttachments(
  message: string,
  attachments: ChatAttachment[] | undefined,
  opts?: { maxBytes?: number; log?: AttachmentLog },
): Promise<ParsedMessageWithImages> {
  const maxBytes = opts?.maxBytes ?? 5_000_000; // 5 MB
  const log = opts?.log;
  if (!attachments || attachments.length === 0) {
    return { message, images: [] };
  }

  const images: ChatImageContent[] = [];

  for (const [idx, att] of attachments.entries()) {
    if (!att) {
      continue;
    }
    const mime = att.mimeType ?? "";
    const content = att.content;
    const label = att.fileName || att.type || `attachment-${idx + 1}`;

    if (typeof content !== "string") {
      throw new Error(`attachment ${label}: content must be base64 string`);
    }

    let sizeBytes = 0;
    let b64 = content.trim();
    // Strip data URL prefix if present (e.g., "data:image/jpeg;base64,...")
    const dataUrlMatch = /^data:[^;]+;base64,(.*)$/.exec(b64);
    if (dataUrlMatch) {
      b64 = dataUrlMatch[1];
    }
    // Basic base64 sanity: length multiple of 4 and charset check.
    if (b64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(b64)) {
      throw new Error(`attachment ${label}: invalid base64 content`);
    }
    try {
      sizeBytes = Buffer.from(b64, "base64").byteLength;
    } catch {
      throw new Error(`attachment ${label}: invalid base64 content`);
    }
    if (sizeBytes <= 0 || sizeBytes > maxBytes) {
      throw new Error(`attachment ${label}: exceeds size limit (${sizeBytes} > ${maxBytes} bytes)`);
    }

    const providedMime = normalizeMime(mime);
    const sniffedMime = normalizeMime(await sniffMimeFromBase64(b64));
    const sniffedIsAudio = isAudioMime(sniffedMime);
    const providedIsAudio = isAudioMime(providedMime);
    if (sniffedMime && !isImageMime(sniffedMime)) {
      if (!sniffedIsAudio) {
        log?.warn(`attachment ${label}: detected non-image (${sniffedMime}), dropping`);
      }
      continue;
    }
    if (!sniffedMime && !isImageMime(providedMime)) {
      if (!providedIsAudio) {
        log?.warn(`attachment ${label}: unable to detect image mime type, dropping`);
      }
      continue;
    }
    if (sniffedMime && providedMime && sniffedMime !== providedMime) {
      log?.warn(
        `attachment ${label}: mime mismatch (${providedMime} -> ${sniffedMime}), using sniffed`,
      );
    }

    images.push({
      type: "image",
      data: b64,
      mimeType: sniffedMime ?? providedMime ?? mime,
    });
  }

  return { message, images };
}

/**
 * @deprecated Use parseMessageWithAttachments instead.
 * This function converts images to markdown data URLs which Claude API cannot process as images.
 */
export function buildMessageWithAttachments(
  message: string,
  attachments: ChatAttachment[] | undefined,
  opts?: { maxBytes?: number },
): string {
  const maxBytes = opts?.maxBytes ?? 2_000_000; // 2 MB
  if (!attachments || attachments.length === 0) {
    return message;
  }

  const blocks: string[] = [];

  for (const [idx, att] of attachments.entries()) {
    if (!att) {
      continue;
    }
    const mime = att.mimeType ?? "";
    const content = att.content;
    const label = att.fileName || att.type || `attachment-${idx + 1}`;

    if (typeof content !== "string") {
      throw new Error(`attachment ${label}: content must be base64 string`);
    }
    if (!mime.startsWith("image/")) {
      throw new Error(`attachment ${label}: only image/* supported`);
    }

    let sizeBytes = 0;
    const b64 = content.trim();
    // Basic base64 sanity: length multiple of 4 and charset check.
    if (b64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(b64)) {
      throw new Error(`attachment ${label}: invalid base64 content`);
    }
    try {
      sizeBytes = Buffer.from(b64, "base64").byteLength;
    } catch {
      throw new Error(`attachment ${label}: invalid base64 content`);
    }
    if (sizeBytes <= 0 || sizeBytes > maxBytes) {
      throw new Error(`attachment ${label}: exceeds size limit (${sizeBytes} > ${maxBytes} bytes)`);
    }

    const safeLabel = label.replace(/\s+/g, "_");
    const dataUrl = `![${safeLabel}](data:${mime};base64,${content})`;
    blocks.push(dataUrl);
  }

  if (blocks.length === 0) {
    return message;
  }
  const separator = message.trim().length > 0 ? "\n\n" : "";
  return `${message}${separator}${blocks.join("\n\n")}`;
}

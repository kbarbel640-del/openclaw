import { extractFileContentFromSource, type InputFileLimits } from "../media/input-files.js";
import { detectMime, getFileExtension } from "../media/mime.js";

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

export type ChatDocumentContent = {
  type: "document";
  data: string;
  mimeType: string;
  fileName?: string;
};

export type ChatTextContent = {
  type: "text";
  text: string;
  fileName?: string;
  mimeType: string;
};

export type ParsedMessageWithImages = {
  message: string;
  images: ChatImageContent[];
  /** Document attachments (PDFs, etc.) for OCR/vision processing. */
  documents: ChatDocumentContent[];
  /** Extracted text content from text files. */
  textFiles: ChatTextContent[];
};

type AttachmentLog = {
  warn: (message: string) => void;
  info: (message: string) => void;
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

function isTextMime(mime?: string): boolean {
  if (!mime) return false;
  const m = mime.toLowerCase();
  return (
    m.startsWith("text/") ||
    m === "application/json" ||
    m === "application/xml" ||
    m === "application/javascript"
  );
}

function isDocumentMime(mime?: string): boolean {
  if (!mime) return false;
  const m = mime.toLowerCase();
  return (
    m === "application/pdf" ||
    m.startsWith("application/vnd.") ||
    m === "application/msword" ||
    m === "application/rtf"
  );
}

/**
 * Check if a file extension indicates a text file.
 */
function isTextExtension(ext?: string): boolean {
  if (!ext) return false;
  const e = ext.toLowerCase();
  const textExtensions = new Set([
    ".txt",
    ".md",
    ".markdown",
    ".json",
    ".csv",
    ".tsv",
    ".xml",
    ".yaml",
    ".yml",
    ".toml",
    ".ini",
    ".cfg",
    ".conf",
    ".log",
    ".sql",
    ".html",
    ".htm",
    ".css",
    ".js",
    ".ts",
    ".jsx",
    ".tsx",
    ".py",
    ".rb",
    ".go",
    ".rs",
    ".java",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".sh",
    ".bash",
    ".zsh",
    ".ps1",
    ".env",
    ".gitignore",
    ".dockerignore",
    ".editorconfig",
    ".proto",
    ".graphql",
    ".gql",
  ]);
  return textExtensions.has(e);
}

/**
 * Check if a file extension indicates a PDF document.
 */
function isPdfExtension(ext?: string): boolean {
  if (!ext) return false;
  return ext.toLowerCase() === ".pdf";
}

/**
 * Detect MIME type from base64 content, considering file extension as hint.
 */
async function detectAttachmentMime(
  base64: string,
  providedMime: string | undefined,
  fileName: string | undefined,
): Promise<{ mime: string | undefined; source: "sniffed" | "extension" | "provided" }> {
  // Try sniffing first
  const sniffedMime = normalizeMime(await sniffMimeFromBase64(base64));
  if (sniffedMime) {
    return { mime: sniffedMime, source: "sniffed" };
  }

  // Try extension-based detection
  const ext = getFileExtension(fileName);
  if (ext) {
    // Map common extensions to MIME types
    const extMimeMap: Record<string, string> = {
      ".txt": "text/plain",
      ".md": "text/markdown",
      ".markdown": "text/markdown",
      ".json": "application/json",
      ".csv": "text/csv",
      ".tsv": "text/tab-separated-values",
      ".xml": "application/xml",
      ".yaml": "application/x-yaml",
      ".yml": "application/x-yaml",
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
    };
    const extMime = extMimeMap[ext.toLowerCase()];
    if (extMime) {
      return { mime: extMime, source: "extension" };
    }
  }

  // Fall back to provided MIME
  const normalizedProvided = normalizeMime(providedMime);
  if (normalizedProvided) {
    return { mime: normalizedProvided, source: "provided" };
  }

  return { mime: undefined, source: "provided" };
}

/**
 * Try to decode base64 content as UTF-8 text.
 * Returns the decoded text if valid UTF-8, undefined otherwise.
 */
function tryDecodeAsText(base64: string): string | undefined {
  try {
    const buffer = Buffer.from(base64, "base64");
    const text = buffer.toString("utf-8");
    // Check if it's valid UTF-8 (no replacement characters for binary data)
    // Also check for common binary indicators
    if (text.includes("\uFFFD") || text.includes("\x00")) {
      return undefined;
    }
    return text;
  } catch {
    return undefined;
  }
}

/**
 * Determine the category of an attachment based on its MIME type and extension.
 */
function categorizeAttachment(
  mime: string | undefined,
  fileName: string | undefined,
): {
  category: "image" | "text" | "document" | "unknown";
  extMime: string | undefined;
} {
  const ext = getFileExtension(fileName);

  // Check by MIME type first
  if (mime) {
    if (isImageMime(mime)) {
      return { category: "image", extMime: mime };
    }
    if (isTextMime(mime)) {
      return { category: "text", extMime: mime };
    }
    if (isDocumentMime(mime)) {
      return { category: "document", extMime: mime };
    }
  }

  // Fall back to extension-based categorization
  if (ext) {
    if (isTextExtension(ext)) {
      const extMimeMap: Record<string, string> = {
        ".txt": "text/plain",
        ".md": "text/markdown",
        ".markdown": "text/markdown",
        ".json": "application/json",
        ".csv": "text/csv",
      };
      return { category: "text", extMime: extMimeMap[ext.toLowerCase()] ?? "text/plain" };
    }
    if (isPdfExtension(ext)) {
      return { category: "document", extMime: "application/pdf" };
    }
  }

  return { category: "unknown", extMime: undefined };
}

/**
 * Parse attachments and extract content based on file type.
 *
 * For images: Returns structured content blocks for vision/OCR processing.
 * For text files: Decodes content and includes in the message.
 * For documents (PDFs): Returns structured content blocks for OCR processing.
 */
export async function parseMessageWithAttachments(
  message: string,
  attachments: ChatAttachment[] | undefined,
  opts?: { maxBytes?: number; log?: AttachmentLog },
): Promise<ParsedMessageWithImages> {
  const maxBytes = opts?.maxBytes ?? 5_000_000; // 5 MB
  const log = opts?.log;
  if (!attachments || attachments.length === 0) {
    return { message, images: [], documents: [], textFiles: [] };
  }

  const images: ChatImageContent[] = [];
  const documents: ChatDocumentContent[] = [];
  const textFiles: ChatTextContent[] = [];
  const textParts: string[] = [];

  for (const [idx, att] of attachments.entries()) {
    if (!att) {
      continue;
    }
    const providedMime = att.mimeType ?? "";
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

    // Detect MIME type
    const { mime: detectedMime, source: mimeSource } = await detectAttachmentMime(
      b64,
      providedMime,
      att.fileName,
    );

    // Categorize the attachment
    const { category, extMime } = categorizeAttachment(detectedMime, att.fileName);
    const effectiveMime = detectedMime ?? extMime;

    log?.info(
      `attachment ${label}: detected mime=${detectedMime ?? "unknown"}, source=${mimeSource}, category=${category}`,
    );

    switch (category) {
      case "image": {
        // Handle images - they go to vision/OCR processing
        if (detectedMime && !isImageMime(detectedMime)) {
          log?.warn(
            `attachment ${label}: detected non-image (${detectedMime}), but extension suggests image, using provided`,
          );
        }
        images.push({
          type: "image",
          data: b64,
          mimeType: effectiveMime ?? providedMime ?? "application/octet-stream",
        });
        break;
      }

      case "text": {
        // Handle text files - decode and include in message
        const text = tryDecodeAsText(b64);
        if (text !== undefined) {
          const mimeType = effectiveMime ?? "text/plain";
          textFiles.push({
            type: "text",
            text,
            fileName: att.fileName,
            mimeType,
          });
          // Add to message with file header
          const fileHeader = att.fileName ? `[File: ${att.fileName}]\n` : "";
          textParts.push(`${fileHeader}\`\`\`\n${text}\n\`\`\`\n`);
        } else {
          // Binary data that extension suggested was text - treat as document
          log?.warn(
            `attachment ${label}: extension suggests text but content appears binary, treating as document`,
          );
          documents.push({
            type: "document",
            data: b64,
            mimeType: effectiveMime ?? "application/octet-stream",
            fileName: att.fileName,
          });
        }
        break;
      }

      case "document": {
        // For PDFs, convert to images for vision/OCR processing
        // GLM OCR is a vision model that expects IMAGE input, not raw PDF binary
        if (effectiveMime === "application/pdf") {
          try {
            const result = await extractFileContentFromSource({
              source: {
                type: "base64",
                data: b64,
                mediaType: "application/pdf",
                filename: att.fileName,
              },
              limits: {
                allowUrl: false,
                allowedMimes: new Set(["application/pdf"]),
                maxBytes: maxBytes,
                maxChars: 200000,
                maxRedirects: 3,
                timeoutMs: 10000,
                pdf: {
                  maxPages: 4,
                  maxPixels: 64000000, // 64M pixels - allows higher resolution rendering for GLM OCR
                  minTextChars: 200,
                },
              } as InputFileLimits,
            });

            // Extract images from PDF for vision/OCR processing
            if (result.images && result.images.length > 0) {
              for (const img of result.images) {
                images.push({
                  type: "image",
                  data: img.data,
                  mimeType: img.mimeType,
                });
              }
              log?.info(
                `attachment ${label}: converted PDF to ${result.images.length} image(s) for OCR`,
              );
            }

            // Also include any extracted text
            if (result.text && result.text.trim()) {
              const fileHeader = att.fileName ? `[PDF: ${att.fileName}]\n` : "";
              textParts.push(`${fileHeader}\`\`\`\n${result.text}\n\`\`\`\n`);
            }
          } catch (err) {
            log?.warn(`attachment ${label}: PDF conversion failed, passing as document: ${err}`);
            documents.push({
              type: "document",
              data: b64,
              mimeType: effectiveMime ?? "application/pdf",
              fileName: att.fileName,
            });
          }
        } else {
          // Non-PDF documents go through as-is
          documents.push({
            type: "document",
            data: b64,
            mimeType: effectiveMime ?? "application/octet-stream",
            fileName: att.fileName,
          });
        }
        break;
      }

      case "unknown":
      default: {
        // Try to decode as text as a last resort
        const text = tryDecodeAsText(b64);
        if (text !== undefined && text.length > 0) {
          // It looks like text, include it
          const mimeType = "text/plain";
          textFiles.push({
            type: "text",
            text,
            fileName: att.fileName,
            mimeType,
          });
          const fileHeader = att.fileName ? `[File: ${att.fileName}]\n` : "";
          textParts.push(`${fileHeader}\`\`\`\n${text}\n\`\`\`\n`);
          log?.info(
            `attachment ${label}: unknown mime but content appears to be text, included as text`,
          );
        } else {
          // Can't determine type - log warning and skip
          log?.warn(
            `attachment ${label}: unable to determine file type, skipping. Provide a valid extension or mimeType.`,
          );
        }
        break;
      }
    }
  }

  // Combine message with text file contents
  let finalMessage = message;
  if (textParts.length > 0) {
    const textBlock = textParts.join("\n");
    finalMessage = message.trim().length > 0 ? `${message}\n\n${textBlock}` : textBlock;
  }

  return {
    message: finalMessage,
    images,
    documents,
    textFiles,
  };
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

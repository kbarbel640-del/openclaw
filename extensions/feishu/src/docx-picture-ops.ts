/**
 * Image upload and processing operations for Feishu documents.
 *
 * Handles three image input formats:
 *   - Remote URL (http/https)
 *   - Data URI (data:image/png;base64,...)
 *   - Local file path (absolute, ~, ./, ../)
 *   - Plain base64 string (standard base64; may contain '+', '/', '=')
 *
 * Upload flow (per Feishu FAQ):
 *   1. Create empty image block (block_type: 27)
 *   2. Upload binary via drive.media.uploadAll with parent_node = blockId
 *      and extra.drive_route_token = docToken (required for multi-region routing)
 *   3. Patch block with replace_image.token = file_token
 */

import { homedir } from "os";
import { isAbsolute } from "path";
import type * as Lark from "@larksuiteoapi/node-sdk";
import { getFeishuRuntime } from "./runtime.js";

// ============ Path Helpers ============

/**
 * Detect whether the input string looks like a local file path.
 * Base64 strings can contain '/' (it's part of the alphabet),
 * so we identify paths by their prefix patterns, not by character absence.
 *
 * File paths are short; base64 payloads are typically thousands of chars.
 */
function isFilePath(input: string): boolean {
  if (input.length >= 1024) return false;
  return (
    isAbsolute(input) || // /Users/... or C:\...
    input.startsWith("~") || // ~/Documents/...
    input.startsWith("./") || // ./relative/path
    input.startsWith("../") // ../parent/path
  );
}

/** Expand leading ~ to the OS home directory. */
function resolveFilePath(filePath: string): string {
  if (filePath.startsWith("~/")) return filePath.replace(/^~/, homedir());
  if (filePath === "~") return homedir();
  return filePath;
}

// ============ Core Image Functions ============

/** Extract all http/https image URLs from markdown content. */
export function extractImageUrls(markdown: string): string[] {
  const regex = /!\[[^\]]*\]\(([^)]+)\)/g;
  const urls: string[] = [];
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    const url = match[1].trim();
    if (url.startsWith("http://") || url.startsWith("https://")) {
      urls.push(url);
    }
  }
  return urls;
}

/** Download a remote image via the OpenClaw media fetcher. */
export async function downloadImage(url: string, maxBytes: number): Promise<Buffer> {
  const fetched = await getFeishuRuntime().channel.media.fetchRemoteMedia({ url, maxBytes });
  return fetched.buffer;
}

/**
 * Upload an image buffer to Feishu drive and return the file_token.
 *
 * @param docToken - Optional: document token for multi-region (JP cluster) routing.
 *   Without this, the global drive endpoint cannot route to JP block IDs (doxjp...),
 *   returning "parent node not exist (1061044)".
 */
export async function uploadImageToDocx(
  client: Lark.Client,
  blockId: string,
  imageBuffer: Buffer,
  fileName: string,
  docToken?: string,
): Promise<string> {
  const res = await client.drive.media.uploadAll({
    data: {
      file_name: fileName,
      parent_type: "docx_image",
      parent_node: blockId,
      size: imageBuffer.length,
      // Pass Buffer directly so form-data can calculate Content-Length correctly.
      // Readable.from() produces a stream with unknown length, causing upload failures
      // for larger images (Content-Length mismatch → "Error when parsing request").
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK file type
      file: imageBuffer as any,
      // Required for multi-region routing (e.g. JP cluster): tells the drive service
      // which document the image block belongs to, enabling correct datacenter routing.
      ...(docToken ? { extra: JSON.stringify({ drive_route_token: docToken }) } : {}),
    },
  });

  const fileToken = res?.file_token;
  if (!fileToken) {
    throw new Error("Image upload failed: no file_token returned");
  }
  return fileToken;
}

/**
 * Process inline images in a document after block insertion.
 * Matches markdown image URLs to image blocks (by order) and uploads each.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- SDK block types */
export async function processImages(
  client: Lark.Client,
  docToken: string,
  markdown: string,
  insertedBlocks: any[],
  maxBytes: number,
): Promise<number> {
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const imageUrls = extractImageUrls(markdown);
  if (imageUrls.length === 0) {
    return 0;
  }

  const imageBlocks = insertedBlocks.filter((b) => b.block_type === 27);

  let processed = 0;
  for (let i = 0; i < Math.min(imageUrls.length, imageBlocks.length); i++) {
    const url = imageUrls[i];
    const blockId = imageBlocks[i].block_id;

    try {
      const buffer = await downloadImage(url, maxBytes);
      const urlPath = new URL(url).pathname;
      const fileName = urlPath.split("/").pop() || `image_${i}.png`;
      const fileToken = await uploadImageToDocx(client, blockId, buffer, fileName, docToken);

      await client.docx.documentBlock.patch({
        path: { document_id: docToken, block_id: blockId },
        data: {
          replace_image: { token: fileToken },
        },
      });

      processed++;
    } catch (err) {
      console.error(`Failed to process image ${url}:`, err);
    }
  }

  return processed;
}

/**
 * Upload an image from any supported source and insert it into a document.
 *
 * Supported input formats:
 *   - "https://example.com/photo.jpg"   → remote URL
 *   - "data:image/png;base64,iVBOR..."  → data URI
 *   - "/Users/foo/photo.jpg"            → absolute file path
 *   - "~/Downloads/photo.jpg"           → home-relative path
 *   - "./photo.jpg"                     → relative path
 *   - "iVBORw0KGgoAAAA..."             → plain base64 (standard; may contain '/')
 */
export async function uploadImageAction(
  client: Lark.Client,
  docToken: string,
  imageInput: string,
  fileName?: string,
  insertAfterBlockId?: string,
  mediaMaxBytes?: number,
): Promise<{ success: boolean; block_id: string }> {
  let buffer: Buffer;
  let resolvedFileName = fileName ?? "image.png";

  if (imageInput.startsWith("http://") || imageInput.startsWith("https://")) {
    // Remote URL — download via OpenClaw media fetcher
    buffer = await downloadImage(imageInput, mediaMaxBytes ?? 20 * 1024 * 1024);
    resolvedFileName = fileName ?? imageInput.split("/").pop()?.split("?")[0] ?? "image.jpg";
  } else if (imageInput.startsWith("data:")) {
    // Data URI: data:image/png;base64,xxxx
    const [header, data] = imageInput.split(",");
    const mimeMatch = header.match(/data:([^;]+)/);
    const ext = mimeMatch?.[1]?.split("/")[1] ?? "png";
    resolvedFileName = fileName ?? `image.${ext}`;
    buffer = Buffer.from(data, "base64");
  } else if (isFilePath(imageInput)) {
    // Local file path (absolute, ~, ./ or ../)
    const { readFile } = await import("fs/promises");
    const resolvedPath = resolveFilePath(imageInput);
    buffer = await readFile(resolvedPath);
    resolvedFileName = fileName ?? imageInput.split("/").pop() ?? "image.png";
  } else {
    // Plain base64 string.
    // Note: standard base64 alphabet includes '+', '/', and '=' — do NOT filter on '/'.
    buffer = Buffer.from(imageInput.trim(), "base64");
  }

  // Step 1 (per Feishu FAQ): Create an empty image block
  const insertRes = await client.docx.documentBlockChildren.create({
    path: { document_id: docToken, block_id: insertAfterBlockId ?? docToken },
    params: { document_revision_id: -1 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK type
    data: { children: [{ block_type: 27, image: {} as any }], index: -1 },
  });

  if (insertRes.code !== 0) {
    throw new Error(`Failed to create image block: ${insertRes.msg}`);
  }

  const blockId = insertRes.data?.children?.[0]?.block_id;
  if (!blockId) {
    throw new Error("No block_id returned after creating image block");
  }

  // Step 2 (per Feishu FAQ): Upload image with parent_node = image block ID
  // Pass docToken as drive_route_token for correct multi-region routing
  const fileToken = await uploadImageToDocx(client, blockId, buffer, resolvedFileName, docToken);

  // Step 3 (per Feishu FAQ): Set image token on the block
  const patchRes = await client.docx.documentBlock.patch({
    path: { document_id: docToken, block_id: blockId },
    data: { replace_image: { token: fileToken } },
  });

  if (patchRes.code !== 0) {
    throw new Error(`Failed to set image: ${patchRes.msg}`);
  }

  return { success: true, block_id: blockId };
}

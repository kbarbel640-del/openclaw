/**
 * Knowledge source ingestion orchestrator.
 * Detects source type, extracts content, and saves as Markdown
 * to the OpenClaw memory directory for automatic indexing.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { extractGoogleDoc, extractDocId } from "./sources/gdocs.js";
import { extractPdfFromUrl } from "./sources/pdf.js";
import { extractWebContent } from "./sources/web.js";
import { extractYouTubeTranscript, extractVideoId } from "./sources/youtube.js";

export type SourceType = "web" | "pdf" | "gdocs" | "youtube" | "unknown";

/** Max chars per chunk file. Keeps individual files manageable for memory search indexing. */
const CHUNK_MAX_CHARS = 200_000;

export type IngestResult =
  | {
      source: string;
      sourceType: SourceType;
      title: string;
      filePath: string;
      charCount: number;
      error?: undefined;
    }
  | {
      source: string;
      sourceType: SourceType;
      error: string;
      title?: undefined;
      filePath?: undefined;
      charCount?: undefined;
    };

/** Detect source type from URL */
export function detectSourceType(url: string): SourceType {
  const lower = url.toLowerCase();

  // YouTube
  if (extractVideoId(url)) return "youtube";

  // Google Docs
  if (extractDocId(url)) return "gdocs";

  // PDF (by extension or content-type hint in URL)
  if (lower.endsWith(".pdf") || lower.includes("/pdf/") || lower.includes("format=pdf")) {
    return "pdf";
  }

  // Default: treat as web page
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return "web";
    }
  } catch {
    // not a valid URL
  }

  return "unknown";
}

/** Generate a safe filename from a title */
function safeFilename(title: string, sourceType: SourceType): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  const sanitized = title
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const name = sanitized || sourceType;
  return `${timestamp}-${name}.md`;
}

/** Format extracted content as a Markdown file with metadata header */
function formatAsMarkdown(params: {
  title: string;
  content: string;
  source: string;
  sourceType: SourceType;
  part?: number;
  totalParts?: number;
}): string {
  const partLabel =
    params.part != null && params.totalParts != null && params.totalParts > 1
      ? ` (Part ${params.part}/${params.totalParts})`
      : "";
  const lines: string[] = [
    `# ${params.title}${partLabel}`,
    "",
    `> Source: ${params.source}`,
    `> Type: ${params.sourceType}`,
    ...(partLabel ? [`> Part: ${params.part}/${params.totalParts}`] : []),
    `> Ingested: ${new Date().toISOString()}`,
    "",
    "---",
    "",
    params.content,
    "",
  ];
  return lines.join("\n");
}

/**
 * Split content into chunks at paragraph/heading boundaries.
 * Tries to keep semantic coherence by preferring splits at headings > double newlines > single newlines.
 */
function chunkContent(content: string, maxChars: number = CHUNK_MAX_CHARS): string[] {
  if (content.length <= maxChars) {
    return [content];
  }

  const chunks: string[] = [];
  let remaining = content;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining.trim());
      break;
    }

    // Find the best split point within the max range
    const slice = remaining.slice(0, maxChars);
    let splitAt = -1;

    // Priority 1: Split at a Markdown heading (\n# or \n## etc.)
    const headingMatch = slice.match(/\n(?=#{1,4} )/g);
    if (headingMatch) {
      // Find the last heading boundary
      splitAt = slice.lastIndexOf("\n#");
      // Don't split too early (at least 20% of max)
      if (splitAt < maxChars * 0.2) splitAt = -1;
    }

    // Priority 2: Split at double newline (paragraph boundary)
    if (splitAt === -1) {
      splitAt = slice.lastIndexOf("\n\n");
      if (splitAt < maxChars * 0.2) splitAt = -1;
    }

    // Priority 3: Split at single newline
    if (splitAt === -1) {
      splitAt = slice.lastIndexOf("\n");
      if (splitAt < maxChars * 0.2) splitAt = -1;
    }

    // Fallback: hard split at maxChars
    if (splitAt === -1) {
      splitAt = maxChars;
    }

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  return chunks.filter((c) => c.length > 0);
}

/** Ensure the knowledge directory exists under the memory directory */
async function ensureKnowledgeDir(memoryDir: string): Promise<string> {
  const knowledgeDir = path.join(memoryDir, "knowledge");
  await fs.mkdir(knowledgeDir, { recursive: true });
  return knowledgeDir;
}

/** Ingest a single source URL into the memory directory */
export async function ingestSource(params: {
  url: string;
  memoryDir: string;
  accessToken?: string;
}): Promise<IngestResult> {
  const { url, memoryDir, accessToken } = params;
  const sourceType = detectSourceType(url);

  try {
    let title: string;
    let content: string;

    switch (sourceType) {
      case "youtube": {
        const result = await extractYouTubeTranscript(url);
        title = result.title;
        content = result.content;
        break;
      }
      case "gdocs": {
        const result = await extractGoogleDoc({ url, accessToken });
        title = result.title;
        content = result.content;
        break;
      }
      case "pdf": {
        const result = await extractPdfFromUrl(url);
        title = result.title;
        content = result.content;
        break;
      }
      case "web": {
        const result = await extractWebContent(url, { accessToken });
        title = result.title;
        content = result.content;
        break;
      }
      default:
        throw new Error(`Unsupported source type for URL: ${url}`);
    }

    if (!content.trim()) {
      throw new Error("Extracted content is empty");
    }

    // Split large content into chunks for better memory search indexing
    const chunks = chunkContent(content);
    const knowledgeDir = await ensureKnowledgeDir(memoryDir);
    const savedPaths: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const partSuffix = chunks.length > 1 ? `-part${i + 1}` : "";
      const filename = safeFilename(`${title}${partSuffix}`, sourceType);
      const filePath = path.join(knowledgeDir, filename);

      // Avoid overwriting existing files
      let finalPath = filePath;
      try {
        await fs.access(finalPath);
        const ext = path.extname(filename);
        const base = path.basename(filename, ext);
        finalPath = path.join(knowledgeDir, `${base}-${Date.now()}${ext}`);
      } catch {
        // File doesn't exist, use original path
      }

      const markdown = formatAsMarkdown({
        title,
        content: chunks[i],
        source: url,
        sourceType,
        part: chunks.length > 1 ? i + 1 : undefined,
        totalParts: chunks.length > 1 ? chunks.length : undefined,
      });
      await fs.writeFile(finalPath, markdown, "utf-8");
      savedPaths.push(finalPath);
    }

    return {
      source: url,
      sourceType,
      title,
      filePath: savedPaths[0],
      charCount: content.length,
      ...(chunks.length > 1 ? { parts: chunks.length, files: savedPaths } : {}),
    };
  } catch (err) {
    return {
      source: url,
      sourceType,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Ingest multiple sources in parallel (with concurrency limit) */
export async function ingestSources(params: {
  urls: string[];
  memoryDir: string;
  accessToken?: string;
  concurrency?: number;
}): Promise<IngestResult[]> {
  const { urls, memoryDir, accessToken, concurrency = 3 } = params;
  const results: IngestResult[] = [];
  const queue = [...urls];

  const worker = async () => {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) break;
      const result = await ingestSource({ url, memoryDir, accessToken });
      results.push(result);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

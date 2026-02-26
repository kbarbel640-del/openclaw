import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";
import {
  Box,
  Container,
  getCapabilities,
  Image as PiImage,
  Markdown,
  Spacer,
  Text,
} from "@mariozechner/pi-tui";
import { formatToolDetail, resolveToolDisplay } from "../../agents/tool-display.js";
import { MEDIA_TOKEN_RE } from "../../media/parse.js";
import { markdownTheme, theme } from "../theme/theme.js";
import { sanitizeRenderableText } from "../tui-formatters.js";

type ToolResultContent = {
  type?: string;
  text?: string;
  mimeType?: string;
  bytes?: number;
  omitted?: boolean;
};

type ToolResult = {
  content?: ToolResultContent[];
  details?: Record<string, unknown>;
};

const PREVIEW_LINES = 12;
const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

const ALLOWED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

/** Check if the terminal supports inline image rendering via pi-tui. */
function canRenderInlineImages(): boolean {
  return getCapabilities().images !== null;
}

/**
 * Validate a MEDIA: file path before reading.
 * Rejects null bytes, non-image extensions, non-regular files, and oversized files.
 */
function validateMediaPath(filePath: string): boolean {
  if (filePath.includes("\0")) {
    return false;
  }
  const ext = extname(filePath).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    return false;
  }
  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) {
      return false;
    }
    if (stat.size > MAX_IMAGE_FILE_SIZE || stat.size === 0) {
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

/** Extract local file paths from MEDIA: text lines in a tool result. */
function getMediaPaths(result?: ToolResult): string[] {
  const paths: string[] = [];
  for (const entry of result?.content ?? []) {
    if (entry.type !== "text" || typeof entry.text !== "string") {
      continue;
    }
    // matchAll() internally clones the regex, avoiding lastIndex statefulness.
    // MEDIA_TOKEN_RE handles backticks, whitespace after colon, case-insensitive.
    for (const match of entry.text.matchAll(MEDIA_TOKEN_RE)) {
      // MEDIA_TOKEN_RE's greedy ([^\n]+) captures the trailing backtick when
      // present (the leading backtick is consumed before the capture group).
      // Strip trailing punctuation the same way parse.ts cleanCandidate() does.
      const raw = match[1].replace(/[`"'\\})],]+$/, "").trim();
      if (raw) {
        paths.push(raw);
      }
    }
  }
  return paths;
}

function formatArgs(toolName: string, args: unknown): string {
  const display = resolveToolDisplay({ name: toolName, args });
  const detail = formatToolDetail(display);
  if (detail) {
    return sanitizeRenderableText(detail);
  }
  if (!args || typeof args !== "object") {
    return "";
  }
  try {
    return sanitizeRenderableText(JSON.stringify(args));
  } catch {
    return "";
  }
}

function extractText(result?: ToolResult): string {
  if (!result?.content) {
    return "";
  }
  // Only suppress image placeholders when images will actually render:
  // terminal must support inline images AND at least one MEDIA path must be
  // a valid, accessible image file. This avoids blank output when files are
  // missing (e.g. stale history paths) or the terminal lacks image support.
  const willRenderImages = canRenderInlineImages() && getMediaPaths(result).some(validateMediaPath);
  const lines: string[] = [];
  for (const entry of result.content) {
    if (entry.type === "text" && entry.text) {
      // Filter out MEDIA: path lines (rendered as inline images instead)
      const filtered = entry.text
        .split("\n")
        .filter((line) => !/^MEDIA:.+/.test(line.trim()))
        .join("\n");
      if (filtered.trim()) {
        lines.push(sanitizeRenderableText(filtered));
      }
    } else if (entry.type === "image") {
      // Suppress placeholder only when images will actually render inline.
      if (willRenderImages) {
        continue;
      }
      const mime = entry.mimeType ?? "image";
      const size = entry.bytes ? ` ${Math.round(entry.bytes / 1024)}kb` : "";
      const omitted = entry.omitted ? " (omitted)" : "";
      lines.push(`[${mime}${size}${omitted}]`);
    }
  }
  return lines.join("\n").trim();
}

export class ToolExecutionComponent extends Container {
  private box: Box;
  private header: Text;
  private argsLine: Text;
  private output: Markdown;
  private toolName: string;
  private args: unknown;
  private result?: ToolResult;
  private imageChildren: PiImage[] = [];
  private expanded = false;
  private isError = false;
  private isPartial = true;

  constructor(toolName: string, args: unknown) {
    super();
    this.toolName = toolName;
    this.args = args;
    this.box = new Box(1, 1, (line) => theme.toolPendingBg(line));
    this.header = new Text("", 0, 0);
    this.argsLine = new Text("", 0, 0);
    this.output = new Markdown("", 0, 0, markdownTheme, {
      color: (line) => theme.toolOutput(line),
    });
    this.addChild(new Spacer(1));
    this.addChild(this.box);
    this.box.addChild(this.header);
    this.box.addChild(this.argsLine);
    this.box.addChild(this.output);
    this.refresh();
  }

  setArgs(args: unknown) {
    this.args = args;
    this.refresh();
  }

  setExpanded(expanded: boolean) {
    this.expanded = expanded;
    this.refresh();
  }

  setResult(result: ToolResult | undefined, opts?: { isError?: boolean }) {
    this.result = result;
    this.isPartial = false;
    this.isError = Boolean(opts?.isError);
    this.refresh();
  }

  setPartialResult(result: ToolResult | undefined) {
    this.result = result;
    this.isPartial = true;
    this.refresh();
  }

  private refresh() {
    const bg = this.isPartial
      ? theme.toolPendingBg
      : this.isError
        ? theme.toolErrorBg
        : theme.toolSuccessBg;
    this.box.setBgFn((line) => bg(line));

    const display = resolveToolDisplay({
      name: this.toolName,
      args: this.args,
    });
    const title = `${display.emoji} ${display.label}${this.isPartial ? " (running)" : ""}`;
    this.header.setText(theme.toolTitle(theme.bold(title)));

    const argLine = formatArgs(this.toolName, this.args);
    this.argsLine.setText(argLine ? theme.dim(argLine) : theme.dim(" "));

    const raw = extractText(this.result);
    const text = raw || (this.isPartial ? "…" : "");
    if (!this.expanded && text) {
      const lines = text.split("\n");
      const preview =
        lines.length > PREVIEW_LINES ? `${lines.slice(0, PREVIEW_LINES).join("\n")}\n…` : text;
      this.output.setText(preview);
    } else {
      this.output.setText(text);
    }

    // Render inline images from MEDIA: file paths when terminal supports it
    for (const img of this.imageChildren) {
      this.removeChild(img);
    }
    this.imageChildren = [];
    if (!this.isPartial && canRenderInlineImages()) {
      for (const filePath of getMediaPaths(this.result)) {
        if (!validateMediaPath(filePath)) {
          continue;
        }
        try {
          const buf = readFileSync(filePath);
          const base64 = buf.toString("base64");
          const ext = extname(filePath).slice(1).toLowerCase();
          const mime = MIME_BY_EXT[ext] ?? "image/png";
          const img = new PiImage(
            base64,
            mime,
            { fallbackColor: (s: string) => theme.dim(s) },
            {
              maxWidthCells: 60,
            },
          );
          this.addChild(img);
          this.imageChildren.push(img);
        } catch {
          // File not accessible on this host; text placeholder remains
        }
      }
    }
  }
}

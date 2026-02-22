import { readFileSync } from "node:fs";
import { Box, Container, Image as PiImage, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import { formatToolDetail, resolveToolDisplay } from "../../agents/tool-display.js";
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

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/** Cached terminal image capability detection. */
let _imageSupport: boolean | undefined;
function canRenderInlineImages(): boolean {
  if (_imageSupport === undefined) {
    const term = process.env.TERM ?? "";
    const tp = (process.env.TERM_PROGRAM ?? "").toLowerCase();
    _imageSupport =
      tp === "wezterm" ||
      tp === "ghostty" ||
      tp.includes("iterm") ||
      term === "xterm-kitty" ||
      Boolean(process.env.ITERM_SESSION_ID);
  }
  return _imageSupport;
}

/** Extract local file paths from MEDIA: text lines in a tool result. */
function getMediaPaths(result?: ToolResult): string[] {
  const paths: string[] = [];
  for (const entry of result?.content ?? []) {
    if (entry.type !== "text" || typeof entry.text !== "string") {
      continue;
    }
    for (const line of entry.text.split("\n")) {
      const match = line.trim().match(/^MEDIA:(.+)$/);
      if (match) {
        paths.push(match[1].trim());
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
  const hasMedia = result.content.some(
    (e) => e.type === "text" && typeof e.text === "string" && /^MEDIA:.+/m.test(e.text),
  );
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
      // Suppress placeholder when MEDIA paths provide the actual image
      if (hasMedia) {
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
        try {
          const buf = readFileSync(filePath);
          const base64 = buf.toString("base64");
          const ext = (filePath.split(".").pop() ?? "").toLowerCase();
          const mime = MIME_BY_EXT[ext] ?? "image/png";
          const img = new PiImage(base64, mime, {
            fallbackColor: (s: string) => theme.dim(s),
          });
          this.addChild(img);
          this.imageChildren.push(img);
        } catch {
          // File not accessible on this host; text placeholder remains
        }
      }
    }
  }
}

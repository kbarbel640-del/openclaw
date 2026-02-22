import MarkdownIt from "markdown-it";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MarkdownSegment =
  | { kind: "text"; markdown: string }
  | { kind: "table"; markdown: string; index: number };

// ---------------------------------------------------------------------------
// Parser (shared instance, tables always enabled)
// ---------------------------------------------------------------------------

const md = new MarkdownIt({ html: false, linkify: false, breaks: false, typographer: false });
md.enable("table");

// ---------------------------------------------------------------------------
// Quick heuristic — avoids a full parse when there's obviously no table.
// Matches both piped (`| A | B |`) and pipeless (`A | B`) GFM table rows,
// combined with a separator line (e.g. `---|---` or `|:---|---:|`).
// ---------------------------------------------------------------------------

const PIPE_LINE_RE = /^[|].*[|]|^[^|]+[|]/m;
const SEPARATOR_RE = /^\|?\s*[-:]+[-| :]*\|?\s*$/m;

function mightContainTable(markdown: string): boolean {
  return PIPE_LINE_RE.test(markdown) && SEPARATOR_RE.test(markdown);
}

// ---------------------------------------------------------------------------
// Code-fence unwrapping
// ---------------------------------------------------------------------------

/**
 * LLMs frequently wrap GFM tables in fenced code blocks (``` ... ```).
 * markdown-it correctly parses those as `fence` tokens so our table
 * detector never sees them.  This pre-processor strips the fences around
 * blocks whose content is *exclusively* a valid pipe table (header row +
 * separator + data rows).  Non-table code fences are left untouched.
 */
const FENCED_BLOCK_RE = /^(`{3,})[^\n]*\n([\s\S]*?)\n\1[^\S\n]*$/gm;

function unwrapCodeFencedTables(markdown: string): string {
  return markdown.replace(FENCED_BLOCK_RE, (_match, _ticks: string, inner: string) => {
    const trimmed = inner.trim();
    if (!trimmed) {
      return _match;
    }
    // Quick check: every non-empty line must look like a pipe-table row or separator.
    const lines = trimmed.split("\n");
    if (lines.length < 2) {
      return _match;
    }
    const allPipeLines = lines.every((l) => {
      const s = l.trim();
      return s.includes("|");
    });
    if (!allPipeLines) {
      return _match;
    }
    // Second line must be a separator (---|--- or |:---|---:|)
    if (!SEPARATOR_RE.test(lines[1])) {
      return _match;
    }
    // Looks like a table — unwrap the fences.
    return trimmed;
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Split markdown into ordered text / table segments.
 *
 * Tables inside fenced code blocks are unwrapped first when the fenced
 * content is exclusively a pipe table — a common LLM output pattern.
 */
export function splitMarkdownTables(markdown: string): MarkdownSegment[] {
  if (!markdown) {
    return [];
  }
  // Unwrap code-fenced tables before parsing (LLMs often wrap tables in ```).
  const preprocessed = unwrapCodeFencedTables(markdown);
  if (!mightContainTable(preprocessed)) {
    return [{ kind: "text", markdown }];
  }

  const tokens = md.parse(preprocessed, {});
  const lines = preprocessed.split("\n");

  // Collect [startLine, endLine) ranges for every top-level table.
  const tableRanges: Array<{ start: number; end: number }> = [];
  for (const token of tokens) {
    if (token.type === "table_open" && token.map) {
      tableRanges.push({ start: token.map[0], end: token.map[1] });
    }
  }

  if (tableRanges.length === 0) {
    return [{ kind: "text", markdown }];
  }

  const segments: MarkdownSegment[] = [];
  let currentLine = 0;
  let tableIndex = 0;

  for (const range of tableRanges) {
    // Text before this table
    if (currentLine < range.start) {
      const text = lines.slice(currentLine, range.start).join("\n");
      if (text.trim()) {
        segments.push({ kind: "text", markdown: text });
      }
    }

    // The table itself
    const tableMarkdown = lines.slice(range.start, range.end).join("\n");
    segments.push({ kind: "table", markdown: tableMarkdown, index: tableIndex++ });
    currentLine = range.end;
  }

  // Trailing text after the last table
  if (currentLine < lines.length) {
    const text = lines.slice(currentLine).join("\n");
    if (text.trim()) {
      segments.push({ kind: "text", markdown: text });
    }
  }

  return segments;
}

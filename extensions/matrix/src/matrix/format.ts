import MarkdownIt from "markdown-it";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false,
});

md.enable("strikethrough");

const { escapeHtml } = md.utils;

md.renderer.rules.image = (tokens, idx) => escapeHtml(tokens[idx]?.content ?? "");

md.renderer.rules.html_block = (tokens, idx) => escapeHtml(tokens[idx]?.content ?? "");
md.renderer.rules.html_inline = (tokens, idx) => escapeHtml(tokens[idx]?.content ?? "");

/**
 * Extract LaTeX blocks before markdown rendering to preserve them.
 * After rendering, convert to Matrix `data-mx-maths` format.
 *
 * Detects:
 * - Display math: `$$content$$` → `<div data-mx-maths="content"><code>content</code></div>`
 * - Inline math: `$content$` (single `$`) → `<span data-mx-maths="content"><code>content</code></span>`
 * - LaTeX environments: `\[content\]` (display), `\(content\)` (inline)
 */
function extractAndProtectLatex(markdown: string): {
  markdown: string;
  latexBlocks: Map<string, { type: "display" | "inline"; content: string; raw: string }>;
} {
  const latexBlocks = new Map<string, { type: "display" | "inline"; content: string; raw: string }>();
  let latexIndex = 0;

  let result = markdown;

  // First, protect backtick-quoted regions to avoid extracting LaTeX from code
  const backtickPlaceholders = new Map<string, string>();
  let backtickIndex = 0;
  result = result.replace(/`[^`]+`/g, (match) => {
    const key = `{BACKTICK-${backtickIndex++}}`;
    backtickPlaceholders.set(key, match);
    return key;
  });

  // Extract display math: `$$...$$` (greedy, non-nested)
  result = result.replace(/\$\$((?:[^\$]|\$(?!\$))+)\$\$/g, (match, content) => {
    const key = `{MATHS-DISPLAY-${latexIndex++}}`;
    latexBlocks.set(key, { type: "display", content: content.trim(), raw: match });
    return key;
  });

  // Extract LaTeX display environment: `\[...\]`
  result = result.replace(/\\\[([^\[\]]*)\\\]/g, (match, content) => {
    const key = `{MATHS-DISPLAY-${latexIndex++}}`;
    latexBlocks.set(key, { type: "display", content: content.trim(), raw: match });
    return key;
  });

  // Extract inline math: `$...$` (single $, but not part of $$)
  result = result.replace(/(?<!\$)\$(?!\$)([^\$]+)\$(?!\$)/g, (match, content) => {
    const key = `{MATHS-INLINE-${latexIndex++}}`;
    latexBlocks.set(key, { type: "inline", content: content.trim(), raw: match });
    return key;
  });

  // Extract LaTeX inline environment: `\(...\)`
  result = result.replace(/\\\(([^\(\)]*)\\\)/g, (match, content) => {
    const key = `{MATHS-INLINE-${latexIndex++}}`;
    latexBlocks.set(key, { type: "inline", content: content.trim(), raw: match });
    return key;
  });

  // Restore backtick regions
  for (const [key, html] of backtickPlaceholders.entries()) {
    result = result.replace(key, html);
  }

  return { markdown: result, latexBlocks };
}

/**
 * Restore LaTeX blocks as `data-mx-maths` HTML.
 * Skip restoration inside <code> tags to preserve literal LaTeX in code blocks.
 */
function restoreLatexAsMatrixMaths(
  html: string,
  latexBlocks: Map<string, { type: "display" | "inline"; content: string; raw: string }>,
): string {
  // Temporarily protect code blocks from replacement.
  // Any math placeholders inside code should be restored to their original literal text.
  const codePlaceholders = new Map<string, string>();
  let codeIndex = 0;

  let result = html.replace(/<code[^>]*>.*?<\/code>/gs, (match) => {
    const key = `{CODE-PROTECT-${codeIndex++}}`;
    let literalCode = match;
    for (const [mathKey, block] of latexBlocks.entries()) {
      literalCode = literalCode.replace(mathKey, escapeHtml(block.raw));
    }
    codePlaceholders.set(key, literalCode);
    return key;
  });

  // Restore LaTeX blocks
  for (const [key, block] of latexBlocks.entries()) {
    const escaped = escapeHtml(block.content);
    const mathsHtml =
      block.type === "display"
        ? `<div data-mx-maths="${escaped}"><code>${escaped}</code></div>`
        : `<span data-mx-maths="${escaped}"><code>${escaped}</code></span>`;

    result = result.replace(key, mathsHtml);
  }

  // Restore code blocks
  for (const [key, html] of codePlaceholders.entries()) {
    result = result.replace(key, html);
  }

  return result;
}

export function markdownToMatrixHtml(markdown: string): string {
  const { markdown: protectedMarkdown, latexBlocks } = extractAndProtectLatex(markdown ?? "");
  const rendered = md.render(protectedMarkdown);
  const withMaths = restoreLatexAsMatrixMaths(rendered, latexBlocks);
  return withMaths.trimEnd();
}

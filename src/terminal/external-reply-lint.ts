// Lightweight lint for messages that will end up on chat surfaces.
//
// Goal: catch common formatting pitfalls that make replies hard to read on
// WhatsApp/Signal/Telegram/etc. without blocking sends.

const DEFAULT_MAX_LINES = 18;
const DEFAULT_MAX_LINE_LENGTH = 110;

export function lintExternalReplyText(text: string): string[] {
  const warnings: string[] = [];

  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  const questionMarks = (normalized.match(/\?/g) ?? []).length;
  if (questionMarks > 1) {
    warnings.push(
      `Contains ${questionMarks} question marks. Consider rewriting to 1 question total.`,
    );
  }

  if (normalized.includes("```")) {
    warnings.push(
      "Contains a markdown code fence (```), which often renders poorly on chat surfaces.",
    );
  }

  if (lines.some((l) => l.startsWith("#"))) {
    warnings.push(
      "Contains a markdown heading (#...). Prefer plain labels like 'Outcome:' / 'Next:' instead.",
    );
  }

  const shellLines = lines.filter((l) => l.startsWith("$ ")).length;
  if (shellLines > 3) {
    warnings.push(
      `Contains ${shellLines} command lines ($ ...). Consider trimming to <= 3.`,
    );
  }

  if (lines.length > DEFAULT_MAX_LINES) {
    warnings.push(
      `Message is ${lines.length} lines. Consider trimming to <= ${DEFAULT_MAX_LINES} lines.`,
    );
  }

  const longest = lines.reduce((max, l) => Math.max(max, l.length), 0);
  if (longest > DEFAULT_MAX_LINE_LENGTH) {
    warnings.push(
      `Contains a ${longest}-character line. Consider wrapping to <= ${DEFAULT_MAX_LINE_LENGTH} chars.`,
    );
  }

  return warnings;
}

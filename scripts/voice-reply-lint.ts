#!/usr/bin/env bun
/**
 * voice-reply-lint.ts
 *
 * Lightweight linter for *voice-first* replies (speakable, short, low-jargon).
 *
 * Purpose: catch common things that sound bad in voice output:
 * - links/paths/commands
 * - too long to speak
 * - multiple questions
 * - emojis / markdown formatting
 *
 * Usage:
 *   echo "Done: ..." | bun scripts/voice-reply-lint.ts
 *   bun scripts/voice-reply-lint.ts --file /tmp/voice.txt
 *   bun scripts/voice-reply-lint.ts --json < /tmp/voice.txt
 */

import { readFile } from "node:fs/promises";

type Level = "error" | "warn";

type Issue = {
  level: Level;
  code: string;
  message: string;
};

function usage(): string {
  return [
    "voice-reply-lint: validate a voice-first reply against speakability guardrails",
    "",
    "Usage:",
    "  echo \"Done: ...\" | bun scripts/voice-reply-lint.ts",
    "  bun scripts/voice-reply-lint.ts --file /tmp/voice.txt",
    "",
    "Options:",
    "  --file <path>   Read text from a file instead of stdin",
    "  --json          Emit machine-readable JSON",
    "  --strict        Treat some warnings as errors (length/commands)",
    "  --help          Show this help",
    "",
    "Exit codes:",
    "  0 = OK (no errors)",
    "  1 = Errors found",
    "  2 = Usage / no input",
  ].join("\n");
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseArgs(argv: string[]) {
  const json = argv.includes("--json");
  const strict = argv.includes("--strict");
  const help = argv.includes("--help") || argv.includes("-h");

  const fileIndex = argv.indexOf("--file");
  const file = fileIndex >= 0 ? argv[fileIndex + 1] : undefined;

  return { json, strict, help, file } as const;
}

function countMatches(text: string, re: RegExp): number {
  return [...text.matchAll(re)].length;
}

function firstNonEmptyLine(lines: string[]): string | undefined {
  return lines.find((l) => l.trim().length > 0);
}

function escapeRegExp(s: string): string {
  // Keep this script dependency-free; escape for safe regex construction.
  return s.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesTokenLike(haystack: string, token: string): boolean {
  // Match as a standalone token to reduce false positives (e.g. "session" in "possession").
  // Still allow a simple plural (trailing "s") so we catch "sessions" / "sub-agents".
  const escaped = escapeRegExp(token);
  const maybePlural = token.toLowerCase().endsWith("s") ? "" : "s?";
  const re = new RegExp(`(^|[^a-z0-9])${escaped}${maybePlural}([^a-z0-9]|$)`, "i");
  return re.test(haystack);
}

function findSlashCommands(input: string): string[] {
  // Heuristic: catch /status, /reasoning, etc.
  // Avoid paths like /tmp/... by excluding tokens immediately followed by '/'.
  const hits = [...input.matchAll(/(^|\s)(\/[a-z][a-z0-9_-]{1,})(?!\/)\b/gi)].map(
    (m) => (m[2] ?? "").trim(),
  );
  return [...new Set(hits.filter(Boolean).map((s) => s.toLowerCase()))];
}

const INTERNAL_JARGON = [
  "tool",
  "tools",
  "sandbox",
  "exec",
  "allowlist",
  "session",
  "sub-agent",
  "subagent",
];

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(usage());
  process.exit(0);
}

let text = "";
if (args.file) {
  text = await readFile(args.file, "utf8");
} else {
  text = await readStdin();
}

if (!text.trim()) {
  console.error(usage());
  process.exit(2);
}

text = text.replaceAll("\r\n", "\n");
const lines = text.split("\n");
const nonEmptyLines = lines.filter((l) => l.trim().length > 0);

const issues: Issue[] = [];
const add = (level: Level, code: string, message: string) => {
  issues.push({ level, code, message });
};

// Voice-first replies should be short and spoken-friendly.
const charCount = text.trim().length;
const words = text
  .trim()
  .split(/\s+/)
  .filter((w) => w.length > 0);

// This is intentionally conservative: 10 seconds is roughly 20–35 words for many people.
// We warn early and only error when it’s clearly too long.
const warnWords = 45;
const errWords = 80;

if (words.length > errWords) {
  add(
    "error",
    "too-long-words",
    `Too long for voice: ${words.length} words (target ~<=${warnWords}, hard limit ${errWords}).`,
  );
} else if (words.length > warnWords) {
  add(
    args.strict ? "error" : "warn",
    "long-words",
    `Long for voice: ${words.length} words (target ~<=${warnWords}). Consider trimming.`,
  );
}

const warnChars = 320;
const errChars = 650;
if (charCount > errChars) {
  add(
    "error",
    "too-long-chars",
    `Too long for voice: ${charCount} characters (warn>${warnChars}, hard limit ${errChars}).`,
  );
} else if (charCount > warnChars) {
  add(
    args.strict ? "error" : "warn",
    "long-chars",
    `Long for voice: ${charCount} characters (warn>${warnChars}). Consider trimming.`,
  );
}

// Formatting that tends to sound/behave poorly in voice contexts.
if (lines.some((l) => l.startsWith("#"))) {
  add(
    "error",
    "markdown-heading",
    "A line starts with '#'. Avoid Markdown headings in voice replies.",
  );
}

if (text.includes("```") || text.includes("`")) {
  add(
    "warn",
    "backticks",
    "Contains backticks/code formatting. Prefer plain spoken text.",
  );
}

// Questions: keep to one.
const qCount = countMatches(text, /\?/g);
if (qCount > 1) {
  add(
    "error",
    "too-many-questions",
    `Found ${qCount} question marks ('?'). Voice replies should ask at most one question.`,
  );
}

// URLs: should be avoided in voice replies.
const urls = [...text.matchAll(/https?:\/\/\S+/g)].map((m) => m[0]);
if (urls.length > 0) {
  add(
    "error",
    "contains-url",
    "Contains URL(s). For voice replies, say “I’ll send the link as text” instead.",
  );
}

// File paths / shell-y content: usually not speakable.
// (We keep these as warnings because sometimes it's acceptable in internal voice.)
const pathLike = [
  /\/(Users|tmp|var|etc)\//,
  /~\/[A-Za-z0-9_.-]+\//,
  /\.[A-Za-z0-9_-]+\//, // e.g. .openclaw/
];
if (pathLike.some((re) => re.test(text))) {
  add(
    args.strict ? "error" : "warn",
    "path-like",
    "Contains path-like text (e.g. /tmp, /Users, ~/.). Voice replies should avoid reading paths aloud.",
  );
}

const commandLines = lines.filter((l) => l.trimStart().startsWith("$ "));
if (commandLines.length > 0) {
  add(
    args.strict ? "error" : "warn",
    "contains-commands",
    "Contains command line(s) starting with '$ '. Voice replies should avoid commands; send as text instead.",
  );
}

// Emoji: default is no emoji (often sounds awkward or gets read out).
// \\p{Extended_Pictographic} covers most emoji/pictographs in modern JS engines.
try {
  // eslint-disable-next-line no-control-regex
  const emojiRe = /\p{Extended_Pictographic}/u;
  if (emojiRe.test(text)) {
    add(
      "warn",
      "emoji",
      "Contains emoji/pictographs. Voice replies should usually avoid emoji unless requested.",
    );
  }
} catch {
  // If the runtime doesn't support this (unlikely), skip emoji lint.
}

// IDs / hashes: hard to speak.
if (/(?:\b[0-9a-f]{8,}\b)/i.test(text) || /\b\d{8,}\b/.test(text)) {
  add(
    "warn",
    "long-id",
    "Contains a long ID/hash/number. Consider removing or saying “I’ll send the ID as text.”",
  );
}

// Slash commands: usually not speakable.
const slashCommands = findSlashCommands(text);
if (slashCommands.length > 0) {
  add(
    "warn",
    "slash-command",
    `Contains slash command(s): ${slashCommands.slice(0, 5).join(", ")}${
      slashCommands.length > 5 ? " ..." : ""
    }. Voice replies should avoid slash commands; send as text instead.`,
  );
}

// Internal jargon: avoid in voice-first / user-facing output.
const jargonHits = INTERNAL_JARGON.filter((w) => includesTokenLike(text, w));
if (jargonHits.length > 0) {
  add(
    "warn",
    "internal-jargon",
    `Contains internal jargon (${[...new Set(jargonHits)].join(", ")}). Consider rewriting for end-users.`,
  );
}

// Structure suggestion: lead with Done: (or Outcome:), keep it skimmable.
const firstLine = firstNonEmptyLine(lines);
if (firstLine && !/^(Done|Outcome):\s*/.test(firstLine.trim())) {
  add(
    "warn",
    "missing-done",
    "First non-empty line should usually start with 'Done:' (or 'Outcome:') for a voice-first reply.",
  );
}

// Keep voice reply to a few lines.
if (nonEmptyLines.length > 8) {
  add(
    args.strict ? "error" : "warn",
    "too-many-lines",
    `Has ${nonEmptyLines.length} non-empty lines. Voice replies should usually fit in <= 8 lines.`,
  );
}

const result = { ok: !issues.some((i) => i.level === "error"), issues };

if (args.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  if (result.ok) {
    console.log("OK: no errors found.");
  } else {
    console.log("Errors found:");
  }

  for (const i of issues) {
    const prefix = i.level === "error" ? "ERROR" : "WARN";
    console.log(`- ${prefix} [${i.code}]: ${i.message}`);
  }

  if (issues.length === 0) {
    console.log("(No warnings.)");
  }
}

process.exit(result.ok ? 0 : 1);

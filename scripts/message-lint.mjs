#!/usr/bin/env node

/**
 * scripts/message-lint.mjs (legacy wrapper)
 *
 * This script is kept for backward compatibility, but the canonical implementation
 * now lives in: scripts/external-message-lint.ts (Bun).
 *
 * Why: we previously had multiple message linters that drifted. This wrapper
 * delegates to external-message-lint to keep rules consistent.
 *
 * Usage (legacy):
 *   node scripts/message-lint.mjs --file /path/to/message.txt
 *   node scripts/message-lint.mjs --text "Outcome: ..."
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";

function usage() {
  // Keep stderr output terse + pasteable.
  // (Avoid Markdown headings / fenced code blocks.)
  // eslint-disable-next-line no-console
  console.error(
    "Usage:\n  node scripts/message-lint.mjs --file <path> [--mode external|voice] [--strict]\n  node scripts/message-lint.mjs --text <string> [--mode external|voice] [--strict]",
  );
  process.exit(2);
}

const args = process.argv.slice(2);
let filePath;
let textArg;
let mode = "external";
let strict = false;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--file") {
    filePath = args[i + 1];
    i++;
  } else if (a === "--text") {
    textArg = args[i + 1];
    i++;
  } else if (a === "--mode") {
    mode = String(args[i + 1] ?? "").toLowerCase();
    i++;
  } else if (a === "--strict") {
    strict = true;
  } else if (a === "--help" || a === "-h") {
    usage();
  }
}

if (!filePath && !textArg) {
  usage();
}

if (mode !== "external" && mode !== "voice") {
  // eslint-disable-next-line no-console
  console.error(`message-lint: unknown --mode '${mode}'. Supported: external, voice.`);
  process.exit(2);
}

let msg = "";
if (filePath) {
  if (!fs.existsSync(filePath)) {
    // eslint-disable-next-line no-console
    console.error(`message-lint: file not found: ${filePath}`);
    process.exit(2);
  }
  msg = fs.readFileSync(filePath, "utf8");
} else {
  msg = String(textArg ?? "");
}

const script =
  mode === "voice" ? "scripts/voice-reply-lint.ts" : "scripts/external-message-lint.ts";

const bunArgs = [script, "--json", ...(strict ? ["--strict"] : [])];

// Delegate to the canonical linter.
const proc = spawnSync("bun", bunArgs, {
  input: msg,
  encoding: "utf8",
  maxBuffer: 1024 * 1024,
});

if (proc.error) {
  const prefer =
    mode === "voice"
      ? "  bun scripts/voice-reply-lint.ts\n"
      : "  bun scripts/external-message-lint.ts\n";

  // eslint-disable-next-line no-console
  console.error(
    "message-lint: failed to run Bun. Install Bun or run the canonical linter directly:\n" +
      prefer +
      String(proc.error?.message ?? proc.error),
  );
  process.exit(2);
}

const stdout = String(proc.stdout ?? "").trim();
let parsed;
try {
  parsed = stdout ? JSON.parse(stdout) : undefined;
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(
    "message-lint: could not parse external-message-lint JSON output.\n" +
      "Run directly for diagnostics:\n" +
      "  bun scripts/external-message-lint.ts\n" +
      String(err?.stack ?? err),
  );
  process.exit(2);
}

const issues = Array.isArray(parsed?.issues) ? parsed.issues : [];
if (issues.length === 0) {
  // Legacy behavior.
  // eslint-disable-next-line no-console
  console.log("OK");
  process.exit(0);
}

let hasError = false;
for (const it of issues) {
  const level = String(it?.level ?? "warn");
  const code = String(it?.code ?? "unknown");
  const message = String(it?.message ?? "").trim();
  if (level === "error") hasError = true;
  const prefix = level.toUpperCase();
  // Legacy-ish output: LEVEL: code: message
  // eslint-disable-next-line no-console
  console.log(`${prefix}: ${code}: ${message}`);
}

process.exit(hasError ? 1 : 0);

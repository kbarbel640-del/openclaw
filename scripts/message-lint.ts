#!/usr/bin/env bun
/**
 * OpenClaw message lint (legacy wrapper)
 *
 * This file is kept for backward compatibility. The canonical linter for
 * external-chat guardrails is:
 *   bun scripts/external-message-lint.ts
 *
 * Why: we historically accumulated multiple linters (mjs/ts) that drifted.
 * This wrapper delegates to external-message-lint so rules stay consistent.
 *
 * Run examples:
 *   $ bun scripts/message-lint.ts --file /tmp/msg.txt
 *   $ cat /tmp/msg.txt | bun scripts/message-lint.ts
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function printHelp() {
  process.stdout.write(
    [
      "message-lint (legacy wrapper): delegates to scripts/external-message-lint.ts or scripts/voice-reply-lint.ts",
      "",
      "Usage:",
      "  bun scripts/message-lint.ts [--file path] [--mode external|voice] [--strict]",
      "  cat /tmp/msg.txt | bun scripts/message-lint.ts",
      "",
      "Prefer:",
      "  bun scripts/external-message-lint.ts   (external chat)",
      "  bun scripts/voice-reply-lint.ts        (voice-first)",
      "",
      "Exit codes:",
      "  0 = OK (or warnings only)",
      "  1 = errors found",
      "  2 = usage / wrapper failure",
    ].join("\n") + "\n",
  );
}

async function main() {
  const file = getArg("--file");
  const mode = (getArg("--mode") ?? "external").toLowerCase();

  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp();
    return;
  }

  const strict = hasFlag("--strict");

  if (mode !== "external" && mode !== "voice") {
    process.stderr.write(
      `Unknown --mode '${mode}'. Supported: external, voice.\n`,
    );
    process.exitCode = 2;
    return;
  }

  const text = file ? await fs.readFile(file, "utf8") : await readStdin();
  if (!text.trim()) {
    printHelp();
    process.exitCode = 2;
    return;
  }

  const script =
    mode === "voice" ? "scripts/voice-reply-lint.ts" : "scripts/external-message-lint.ts";

  const bunArgs = [script, "--json", ...(strict ? ["--strict"] : [])];

  const proc = spawnSync("bun", bunArgs, {
    input: text,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });

  const prefer =
    mode === "voice"
      ? "  bun scripts/voice-reply-lint.ts\n"
      : "  bun scripts/external-message-lint.ts\n";

  if (proc.error) {
    process.stderr.write(
      "message-lint: failed to run Bun. Prefer running directly:\n" +
        prefer +
        String(proc.error?.message ?? proc.error) +
        "\n",
    );
    process.exitCode = 2;
    return;
  }

  const stdout = String(proc.stdout ?? "").trim();
  let parsed: unknown;
  try {
    parsed = stdout ? JSON.parse(stdout) : undefined;
  } catch (err) {
    process.stderr.write(
      `message-lint: could not parse linter JSON output from ${script}.\n` +
        String(err?.stack ?? err) +
        "\n",
    );
    process.exitCode = 2;
    return;
  }

  const issues = Array.isArray((parsed as { issues?: unknown })?.issues)
    ? ((parsed as { issues: unknown[] }).issues as { level?: string; message?: string }[])
    : [];

  const errors = issues.filter((i) => i.level === "error");

  if (issues.length === 0) {
    process.stdout.write(
      mode === "voice" ? "OK: message passes voice lint.\n" : "OK: message passes external-chat lint.\n",
    );
    return;
  }

  for (const i of issues) {
    const sev = i.level === "error" ? "error" : "warn";
    process.stdout.write(`[${sev}] ${String(i.message ?? "").trim()}\n`);
  }

  if (errors.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  process.stderr.write(String(err?.stack ?? err) + "\n");
  process.exitCode = 2;
});

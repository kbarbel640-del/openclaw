import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_CONTACTS_LOOKUP_SCRIPT_PATH = path.join(
  os.homedir(),
  "clawd",
  "scripts",
  "contacts_lookup.sh",
);

async function execText(
  command: string,
  args: string[],
  opts?: { timeoutMs?: number; maxBuffer?: number },
): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(command, args, {
      timeout: opts?.timeoutMs ?? 1500,
      encoding: "utf8",
      maxBuffer: opts?.maxBuffer ?? 1024 * 1024,
    });
    return String(stdout ?? "").trim() || null;
  } catch {
    return null;
  }
}

function normalizePhoneCandidates(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  // Best-effort normalization for Contacts substring matching.
  // We try the raw value first, then digits-only (to handle stored numbers like "(253) 370-4422").
  const digitsOnly = trimmed.replace(/\D/g, "");
  const candidates = [trimmed];
  if (digitsOnly && digitsOnly !== trimmed) {
    candidates.push(digitsOnly);
  }
  return Array.from(new Set(candidates));
}

async function lookupViaUserScript(phoneQuery: string): Promise<string | null> {
  const scriptPath = DEFAULT_CONTACTS_LOOKUP_SCRIPT_PATH;
  if (!fs.existsSync(scriptPath)) {
    return null;
  }
  const output = await execText("/usr/bin/env", ["bash", scriptPath, phoneQuery]);
  const resolved = output?.trim() ?? "";
  if (!resolved || resolved === "NOT_FOUND" || resolved.startsWith("ERROR:")) {
    return null;
  }
  return resolved;
}

async function lookupViaInlineAppleScript(phoneQuery: string): Promise<string | null> {
  // Mirrors the behavior of ~/clawd/scripts/contacts_lookup.applescript but keeps it self-contained.
  const script = [
    "on run argv",
    '  if (count of argv) = 0 then return ""',
    "  set q to item 1 of argv",
    '  tell application "Contacts"',
    "    set matches to people whose value of phones contains q",
    '    if (count of matches) is 0 then return ""',
    "    set p to item 1 of matches",
    "    set fn to first name of p",
    "    set ln to last name of p",
    '    if fn is missing value then set fn to ""',
    '    if ln is missing value then set ln to ""',
    '    return (fn & " " & ln)',
    "  end tell",
    "end run",
  ].join("\n");
  const output = await execText("/usr/bin/osascript", ["-e", script, phoneQuery], {
    timeoutMs: 2000,
  });
  const resolved = output?.trim() ?? "";
  return resolved ? resolved : null;
}

export async function resolveContactNameFromPhoneNumber(rawPhone: string): Promise<string | null> {
  if (process.platform !== "darwin") {
    return null;
  }
  const candidates = normalizePhoneCandidates(rawPhone);
  for (const candidate of candidates) {
    const viaScript = await lookupViaUserScript(candidate);
    if (viaScript) {
      return viaScript;
    }
    const viaAppleScript = await lookupViaInlineAppleScript(candidate);
    if (viaAppleScript) {
      return viaAppleScript;
    }
  }
  return null;
}

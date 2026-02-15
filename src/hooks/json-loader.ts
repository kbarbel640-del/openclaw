/**
 * JSON-based hook loader.
 *
 * Reads hooks.json files and parses declarative hook definitions
 * that map events to shell/Python commands.
 *
 * Format:
 * ```json
 * {
 *   "hooks": [
 *     {
 *       "event": "agent:bootstrap",
 *       "matcher": { "agentId": "*" },
 *       "command": "python ~/.openclaw/hooks/validate-context.py",
 *       "timeout": 5000
 *     },
 *     {
 *       "event": "command:new",
 *       "command": "bash ~/.openclaw/hooks/on-new-session.sh"
 *     }
 *   ]
 * }
 * ```
 */

import fs from "node:fs";
import path from "node:path";

export type JsonHookMatcher = {
  /** Glob pattern for matching agent id (e.g., "*", "my-agent"). */
  agentId?: string;
  /** Glob pattern for matching session key. */
  sessionKey?: string;
};

export type JsonHookEntry = {
  /** Event key: "type:action" (e.g., "command:new", "agent:bootstrap"). */
  event: string;
  /** Shell command to execute. */
  command: string;
  /** Optional matcher to filter which events trigger this hook. */
  matcher?: JsonHookMatcher;
  /** Timeout in milliseconds (default: 10000). */
  timeout?: number;
};

export type JsonHooksConfig = {
  hooks: JsonHookEntry[];
};

export type JsonHooksLoadResult =
  | { ok: true; config: JsonHooksConfig; filePath: string }
  | { ok: false; error: string; filePath: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseHookEntry(raw: unknown, index: number): JsonHookEntry | string {
  if (!isRecord(raw)) {
    return `hooks[${index}]: must be an object`;
  }

  const event = typeof raw.event === "string" ? raw.event.trim() : "";
  if (!event) {
    return `hooks[${index}]: "event" is required`;
  }
  if (!event.includes(":")) {
    return `hooks[${index}]: "event" must be in "type:action" format (got "${event}")`;
  }

  const command = typeof raw.command === "string" ? raw.command.trim() : "";
  if (!command) {
    return `hooks[${index}]: "command" is required`;
  }

  const entry: JsonHookEntry = { event, command };

  if (typeof raw.timeout === "number" && raw.timeout > 0) {
    entry.timeout = raw.timeout;
  }

  if (isRecord(raw.matcher)) {
    const matcher: JsonHookMatcher = {};
    if (typeof raw.matcher.agentId === "string") {
      matcher.agentId = raw.matcher.agentId;
    }
    if (typeof raw.matcher.sessionKey === "string") {
      matcher.sessionKey = raw.matcher.sessionKey;
    }
    entry.matcher = matcher;
  }

  return entry;
}

/**
 * Parse a hooks.json file content.
 */
export function parseJsonHooks(content: string, filePath: string): JsonHooksLoadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(content) as unknown;
  } catch (err) {
    return {
      ok: false,
      error: `Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`,
      filePath,
    };
  }

  if (!isRecord(raw)) {
    return { ok: false, error: "hooks.json must be an object", filePath };
  }

  if (!Array.isArray(raw.hooks)) {
    return { ok: false, error: '"hooks" must be an array', filePath };
  }

  const entries: JsonHookEntry[] = [];
  const errors: string[] = [];

  for (let i = 0; i < raw.hooks.length; i++) {
    const result = parseHookEntry(raw.hooks[i], i);
    if (typeof result === "string") {
      errors.push(result);
    } else {
      entries.push(result);
    }
  }

  if (errors.length > 0) {
    return { ok: false, error: errors.join("; "), filePath };
  }

  return { ok: true, config: { hooks: entries }, filePath };
}

/**
 * Load hooks.json from a directory.
 *
 * Looks for `hooks.json` in the given directory.
 */
export function loadJsonHooks(dirPath: string): JsonHooksLoadResult | null {
  const filePath = path.join(dirPath, "hooks.json");
  if (!fs.existsSync(filePath)) {
    return null;
  }

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    return {
      ok: false,
      error: `Failed to read: ${err instanceof Error ? err.message : String(err)}`,
      filePath,
    };
  }

  return parseJsonHooks(content, filePath);
}

/**
 * Load hooks from all standard locations.
 *
 * Looks in:
 * 1. ~/.openclaw/hooks.json (global)
 * 2. .openclaw/hooks.json (workspace-local)
 */
export function loadAllJsonHooks(params: {
  stateDir: string;
  workspaceDir?: string;
}): JsonHookEntry[] {
  const { stateDir, workspaceDir } = params;
  const entries: JsonHookEntry[] = [];

  const globalResult = loadJsonHooks(stateDir);
  if (globalResult?.ok) {
    entries.push(...globalResult.config.hooks);
  }

  if (workspaceDir) {
    const wsDir = path.join(workspaceDir, ".openclaw");
    const wsResult = loadJsonHooks(wsDir);
    if (wsResult?.ok) {
      entries.push(...wsResult.config.hooks);
    }
  }

  return entries;
}

/**
 * Shell/Python hook handler executor.
 *
 * Runs shell commands registered via hooks.json with timeout
 * and environment variable injection for hook context.
 */

import { spawn } from "node:child_process";
import type { InternalHookEvent } from "./internal-hooks.js";
import type { JsonHookEntry, JsonHookMatcher } from "./json-loader.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_OUTPUT_LENGTH = 8192;

export type ShellHookResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
};

/**
 * Check if a hook entry's matcher matches the given event context.
 */
export function matchesEvent(entry: JsonHookEntry, event: InternalHookEvent): boolean {
  const eventKey = `${event.type}:${event.action}`;
  if (entry.event !== eventKey && entry.event !== event.type) {
    return false;
  }

  if (!entry.matcher) {
    return true;
  }

  return matchesMatcher(entry.matcher, event);
}

function matchesMatcher(matcher: JsonHookMatcher, event: InternalHookEvent): boolean {
  const ctx = event.context;

  if (matcher.agentId) {
    const agentId = typeof ctx.agentId === "string" ? ctx.agentId : "";
    if (matcher.agentId !== "*" && matcher.agentId !== agentId) {
      return false;
    }
  }

  if (matcher.sessionKey) {
    if (matcher.sessionKey !== "*" && matcher.sessionKey !== event.sessionKey) {
      return false;
    }
  }

  return true;
}

/**
 * Build environment variables for the hook command.
 *
 * Exposes event context as OPENCLAW_HOOK_* environment variables.
 */
function buildHookEnv(event: InternalHookEvent): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    OPENCLAW_HOOK_TYPE: event.type,
    OPENCLAW_HOOK_ACTION: event.action,
    OPENCLAW_HOOK_SESSION_KEY: event.sessionKey,
    OPENCLAW_HOOK_TIMESTAMP: event.timestamp.toISOString(),
  };

  const ctx = event.context;
  if (typeof ctx.agentId === "string") {
    env.OPENCLAW_HOOK_AGENT_ID = ctx.agentId;
  }
  if (typeof ctx.sessionId === "string") {
    env.OPENCLAW_HOOK_SESSION_ID = ctx.sessionId;
  }
  if (typeof ctx.workspaceDir === "string") {
    env.OPENCLAW_HOOK_WORKSPACE_DIR = ctx.workspaceDir;
  }

  return env;
}

/**
 * Execute a shell hook command with timeout.
 */
export async function runShellHook(
  entry: JsonHookEntry,
  event: InternalHookEvent,
): Promise<ShellHookResult> {
  const timeoutMs = entry.timeout ?? DEFAULT_TIMEOUT_MS;
  const env = buildHookEnv(event);

  return new Promise<ShellHookResult>((resolve) => {
    const shell = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
    const shellArgs = process.platform === "win32" ? ["/c", entry.command] : ["-c", entry.command];

    const child = spawn(shell, shellArgs, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < MAX_OUTPUT_LENGTH) {
        stdout += chunk.toString("utf-8");
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < MAX_OUTPUT_LENGTH) {
        stderr += chunk.toString("utf-8");
      }
    });

    child.on("error", (err) => {
      resolve({
        ok: false,
        stdout: stdout.slice(0, MAX_OUTPUT_LENGTH),
        stderr: `Spawn error: ${err.message}`,
        exitCode: null,
        timedOut: false,
      });
    });

    child.on("close", (code, signal) => {
      if (signal === "SIGTERM" || signal === "SIGKILL") {
        timedOut = true;
      }
      resolve({
        ok: code === 0,
        stdout: stdout.slice(0, MAX_OUTPUT_LENGTH),
        stderr: stderr.slice(0, MAX_OUTPUT_LENGTH),
        exitCode: code,
        timedOut,
      });
    });
  });
}

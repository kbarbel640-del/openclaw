import type { WarelayConfig } from "../config/config.js";
import { danger, logVerbose } from "../globals.js";
import { logDebug, logWarn } from "../logger.js";
import { runCommandWithTimeout, type SpawnResult } from "../process/exec.js";

export type PreHookResult = {
  context?: string;
  durationMs: number;
  error?: string;
  timedOut?: boolean;
};

const DEFAULT_PREHOOK_TIMEOUT_SECONDS = 30;
const MAX_CONTEXT_CHARS = 8000;

export function buildHeartbeatPrompt(
  basePrompt: string,
  preHookContext?: string,
): string {
  if (!preHookContext?.trim()) {
    return basePrompt;
  }
  return `${basePrompt}\n\n---\nContext from pre-hook:\n${preHookContext.trim()}`;
}

function capContextSize(stdout: string): string {
  const trimmed = stdout.trim();
  if (trimmed.length <= MAX_CONTEXT_CHARS) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_CONTEXT_CHARS)}...[truncated]`;
}

export async function runHeartbeatPreHook(
  cfg: WarelayConfig,
  commandRunner: typeof runCommandWithTimeout = runCommandWithTimeout,
): Promise<PreHookResult> {
  const sessionCfg = cfg.inbound?.reply?.session;
  const preHookCommand = sessionCfg?.heartbeatPreHook;

  if (!preHookCommand?.length) {
    return { durationMs: 0 };
  }

  const timeoutSeconds =
    sessionCfg?.heartbeatPreHookTimeoutSeconds ??
    DEFAULT_PREHOOK_TIMEOUT_SECONDS;
  const timeoutMs = timeoutSeconds * 1000;
  const started = Date.now();

  logVerbose(`Running heartbeat pre-hook: ${preHookCommand.join(" ")}`);

  try {
    const result: SpawnResult = await commandRunner(preHookCommand, {
      timeoutMs,
    });
    const durationMs = Date.now() - started;

    if (result.killed || result.signal === "SIGKILL") {
      const stderrPreview = result.stderr?.trim().slice(0, 200) || "(empty)";
      logWarn(`Heartbeat pre-hook timed out after ${timeoutSeconds}s`);
      logDebug(`Pre-hook stderr preview: ${stderrPreview}`);
      return {
        durationMs,
        timedOut: true,
        error: `Pre-hook timed out after ${timeoutSeconds}s`,
      };
    }

    if ((result.code ?? 0) !== 0) {
      const stderrPreview = result.stderr?.trim().slice(0, 200) || "(empty)";
      const errorMsg = `Pre-hook exited with code ${result.code}`;
      logWarn(errorMsg);
      logDebug(`Pre-hook stderr preview: ${stderrPreview}`);
      return {
        durationMs,
        error: errorMsg,
      };
    }

    const stdout = result.stdout?.trim();
    logVerbose(
      `Pre-hook completed in ${durationMs}ms, output length: ${stdout?.length ?? 0}`,
    );

    if (stdout) {
      logDebug(
        `Pre-hook output: ${stdout.slice(0, 200)}${stdout.length > 200 ? "..." : ""}`,
      );
    }

    const cappedContext = stdout ? capContextSize(stdout) : undefined;

    return {
      context: cappedContext || undefined,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - started;
    const anyErr = err as { killed?: boolean; signal?: string };

    if (anyErr.killed || anyErr.signal === "SIGKILL") {
      return {
        durationMs,
        timedOut: true,
        error: `Pre-hook timed out after ${timeoutSeconds}s`,
      };
    }

    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(danger(`Heartbeat pre-hook failed: ${errorMsg}`));

    return {
      durationMs,
      error: errorMsg,
    };
  }
}

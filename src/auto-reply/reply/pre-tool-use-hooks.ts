/**
 * PreToolUse hook execution for tool pipeline.
 *
 * Executes configured shell hooks before tools are executed.
 * Hook stdout is collected and can be injected as additional context.
 * If a hook denies (exit code 2), the tool call is blocked.
 */

import type { OpenClawConfig } from "../../config/config.js";
import { logVerbose } from "../../globals.js";
import { getConfiguredHooks } from "../../hooks/agent-hooks-config.js";
import { executeShellHooksSequential } from "../../hooks/shell-hooks.js";

/**
 * Result of executing PreToolUse hooks.
 */
export type PreToolUseHooksResult = {
  /** Whether hooks denied/blocked the tool call (exit code 2) */
  denied: boolean;
  /** Deny reason if denied (hook stdout) */
  denyReason?: string;
  /** Combined stdout from all hooks (to inject as additional context) */
  hookOutput?: string;
  /** Any errors from hook execution */
  errors: string[];
};

/**
 * Parameters for executing PreToolUse hooks.
 */
export type PreToolUseHooksParams = {
  /** OpenClaw configuration */
  cfg: OpenClawConfig;
  /** Tool name being invoked */
  toolName: string;
  /** Tool input parameters */
  toolInput: unknown;
  /** Session identifier */
  sessionId?: string;
  /** Agent identifier */
  agentId?: string;
  /** Session key */
  sessionKey?: string;
  /** Working directory */
  workspaceDir?: string;
};

/**
 * Execute PreToolUse hooks before a tool is executed.
 *
 * Each hook receives JSON input via stdin:
 * {
 *   tool_name: 'Bash',
 *   tool_input: { command: '...' },
 *   sessionId: '...',
 *   agentId: '...',
 *   sessionKey: '...',
 *   workspaceDir: '...'
 * }
 *
 * Matcher filters hooks by tool name (regex pattern).
 * If any hook exits with code 2, the tool is BLOCKED.
 * Hook stdout can be returned for injection into agent context.
 *
 * @param params - Hook execution parameters
 * @returns Result with hook output, deny status, and errors
 *
 * @example
 * ```ts
 * const result = await executePreToolUseHooks({
 *   cfg,
 *   toolName: 'Bash',
 *   toolInput: { command: 'rm -rf /' },
 *   sessionId: 'abc123',
 *   agentId: 'default',
 *   workspaceDir: '/path/to/workspace',
 * });
 *
 * if (result.denied) {
 *   return { error: result.denyReason || 'Tool blocked by hook' };
 * }
 * ```
 */
export async function executePreToolUseHooks(
  params: PreToolUseHooksParams,
): Promise<PreToolUseHooksResult> {
  const { cfg, toolName, toolInput, sessionId, agentId, sessionKey, workspaceDir } = params;

  // Get configured hooks for PreToolUse event, filtered by tool name
  const hooks = getConfiguredHooks(cfg, "PreToolUse", toolName);

  if (hooks.length === 0) {
    return {
      denied: false,
      errors: [],
    };
  }

  logVerbose(
    `[pre-tool-use-hooks] Executing ${hooks.length} PreToolUse hooks for tool: ${toolName}`,
  );

  // Build input JSON for hooks (Claude Code-style format)
  const hookInput = {
    tool_name: toolName,
    tool_input: toolInput,
    sessionId,
    agentId,
    sessionKey,
    workspaceDir,
  };

  // Extract commands from resolved hooks
  const commands = hooks.map((h) => h.command);

  // Use the first hook's timeout and cwd
  const firstHook = hooks[0];
  const options = {
    timeoutMs: firstHook.timeoutMs,
    cwd: firstHook.cwd ?? workspaceDir,
  };

  // Execute hooks sequentially (stop on first deny)
  const result = await executeShellHooksSequential(commands, hookInput, options);

  // Log result
  if (result.denied) {
    logVerbose(`[pre-tool-use-hooks] Hook blocked tool ${toolName}: ${result.denyReason}`);
  } else if (result.outputs.length > 0) {
    logVerbose(
      `[pre-tool-use-hooks] Collected ${result.outputs.length} hook outputs for ${toolName}`,
    );
  }
  if (result.errors.length > 0) {
    for (const err of result.errors) {
      logVerbose(`[pre-tool-use-hooks] Hook error: ${err}`);
    }
  }

  // Combine all outputs into a single string for context injection
  const hookOutput = result.outputs.length > 0 ? result.outputs.join("\n\n") : undefined;

  return {
    denied: result.denied,
    denyReason: result.denyReason,
    hookOutput,
    errors: result.errors,
  };
}

/**
 * Check if PreToolUse hooks are configured.
 *
 * @param cfg - OpenClaw configuration
 * @returns true if at least one PreToolUse hook is configured
 */
export function hasPreToolUseHooks(cfg: OpenClawConfig | undefined): boolean {
  if (!cfg) return false;
  const hooks = getConfiguredHooks(cfg, "PreToolUse");
  return hooks.length > 0;
}

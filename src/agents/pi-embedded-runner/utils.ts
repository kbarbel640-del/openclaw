import type { ThinkingLevel } from "@mariozechner/pi-agent-core";
import type { ReasoningLevel, ThinkLevel } from "../../auto-reply/thinking.js";
import type { OpenClawConfig } from "../../config/config.js";
import { logVerbose, danger } from "../../globals.js";
import { resolveAgentConfig, resolveSessionAgentIds } from "../agent-scope.js";
import type { ExecToolDefaults } from "../bash-tools.js";

export function mapThinkingLevel(level?: ThinkLevel): ThinkingLevel {
  // pi-agent-core supports "xhigh"; OpenClaw enables it for specific models.
  if (!level) {
    return "off";
  }
  return level;
}

export function resolveExecToolDefaults(config?: OpenClawConfig): ExecToolDefaults | undefined {
  const tools = config?.tools;
  if (!tools?.exec) {
    return undefined;
  }
  return tools.exec;
}

/**
 * Resolve exec tool defaults with per-agent overrides merged over global defaults.
 * 
 * This function is used during session compaction to preserve per-agent exec policy
 * settings (security mode, approval requirements, etc.) that would otherwise be lost.
 * 
 * @param config - OpenClaw configuration object
 * @param sessionKey - Session key to derive agent ID (format: "agent:name:sessionId")
 * @returns Merged exec defaults with per-agent overrides, or empty object if no config
 */
export function resolveAgentExecToolDefaults(
  config?: OpenClawConfig,
  sessionKey?: string,
): ExecToolDefaults {
  if (!config) {
    return {};
  }

  const globalExec = config.tools?.exec;

  if (!sessionKey || typeof sessionKey !== "string" || sessionKey.trim().length === 0) {
    return globalExec ?? {};
  }

  try {
    const resolved = resolveSessionAgentIds({ sessionKey, config });
    
    if (!resolved || !resolved.sessionAgentId) {
      return globalExec ?? {};
    }

    const { sessionAgentId } = resolved;
    const agentConfig = resolveAgentConfig(config, sessionAgentId);
    const agentExec = agentConfig?.tools?.exec;

    const merged: ExecToolDefaults = {
      host: agentExec?.host ?? globalExec?.host,
      security: agentExec?.security ?? globalExec?.security,
      ask: agentExec?.ask ?? globalExec?.ask,
      node: agentExec?.node ?? globalExec?.node,
      pathPrepend: agentExec?.pathPrepend ?? globalExec?.pathPrepend,
      safeBins: agentExec?.safeBins ?? globalExec?.safeBins,
      backgroundMs: agentExec?.backgroundMs ?? globalExec?.backgroundMs,
      timeoutSec: agentExec?.timeoutSec ?? globalExec?.timeoutSec,
      approvalRunningNoticeMs:
        agentExec?.approvalRunningNoticeMs ?? globalExec?.approvalRunningNoticeMs,
      cleanupMs: agentExec?.cleanupMs ?? globalExec?.cleanupMs,
      notifyOnExit: agentExec?.notifyOnExit ?? globalExec?.notifyOnExit,
      elevated: agentExec?.elevated ?? globalExec?.elevated,
      allowBackground: agentExec?.allowBackground ?? globalExec?.allowBackground,
      sandbox: agentExec?.sandbox ?? globalExec?.sandbox,
    };
    
    return merged;
    
  } catch (err) {
    const isExpectedError = err instanceof TypeError;
    
    if (isExpectedError) {
      logVerbose(`Agent config resolution failed, using global defaults`);
      return globalExec ?? {};
    }
    
    danger(`UNEXPECTED ERROR in resolveAgentExecToolDefaults:`, err);
    throw err;
  }
}

export function describeUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    const serialized = JSON.stringify(error);
    return serialized ?? "Unknown error";
  } catch {
    return "Unknown error";
  }
}

export type { ReasoningLevel, ThinkLevel };

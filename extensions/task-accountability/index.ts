/**
 * Task Accountability Plugin
 *
 * Enforces that substantive tool calls require an "unlock" action first.
 * Configurable gate system — not hardcoded to any specific workflow.
 *
 * Example: Require a GitHub issue before file modifications
 * Example: Require Linear ticket before deployments
 * Example: Require approval command before sensitive operations
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

type GateConfig = {
  /** Tools that require the gate to be unlocked before execution */
  gatedTools: string[];
  /** Regex patterns - if matched in prior tool call output, unlocks the gate */
  unlockPatterns: string[];
  /** Regex patterns for tool calls that are always allowed (bypass gate) */
  exemptPatterns: string[];
  /** How long the unlock lasts (ms). Default: until session ends */
  unlockDurationMs?: number;
};

type TaskAccountabilityConfig = {
  /** Enable strict mode - actually block tool calls vs just warn */
  strictMode?: boolean;
  /** Gate configuration */
  gate?: GateConfig;
  /** Custom instructions to inject (false to disable) */
  instructions?: string | false;
  /** Path to custom instructions file */
  instructionsFile?: string;
};

// Default gate config for GitHub workflow
const DEFAULT_GATE: GateConfig = {
  gatedTools: ["exec", "write", "edit", "Write", "Edit"],
  unlockPatterns: [
    // GitHub issue creation output
    "github\\.com/[\\w-]+/[\\w-]+/issues/\\d+",
    // Issue references in commands
    "gh issue create",
    "gh issue view",
    // Issue number patterns
    "#\\d{1,6}",
    "GH-\\d+",
    // Linear-style
    "[A-Z]{2,5}-\\d+",
  ],
  exemptPatterns: [
    // Read-only commands
    "^cat\\s",
    "^ls\\s",
    "^head\\s",
    "^tail\\s",
    "^grep\\s",
    "^find\\s",
    "^wc\\s",
    "^pwd$",
    "^echo\\s",
    "^which\\s",
    "^type\\s",
    // Git read-only
    "^git\\s+(status|log|diff|show|branch|remote|config)",
    // Issue management itself
    "^gh\\s+issue",
    "^gh\\s+pr\\s+(list|view|status)",
    // Session/status checks
    "^openclaw\\s+(status|session|cron\\s+list)",
    // Memory search (read-only)
    "^qmd\\s+(search|query|get|ls|status)",
  ],
};

const DEFAULT_INSTRUCTIONS = `
## Task Accountability Protocol

**MANDATORY:** Substantive work requires creating a tracking issue first.

Before using tools that modify state (write files, run commands that change things):
1. Create an issue: \`gh issue create --repo <repo> --title "..." --body "..." --project "..."\`
2. Reference the issue number in your work
3. Then proceed with the actual work

**Exempt:** Read-only commands, status checks, and issue management itself.

The system will block gated tool calls until an issue is created.
`.trim();

// Session state for tracking unlocks
const sessionUnlocks = new Map<string, { unlockedAt: number; issueRef?: string }>();

function isExempt(command: string, exemptPatterns: string[]): boolean {
  const normalized = command.trim();
  return exemptPatterns.some((pattern) => {
    try {
      return new RegExp(pattern, "i").test(normalized);
    } catch {
      return false;
    }
  });
}

function checkForUnlock(output: string, unlockPatterns: string[]): string | undefined {
  for (const pattern of unlockPatterns) {
    try {
      const match = new RegExp(pattern, "i").exec(output);
      if (match) {
        return match[0];
      }
    } catch {
      // Invalid regex, skip
    }
  }
  return undefined;
}

function isGatedTool(toolName: string, gatedTools: string[]): boolean {
  const normalized = toolName.toLowerCase();
  return gatedTools.some((t) => t.toLowerCase() === normalized);
}

function isUnlocked(sessionKey: string, durationMs?: number): boolean {
  const state = sessionUnlocks.get(sessionKey);
  if (!state) return false;
  if (durationMs && Date.now() - state.unlockedAt > durationMs) {
    sessionUnlocks.delete(sessionKey);
    return false;
  }
  return true;
}

export default function taskAccountabilityPlugin(api: OpenClawPluginApi) {
  const config = (api.pluginConfig ?? {}) as TaskAccountabilityConfig;
  const strictMode = config.strictMode ?? false;
  const gate = config.gate ?? DEFAULT_GATE;
  const instructions =
    config.instructions !== false ? (config.instructions ?? DEFAULT_INSTRUCTIONS) : undefined;

  api.logger.info(`Task accountability enabled (strictMode: ${strictMode})`);

  // Track sessions we've injected instructions into
  const injectedSessions = new Set<string>();

  // Inject instructions at session start
  if (instructions) {
    api.on("before_agent_start", async (_event, ctx) => {
      const sessionKey = ctx.sessionKey ?? "default";

      // Only inject once per session
      if (injectedSessions.has(sessionKey)) {
        return;
      }
      injectedSessions.add(sessionKey);

      return { prependContext: instructions };
    });
  }

  // Monitor tool calls for unlock patterns (after_tool_call)
  api.on("after_tool_call", async (event, ctx) => {
    const sessionKey = ctx.sessionKey ?? "default";

    // Check if the tool output contains an unlock pattern
    const output =
      typeof event.result === "string" ? event.result : JSON.stringify(event.result ?? "");

    // Also check the command itself for exempt patterns that might unlock
    const command = event.params?.command as string | undefined;
    const commandStr = command ?? "";

    const issueRef =
      checkForUnlock(output, gate.unlockPatterns) ??
      checkForUnlock(commandStr, gate.unlockPatterns);

    if (issueRef) {
      sessionUnlocks.set(sessionKey, {
        unlockedAt: Date.now(),
        issueRef,
      });
      api.logger.info(`Session ${sessionKey} unlocked via: ${issueRef}`);
    }
  });

  // Gate tool calls (before_tool_call)
  api.on("before_tool_call", async (event, ctx) => {
    const sessionKey = ctx.sessionKey ?? "default";
    const toolName = event.toolName;

    // Check if this tool is gated
    if (!isGatedTool(toolName, gate.gatedTools)) {
      return; // Not a gated tool, allow
    }

    // For exec, check if the command itself is exempt
    if (toolName.toLowerCase() === "exec") {
      const command = event.params?.command as string | undefined;
      if (command && isExempt(command, gate.exemptPatterns)) {
        return; // Exempt command, allow
      }
    }

    // Check if session is unlocked
    if (isUnlocked(sessionKey, gate.unlockDurationMs)) {
      return; // Unlocked, allow
    }

    // Not unlocked - block or warn
    const reason = `Tool "${toolName}" requires an issue reference first. Create an issue with \`gh issue create\` before proceeding.`;

    if (strictMode) {
      api.logger.warn(`Blocking ${toolName} - no issue reference (session: ${sessionKey})`);
      return {
        block: true,
        blockReason: reason,
      };
    } else {
      // Warn mode - log but don't block
      api.logger.warn(
        `Warning: ${toolName} called without issue reference (session: ${sessionKey})`,
      );
      return;
    }
  });

  // Clean up on session end
  api.on("session_end", async (_event, ctx) => {
    const sessionKey = ctx.sessionId ?? "default";
    sessionUnlocks.delete(sessionKey);
    injectedSessions.delete(sessionKey);
  });
}

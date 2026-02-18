/**
 * AF-001: Tool-call validation to prevent prompt-injection-driven tool misuse.
 * Inspects outgoing tool calls for dangerous patterns before execution.
 */

import type { SecurityAuditFinding } from "./audit.js";

/** Patterns that indicate potential command injection in tool arguments. */
const DANGEROUS_SHELL_PATTERNS: RegExp[] = [
  /;\s*rm\s+-rf/i,
  /;\s*curl\s+.*\|\s*(?:bash|sh)/i,
  /;\s*wget\s+.*\|\s*(?:bash|sh)/i,
  /`[^`]+`/,              // backtick execution
  /\$\([^)]+\)/,          // command substitution
  /&&\s*rm\s/,
  /\|\|\s*rm\s/,
  />\s*\/etc\//,
  />\s*\/proc\//,
  />\s*~\/.(?:bashrc|profile|ssh)/i,
  /eval\s*\(/i,
  /exec\s*\(/i,
  /\/dev\/tcp\//,
  /nc\s+-[el]/i,          // netcat listeners
  /base64\s+.*\|\s*(?:bash|sh)/i,
  /python[23]?\s+-c/i,
  /perl\s+-e/i,
  /ruby\s+-e/i,
  /node\s+-e/i,
];

/** Sensitive path prefixes that tools should not write to. */
const SENSITIVE_PATH_PREFIXES = [
  "/etc/",
  "/proc/",
  "/sys/",
  "/boot/",
  "~/.ssh/",
  "~/.aws/",
  "~/.openclaw/secure",
];

export interface ToolCallRecord {
  toolName: string;
  args: Record<string, unknown>;
  /** ISO timestamp of when the call was made */
  timestamp?: string;
  /** Requesting agent or session ID */
  requesterId?: string;
}

export interface ValidationResult {
  allowed: boolean;
  /** Non-empty if the call is blocked, containing a human-readable reason. */
  reason?: string;
}

/**
 * Validate a tool call's arguments for dangerous patterns.
 * Returns `{ allowed: true }` when safe, or `{ allowed: false, reason }` when blocked.
 *
 * @param tool - The tool name (e.g. "bash", "write_file")
 * @param args - The tool's argument map
 */
export function validateToolCall(tool: string, args: Record<string, unknown>): ValidationResult {
  const argStr = JSON.stringify(args);

  // Check for shell injection patterns in any string argument
  for (const pattern of DANGEROUS_SHELL_PATTERNS) {
    if (pattern.test(argStr)) {
      return {
        allowed: false,
        reason: `Tool call to '${tool}' contains dangerous shell pattern: ${pattern.source}`,
      };
    }
  }

  // Check for writes to sensitive paths
  for (const prefix of SENSITIVE_PATH_PREFIXES) {
    if (argStr.includes(prefix)) {
      return {
        allowed: false,
        reason: `Tool call to '${tool}' targets sensitive path prefix: ${prefix}`,
      };
    }
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Audit findings
// ---------------------------------------------------------------------------

const RECENT_BLOCKED: ToolCallRecord[] = [];
const MAX_BLOCKED_LOG = 100;

/** Record a blocked tool call for audit reporting. */
export function recordBlockedToolCall(record: ToolCallRecord): void {
  RECENT_BLOCKED.unshift({ ...record, timestamp: new Date().toISOString() });
  if (RECENT_BLOCKED.length > MAX_BLOCKED_LOG) RECENT_BLOCKED.pop();
}

/** Collect audit findings related to tool-call validation (AF-001). */
export function collectToolValidatorFindings(): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];

  if (RECENT_BLOCKED.length === 0) {
    findings.push({
      checkId: "AF-001",
      severity: "info",
      title: "Tool-call validator active — no blocked calls recorded",
      detail:
        "All tool calls validated against shell-injection and sensitive-path patterns. No violations detected in this session.",
    });
  } else {
    findings.push({
      checkId: "AF-001",
      severity: "warn",
      title: `Tool-call validator blocked ${RECENT_BLOCKED.length} suspicious call(s)`,
      detail:
        `Recent blocked calls (up to ${MAX_BLOCKED_LOG}): ` +
        RECENT_BLOCKED.slice(0, 5)
          .map((r) => `${r.toolName} @ ${r.timestamp ?? "unknown"}`)
          .join("; "),
      remediation:
        "Review blocked tool calls for adversarial prompt injection attempts. " +
        "Consider tightening dmScope or user-allowlists.",
    });
  }

  return findings;
}

/**
 * SHARPS EDGE - Structured Audit Logger
 *
 * Append-only audit trail for all significant actions.
 * Phase 2: Session lifecycle hooks, decision categorization, redaction.
 */

import fs from "node:fs/promises";
import path from "node:path";

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

import { type AuditLogEntry, Severity, type SharpsEdgeConfig } from "./types.js";

export type AuditLogType = "conflicts" | "errors" | "decisions" | "alerts";

export class AuditLogger {
  private workspaceDir: string;

  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
  }

  async log(type: AuditLogType, entry: AuditLogEntry): Promise<void> {
    const dir = path.join(this.workspaceDir, "logs", type);
    await fs.mkdir(dir, { recursive: true });

    const date = entry.timestamp.slice(0, 10);
    const filename = path.join(dir, `${date}.md`);
    const time = entry.timestamp.slice(11, 19);

    const lines = [
      "",
      `## ${time} | ${entry.severity} | ${entry.projectId}`,
      `**Event:** ${entry.event}`,
      `**Action:** ${entry.action}`,
      `**Outcome:** ${entry.outcome}`,
    ];

    if (entry.outcome !== "pass" && entry.details.reason) {
      lines.push(`**Reason:** ${String(entry.details.reason)}`);
    }

    // Add details, filtering out already-shown reason
    const extraDetails = { ...entry.details };
    delete extraDetails.reason;
    if (Object.keys(extraDetails).length > 0) {
      lines.push(`**Details:** ${JSON.stringify(redactSensitive(extraDetails))}`);
    }

    lines.push("");

    await fs.appendFile(filename, lines.join("\n"), "utf-8");
  }

  async logConflict(
    projectId: string,
    action: string,
    check: string,
    reason: string,
    severity: Severity,
  ): Promise<void> {
    await this.log("conflicts", {
      timestamp: new Date().toISOString(),
      severity,
      projectId,
      event: "conflict_detected",
      action,
      details: { check, reason },
      outcome: severity === Severity.BLOCK ? "blocked" : "rejected",
    });
  }

  async logToolCall(
    projectId: string,
    toolName: string,
    params: Record<string, unknown>,
    outcome: "completed" | "failed" | "blocked",
    details: Record<string, unknown> = {},
  ): Promise<void> {
    await this.log(outcome === "failed" ? "errors" : "decisions", {
      timestamp: new Date().toISOString(),
      severity: outcome === "failed" ? Severity.WARN : Severity.INFO,
      projectId,
      event: "tool_call",
      action: toolName,
      details: { params: summarizeParams(params), ...details },
      outcome,
    });
  }

  async logAlert(
    projectId: string,
    severity: Severity,
    message: string,
  ): Promise<void> {
    await this.log("alerts", {
      timestamp: new Date().toISOString(),
      severity,
      projectId,
      event: "alert_sent",
      action: message,
      details: {},
      outcome: "completed",
    });
  }

  async logSessionEvent(
    projectId: string,
    event: "session_start" | "session_end",
    details: Record<string, unknown> = {},
  ): Promise<void> {
    await this.log("decisions", {
      timestamp: new Date().toISOString(),
      severity: Severity.INFO,
      projectId,
      event,
      action: event,
      details,
      outcome: "completed",
    });
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Summarize tool params for logging. Truncate long values, redact secrets.
 */
function summarizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length > 200) {
      summary[key] = value.slice(0, 200) + "...[truncated]";
    } else {
      summary[key] = value;
    }
  }
  return redactSensitive(summary);
}

/**
 * Redact values that look like secrets.
 */
function redactSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = /key|token|secret|password|credential|auth/i;
  const sensitiveValues = /^(sk-|ghp_|ghs_|xox[bpsa]-|Bearer\s|Basic\s)/;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.test(key) && typeof value === "string") {
      result[key] = "[REDACTED]";
    } else if (typeof value === "string" && sensitiveValues.test(value)) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ============================================================================
// Registration
// ============================================================================

export function registerAuditLogger(
  api: OpenClawPluginApi,
  _cfg: SharpsEdgeConfig,
): AuditLogger {
  const workspaceDir = api.resolvePath("~/.openclaw/workspace");
  const logger = new AuditLogger(workspaceDir);

  // Log all tool calls (after execution)
  api.on("after_tool_call", async (event, ctx) => {
    const projectId = ctx.agentId ?? "UNKNOWN";
    try {
      await logger.logToolCall(
        projectId,
        event.toolName,
        event.params,
        event.error ? "failed" : "completed",
        event.error
          ? { error: event.error, durationMs: event.durationMs }
          : { durationMs: event.durationMs },
      );
    } catch { /* never crash the pipeline */ }
  });

  // Log inbound messages
  api.on("message_received", async (event, _ctx) => {
    try {
      await logger.log("decisions", {
        timestamp: new Date().toISOString(),
        severity: Severity.INFO,
        projectId: "SYSTEM",
        event: "message_received",
        action: `from:${event.from}`,
        details: { contentLength: event.content?.length ?? 0 },
        outcome: "completed",
      });
    } catch { /* silent */ }
  });

  // Log session lifecycle
  api.on("session_start", async (event, ctx) => {
    try {
      await logger.logSessionEvent(ctx.agentId ?? "UNKNOWN", "session_start", {
        sessionId: event.sessionId,
        resumedFrom: event.resumedFrom,
      });
    } catch { /* silent */ }
  });

  api.on("session_end", async (event, ctx) => {
    try {
      await logger.logSessionEvent(ctx.agentId ?? "UNKNOWN", "session_end", {
        sessionId: event.sessionId,
        messageCount: event.messageCount,
        durationMs: event.durationMs,
      });
    } catch { /* silent */ }
  });

  return logger;
}

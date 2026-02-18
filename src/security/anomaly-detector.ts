/**
 * EO-002: Runtime behavior anomaly detection.
 * Tracks per-session metrics and emits findings when values exceed baselines.
 */

import type { SecurityAuditFinding } from "./audit.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionMetrics {
  sessionId: string;
  toolCallCount: number;
  externalFetchCount: number;
  blockedCallCount: number;
  tokensSent: number;
  tokensReceived: number;
  startedAt: number; // Date.now()
  lastActivityAt: number;
}

// ---------------------------------------------------------------------------
// Baseline thresholds (conservative defaults)
// ---------------------------------------------------------------------------

const THRESHOLDS = {
  /** Max tool calls per session before flagging. */
  maxToolCallsPerSession: 500,
  /** Max external HTTP fetches per session. */
  maxExternalFetchesPerSession: 200,
  /** Max blocked calls before escalating to critical. */
  maxBlockedCallsPerSession: 5,
  /** Max tokens sent in a single session (≈ 10 M). */
  maxTokensSentPerSession: 10_000_000,
  /** Session idle timeout in ms before metrics are pruned (1 hour). */
  sessionIdleTimeoutMs: 60 * 60 * 1_000,
};

// ---------------------------------------------------------------------------
// In-memory metrics registry
// ---------------------------------------------------------------------------

const registry = new Map<string, SessionMetrics>();

/** Get or create metrics for a session. */
export function getSessionMetrics(sessionId: string): SessionMetrics {
  if (!registry.has(sessionId)) {
    registry.set(sessionId, {
      sessionId,
      toolCallCount: 0,
      externalFetchCount: 0,
      blockedCallCount: 0,
      tokensSent: 0,
      tokensReceived: 0,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    });
  }
  return registry.get(sessionId)!;
}

/** Increment a numeric metric for a session. */
export function recordMetric(
  sessionId: string,
  field: keyof Omit<SessionMetrics, "sessionId" | "startedAt" | "lastActivityAt">,
  delta = 1,
): void {
  const m = getSessionMetrics(sessionId);
  (m[field] as number) += delta;
  m.lastActivityAt = Date.now();
}

/** Prune sessions that have been idle beyond the timeout. */
export function pruneIdleSessions(): void {
  const now = Date.now();
  for (const [id, m] of registry) {
    if (now - m.lastActivityAt > THRESHOLDS.sessionIdleTimeoutMs) {
      registry.delete(id);
    }
  }
}

// ---------------------------------------------------------------------------
// Anomaly evaluation
// ---------------------------------------------------------------------------

export interface AnomalyEvent {
  sessionId: string;
  field: string;
  value: number;
  threshold: number;
  severity: "warn" | "critical";
  detectedAt: string;
}

const anomalyLog: AnomalyEvent[] = [];
const MAX_ANOMALY_LOG = 200;

/** Evaluate all live sessions against thresholds and record anomalies. */
export function evaluateAnomalies(): AnomalyEvent[] {
  const detected: AnomalyEvent[] = [];

  for (const m of registry.values()) {
    const checks: Array<{
      field: string;
      value: number;
      threshold: number;
      severity: "warn" | "critical";
    }> = [
      {
        field: "toolCallCount",
        value: m.toolCallCount,
        threshold: THRESHOLDS.maxToolCallsPerSession,
        severity: "warn",
      },
      {
        field: "externalFetchCount",
        value: m.externalFetchCount,
        threshold: THRESHOLDS.maxExternalFetchesPerSession,
        severity: "warn",
      },
      {
        field: "blockedCallCount",
        value: m.blockedCallCount,
        threshold: THRESHOLDS.maxBlockedCallsPerSession,
        severity: "critical",
      },
      {
        field: "tokensSent",
        value: m.tokensSent,
        threshold: THRESHOLDS.maxTokensSentPerSession,
        severity: "warn",
      },
    ];

    for (const check of checks) {
      if (check.value > check.threshold) {
        const event: AnomalyEvent = {
          sessionId: m.sessionId,
          field: check.field,
          value: check.value,
          threshold: check.threshold,
          severity: check.severity,
          detectedAt: new Date().toISOString(),
        };
        detected.push(event);
        anomalyLog.unshift(event);
        if (anomalyLog.length > MAX_ANOMALY_LOG) anomalyLog.pop();
      }
    }
  }

  return detected;
}

/** Return all anomaly events logged in this process. */
export function getAnomalyLog(): readonly AnomalyEvent[] {
  return anomalyLog;
}

// ---------------------------------------------------------------------------
// Audit findings
// ---------------------------------------------------------------------------

/** Collect audit findings related to anomaly detection (EO-002). */
export function collectAnomalyDetectorFindings(): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];

  pruneIdleSessions();
  const recentAnomalies = evaluateAnomalies();
  const criticals = recentAnomalies.filter((a) => a.severity === "critical");
  const warns = recentAnomalies.filter((a) => a.severity === "warn");

  if (criticals.length > 0) {
    findings.push({
      checkId: "EO-002",
      severity: "critical",
      title: `Anomaly detector: ${criticals.length} critical threshold(s) breached`,
      detail: criticals
        .slice(0, 5)
        .map(
          (a) =>
            `Session ${a.sessionId}: ${a.field}=${a.value} > threshold=${a.threshold}`,
        )
        .join("; "),
      remediation:
        "Investigate session(s) for runaway tool-call loops or adversarial prompt injection. " +
        "Consider terminating affected sessions.",
    });
  }

  if (warns.length > 0) {
    findings.push({
      checkId: "EO-002",
      severity: "warn",
      title: `Anomaly detector: ${warns.length} warning threshold(s) breached`,
      detail: warns
        .slice(0, 5)
        .map(
          (a) =>
            `Session ${a.sessionId}: ${a.field}=${a.value} > threshold=${a.threshold}`,
        )
        .join("; "),
      remediation:
        "Review high-activity sessions. Adjust THRESHOLDS in anomaly-detector.ts if legitimate.",
    });
  }

  if (criticals.length === 0 && warns.length === 0) {
    findings.push({
      checkId: "EO-002",
      severity: "info",
      title: "Runtime anomaly detection active — all sessions within thresholds",
      detail: `Monitoring ${registry.size} active session(s). All metrics within configured thresholds.`,
    });
  }

  return findings;
}

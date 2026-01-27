/**
 * Persistent audit logging for enterprise compliance and debugging.
 *
 * Audit events are written to a JSONL file at ~/.clawdbot/audit.jsonl
 * with automatic daily rotation (keeps 7 days of history).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveStateDir } from "../config/paths.js";
import { getCurrentTraceId } from "../observability/trace-context.js";

/** Audit event types for different security-relevant actions. */
export type AuditEventType =
  | "auth.login"
  | "auth.logout"
  | "auth.failure"
  | "pairing.request"
  | "pairing.approve"
  | "pairing.reject"
  | "pairing.revoke"
  | "exec.request"
  | "exec.approve"
  | "exec.reject"
  | "config.change"
  | "gateway.start"
  | "gateway.stop"
  | "rbac.denied"
  | "session.create"
  | "session.destroy";

/** Actor who performed the action. */
export type AuditActor = {
  type: "user" | "system" | "agent" | "device";
  id: string;
  channel?: string;
  deviceId?: string;
  remoteIp?: string;
};

/** Target of the action (optional). */
export type AuditTarget = {
  type: string;
  id: string;
  [key: string]: unknown;
};

/** Outcome of the action. */
export type AuditOutcome = "success" | "failure" | "denied";

/** Full audit log entry structure. */
export type AuditLogEntry = {
  /** ISO timestamp of the event. */
  ts: string;
  /** Unique event ID. */
  eventId: string;
  /** Type of audit event. */
  type: AuditEventType;
  /** Who performed the action. */
  actor: AuditActor;
  /** What was affected (optional). */
  target?: AuditTarget;
  /** Result of the action. */
  outcome: AuditOutcome;
  /** Trace ID for distributed tracing correlation. */
  traceId?: string;
  /** Additional metadata. */
  metadata?: Record<string, unknown>;
};

/** Input for creating an audit event (without auto-generated fields). */
export type AuditEventInput = Omit<AuditLogEntry, "ts" | "eventId" | "traceId">;

/** Configuration for the audit logger. */
export type AuditLogConfig = {
  /** Enable audit logging (default: true). */
  enabled?: boolean;
  /** Base directory for audit logs (default: ~/.clawdbot). */
  baseDir?: string;
  /** Number of days to keep audit logs (default: 7). */
  retentionDays?: number;
};

const DEFAULT_RETENTION_DAYS = 7;
const AUDIT_FILENAME = "audit.jsonl";

let writeQueue: Promise<void> = Promise.resolve();

function resolveAuditPaths(baseDir?: string) {
  const root = baseDir ?? resolveStateDir();
  return {
    dir: root,
    currentPath: path.join(root, AUDIT_FILENAME),
  };
}

function getDateSuffix(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function getArchivePath(basePath: string, date: Date): string {
  const suffix = getDateSuffix(date);
  return basePath.replace(/\.jsonl$/, `.${suffix}.jsonl`);
}

/**
 * Append an audit entry to the log file atomically.
 */
async function appendAuditEntry(entry: AuditLogEntry, baseDir?: string): Promise<void> {
  const { dir, currentPath } = resolveAuditPaths(baseDir);

  // Ensure directory exists
  await fs.mkdir(dir, { recursive: true });

  // Serialize entry
  const line = JSON.stringify(entry) + "\n";

  // Append to file (create if doesn't exist)
  await fs.appendFile(currentPath, line, { encoding: "utf8", mode: 0o600 });
}

/**
 * Rotate old audit log files based on date.
 * Called periodically to archive yesterday's logs and clean up old files.
 */
export async function rotateAuditLogs(config?: AuditLogConfig): Promise<void> {
  const { dir, currentPath } = resolveAuditPaths(config?.baseDir);
  const retentionDays = config?.retentionDays ?? DEFAULT_RETENTION_DAYS;

  try {
    // Ensure directory exists before listing
    await fs.mkdir(dir, { recursive: true }).catch(() => undefined);

    // List all audit files
    const files = await fs.readdir(dir).catch(() => [] as string[]);
    const auditFiles = files.filter((f) => f.startsWith("audit.") && f.endsWith(".jsonl"));

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffStr = getDateSuffix(cutoffDate);

    // Delete files older than retention period
    for (const file of auditFiles) {
      const match = file.match(/audit\.(\d{4}-\d{2}-\d{2})\.jsonl/);
      if (match && match[1] < cutoffStr) {
        const filePath = path.join(dir, file);
        await fs.unlink(filePath).catch(() => undefined);
      }
    }

    // Archive current log if it's from a previous day
    const todayStr = getDateSuffix();
    const stats = await fs.stat(currentPath).catch(() => null);
    if (!stats) return; // No current log to archive

    const content = await fs.readFile(currentPath, "utf8").catch(() => "");
    if (!content.trim()) return;

    const lines = content.trim().split("\n");
    const firstLine = lines[0];
    if (!firstLine) return;

    try {
      const firstEntry = JSON.parse(firstLine) as { ts?: string };
      const firstTs = firstEntry.ts;
      if (firstTs && firstTs.slice(0, 10) < todayStr) {
        // Archive the old log
        const archiveDate = new Date(firstTs);
        const archivePath = getArchivePath(currentPath, archiveDate);
        await fs.rename(currentPath, archivePath).catch(() => undefined);
      }
    } catch {
      // Ignore parse errors, keep the file
    }
  } catch {
    // Rotation is best-effort
  }
}

/**
 * Queue an audit write to ensure sequential writes.
 */
function queueAuditWrite<T>(fn: () => Promise<T>): Promise<T> {
  const prev = writeQueue;
  let release: (() => void) | undefined;
  writeQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  return prev.then(fn).finally(() => release?.());
}

// Global state
let auditConfig: AuditLogConfig | null = null;
let rotationInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Initialize the audit logger with configuration.
 * Should be called at gateway startup.
 */
export function initAuditLog(config?: AuditLogConfig): void {
  auditConfig = config ?? { enabled: true };

  if (auditConfig.enabled === false) return;

  // Run rotation on startup
  void rotateAuditLogs(auditConfig);

  // Schedule daily rotation (check every hour)
  if (rotationInterval) {
    clearInterval(rotationInterval);
  }
  rotationInterval = setInterval(
    () => {
      void rotateAuditLogs(auditConfig ?? undefined);
    },
    60 * 60 * 1000,
  ); // Every hour
}

/**
 * Stop the audit logger (e.g., on gateway shutdown).
 */
export function stopAuditLog(): void {
  if (rotationInterval) {
    clearInterval(rotationInterval);
    rotationInterval = null;
  }
}

/**
 * Emit an audit event.
 * This is the main API for logging audit events.
 */
export function emitAuditEvent(event: AuditEventInput): void {
  if (auditConfig?.enabled === false) return;

  const traceId = getCurrentTraceId();
  const entry: AuditLogEntry = {
    ...event,
    ts: new Date().toISOString(),
    eventId: randomUUID(),
    ...(traceId !== "no-trace" ? { traceId } : {}),
  };

  // Queue the write (fire and forget, but sequential)
  void queueAuditWrite(() => appendAuditEntry(entry, auditConfig?.baseDir));
}

/**
 * Convenience functions for common audit events.
 */

export function auditAuthLogin(params: {
  actor: AuditActor;
  method?: string;
  outcome?: AuditOutcome;
}): void {
  emitAuditEvent({
    type: "auth.login",
    actor: params.actor,
    outcome: params.outcome ?? "success",
    metadata: params.method ? { method: params.method } : undefined,
  });
}

export function auditAuthFailure(params: { actor: AuditActor; reason: string }): void {
  emitAuditEvent({
    type: "auth.failure",
    actor: params.actor,
    outcome: "failure",
    metadata: { reason: params.reason },
  });
}

export function auditPairingRequest(params: { actor: AuditActor; target: AuditTarget }): void {
  emitAuditEvent({
    type: "pairing.request",
    actor: params.actor,
    target: params.target,
    outcome: "success",
  });
}

export function auditPairingApprove(params: { actor: AuditActor; target: AuditTarget }): void {
  emitAuditEvent({
    type: "pairing.approve",
    actor: params.actor,
    target: params.target,
    outcome: "success",
  });
}

export function auditPairingReject(params: {
  actor: AuditActor;
  target: AuditTarget;
  reason?: string;
}): void {
  emitAuditEvent({
    type: "pairing.reject",
    actor: params.actor,
    target: params.target,
    outcome: "denied",
    metadata: params.reason ? { reason: params.reason } : undefined,
  });
}

export function auditExecRequest(params: {
  actor: AuditActor;
  target: AuditTarget;
  command: string;
}): void {
  emitAuditEvent({
    type: "exec.request",
    actor: params.actor,
    target: params.target,
    outcome: "success",
    metadata: { command: params.command },
  });
}

export function auditExecApprove(params: {
  actor: AuditActor;
  target: AuditTarget;
  command: string;
}): void {
  emitAuditEvent({
    type: "exec.approve",
    actor: params.actor,
    target: params.target,
    outcome: "success",
    metadata: { command: params.command },
  });
}

export function auditExecReject(params: {
  actor: AuditActor;
  target: AuditTarget;
  command: string;
  reason?: string;
}): void {
  emitAuditEvent({
    type: "exec.reject",
    actor: params.actor,
    target: params.target,
    outcome: "denied",
    metadata: { command: params.command, ...(params.reason ? { reason: params.reason } : {}) },
  });
}

export function auditConfigChange(params: {
  actor: AuditActor;
  changes: Record<string, unknown>;
}): void {
  emitAuditEvent({
    type: "config.change",
    actor: params.actor,
    outcome: "success",
    metadata: { changes: params.changes },
  });
}

export function auditGatewayStart(params: {
  actor: AuditActor;
  metadata?: Record<string, unknown>;
}): void {
  emitAuditEvent({
    type: "gateway.start",
    actor: params.actor,
    outcome: "success",
    metadata: params.metadata,
  });
}

export function auditGatewayStop(params: { actor: AuditActor; reason?: string }): void {
  emitAuditEvent({
    type: "gateway.stop",
    actor: params.actor,
    outcome: "success",
    metadata: params.reason ? { reason: params.reason } : undefined,
  });
}

export function auditRbacDenied(params: {
  actor: AuditActor;
  action: string;
  resource?: string;
  reason?: string;
}): void {
  emitAuditEvent({
    type: "rbac.denied",
    actor: params.actor,
    outcome: "denied",
    metadata: {
      action: params.action,
      ...(params.resource ? { resource: params.resource } : {}),
      ...(params.reason ? { reason: params.reason } : {}),
    },
  });
}

/**
 * Read recent audit entries (for debugging/testing).
 * Returns entries from most recent first.
 */
export async function readRecentAuditEntries(
  limit: number = 100,
  config?: AuditLogConfig,
): Promise<AuditLogEntry[]> {
  const { currentPath } = resolveAuditPaths(config?.baseDir);

  try {
    const content = await fs.readFile(currentPath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);
    const entries: AuditLogEntry[] = [];

    // Read from end (most recent)
    for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
      try {
        entries.push(JSON.parse(lines[i]) as AuditLogEntry);
      } catch {
        // Skip malformed lines
      }
    }

    return entries;
  } catch {
    return [];
  }
}

/**
 * Query audit entries by type (for debugging/testing).
 */
export async function queryAuditEntries(
  filter: { type?: AuditEventType; actor?: string; outcome?: AuditOutcome },
  limit: number = 100,
  config?: AuditLogConfig,
): Promise<AuditLogEntry[]> {
  const entries = await readRecentAuditEntries(limit * 10, config);

  return entries
    .filter((entry) => {
      if (filter.type && entry.type !== filter.type) return false;
      if (filter.actor && entry.actor.id !== filter.actor) return false;
      if (filter.outcome && entry.outcome !== filter.outcome) return false;
      return true;
    })
    .slice(0, limit);
}

/**
 * Security Events Store for OpenClaw.
 *
 * Dual-writes security events to JSONL files (fast, non-blocking primary)
 * and PostgreSQL (async best-effort) for efficient querying.
 */

import { createReadStream } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createInterface } from "node:readline";
import { resolveStateDir } from "../config/paths.js";
import { isDatabaseConnected, getDatabase } from "../infra/database/client.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  type SecurityEvent,
  type SecurityEventCategory,
  type SecurityEventSeverity,
  onSecurityEvent,
} from "./events.js";

const log = createSubsystemLogger("security/events-store");

// Store configuration
const SECURITY_LOGS_DIR = "security-events";
const CURRENT_LOG_FILE = "events.jsonl";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_ROTATED_FILES = 30; // Keep 30 rotated files

// Internal state
let storeInitialized = false;
let currentLogPath: string | null = null;
let unsubscribe: (() => void) | null = null;
let pgAvailable = false;

/**
 * Get the security events directory path.
 */
export function getSecurityEventsDir(): string {
  const stateDir = resolveStateDir();
  return path.join(stateDir, SECURITY_LOGS_DIR);
}

/**
 * Get the current security events log file path.
 */
export function getCurrentLogPath(): string {
  const eventsDir = getSecurityEventsDir();
  return path.join(eventsDir, CURRENT_LOG_FILE);
}

/**
 * Initialize the security events store.
 * Starts listening for security events and persisting them.
 */
export async function initializeSecurityEventsStore(): Promise<void> {
  if (storeInitialized) {
    return;
  }

  try {
    const eventsDir = getSecurityEventsDir();
    await fs.mkdir(eventsDir, { recursive: true });

    currentLogPath = getCurrentLogPath();

    // Check if rotation is needed
    await rotateIfNeeded();

    // Probe PG availability (non-blocking)
    pgAvailable = await isDatabaseConnected().catch(() => false);
    if (pgAvailable) {
      log.info("PostgreSQL available for security events");
    }

    // Subscribe to security events
    unsubscribe = onSecurityEvent(async (event) => {
      await persistEvent(event);
    });

    storeInitialized = true;
    log.info("security events store initialized");
  } catch (err) {
    log.error(
      `failed to initialize security events store: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Shutdown the security events store.
 */
export function shutdownSecurityEventsStore(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  storeInitialized = false;
  currentLogPath = null;
  log.info("security events store shutdown");
}

/**
 * Persist a security event to the JSONL log file and (async best-effort) PostgreSQL.
 */
async function persistEvent(event: SecurityEvent): Promise<void> {
  if (!currentLogPath) {
    return;
  }

  try {
    const line = JSON.stringify(event) + "\n";
    await fs.appendFile(currentLogPath, line, "utf8");

    // Check if rotation is needed after write
    await rotateIfNeeded();
  } catch (err) {
    log.error(
      `failed to persist security event: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Async PG write (fire-and-forget, best-effort)
  if (pgAvailable) {
    persistEventToPg(event).catch((err) => {
      log.debug(
        `failed to write security event to PG: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }
}

/** Insert a security event into the PostgreSQL security_events table. */
async function persistEventToPg(event: SecurityEvent): Promise<void> {
  const db = getDatabase();
  const metadata: Record<string, unknown> = {};
  if (event.context) {
    Object.assign(metadata, event.context);
  }
  if (event.relatedEvents) {
    metadata.relatedEvents = event.relatedEvents;
  }
  await db`
    INSERT INTO security_events (
      time, event_id, category, severity, action, description, source,
      session_key, agent_id, user_id, ip_address, channel, blocked, metadata
    ) VALUES (
      ${new Date(event.timestamp).toISOString()},
      ${event.id},
      ${event.category},
      ${event.severity},
      ${event.action},
      ${event.description},
      ${event.source},
      ${event.sessionKey ?? null},
      ${event.agentId ?? null},
      ${event.userId ?? null},
      ${event.ipAddress ?? null},
      ${event.channel ?? null},
      ${event.blocked ?? false},
      ${JSON.stringify(metadata)}::jsonb
    )
  `;
}

/**
 * Rotate log file if it exceeds the max size.
 */
async function rotateIfNeeded(): Promise<void> {
  if (!currentLogPath) {
    return;
  }

  try {
    const stats = await fs.stat(currentLogPath).catch(() => null);
    if (!stats || stats.size < MAX_FILE_SIZE) {
      return;
    }

    const eventsDir = getSecurityEventsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const rotatedName = `events-${timestamp}.jsonl`;
    const rotatedPath = path.join(eventsDir, rotatedName);

    await fs.rename(currentLogPath, rotatedPath);
    log.info(`rotated security events log to ${rotatedName}`);

    // Clean up old rotated files
    await cleanupOldFiles();
  } catch (err) {
    log.error(
      `failed to rotate security events log: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Clean up old rotated log files.
 */
async function cleanupOldFiles(): Promise<void> {
  try {
    const eventsDir = getSecurityEventsDir();
    const files = await fs.readdir(eventsDir);

    const rotatedFiles = files
      .filter((f) => f.startsWith("events-") && f.endsWith(".jsonl"))
      .toSorted()
      .toReversed();

    if (rotatedFiles.length <= MAX_ROTATED_FILES) {
      return;
    }

    const filesToDelete = rotatedFiles.slice(MAX_ROTATED_FILES);
    for (const file of filesToDelete) {
      await fs.unlink(path.join(eventsDir, file));
      log.debug(`deleted old security events log: ${file}`);
    }
  } catch (err) {
    log.error(
      `failed to cleanup old security events logs: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// Query options for security events
export interface SecurityEventQueryOptions {
  /** Start time (unix timestamp) */
  startTime?: number;
  /** End time (unix timestamp) */
  endTime?: number;
  /** Filter by categories */
  categories?: SecurityEventCategory[];
  /** Filter by severities */
  severities?: SecurityEventSeverity[];
  /** Filter by session key */
  sessionKey?: string;
  /** Filter by user ID */
  userId?: string;
  /** Filter by agent ID */
  agentId?: string;
  /** Filter by IP address */
  ipAddress?: string;
  /** Filter by channel */
  channel?: string;
  /** Filter by source */
  source?: string;
  /** Filter by action (supports prefix matching with *) */
  action?: string;
  /** Only blocked events */
  blockedOnly?: boolean;
  /** Maximum number of events to return */
  limit?: number;
  /** Skip first N events */
  offset?: number;
  /** Sort order (default: descending by timestamp) */
  sortOrder?: "asc" | "desc";
}

/**
 * Query security events from the store.
 * Uses PostgreSQL when available, falling back to JSONL file scan.
 */
export async function querySecurityEvents(
  options: SecurityEventQueryOptions = {},
): Promise<SecurityEvent[]> {
  // Try PG-backed query first
  if (pgAvailable) {
    try {
      return await querySecurityEventsFromPg(options);
    } catch (err) {
      log.debug(
        `PG security events query failed, falling back to JSONL: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // JSONL fallback
  return querySecurityEventsFromJsonl(options);
}

/** Query security events from PostgreSQL. */
async function querySecurityEventsFromPg(
  options: SecurityEventQueryOptions,
): Promise<SecurityEvent[]> {
  const db = getDatabase();
  const limit = options.limit ?? 1000;
  const offset = options.offset ?? 0;
  const order = options.sortOrder === "asc" ? db`ASC` : db`DESC`;

  // Build dynamic WHERE conditions
  const conditions = [];
  if (options.startTime) {
    conditions.push(db`time >= ${new Date(options.startTime).toISOString()}::timestamptz`);
  }
  if (options.endTime) {
    conditions.push(db`time <= ${new Date(options.endTime).toISOString()}::timestamptz`);
  }
  if (options.categories && options.categories.length > 0) {
    conditions.push(db`category = ANY(${options.categories})`);
  }
  if (options.severities && options.severities.length > 0) {
    conditions.push(db`severity = ANY(${options.severities})`);
  }
  if (options.sessionKey) {
    conditions.push(db`session_key = ${options.sessionKey}`);
  }
  if (options.userId) {
    conditions.push(db`user_id = ${options.userId}`);
  }
  if (options.agentId) {
    conditions.push(db`agent_id = ${options.agentId}`);
  }
  if (options.ipAddress) {
    conditions.push(db`ip_address = ${options.ipAddress}`);
  }
  if (options.channel) {
    conditions.push(db`channel = ${options.channel}`);
  }
  if (options.source) {
    conditions.push(db`source = ${options.source}`);
  }
  if (options.action) {
    if (options.action.endsWith("*")) {
      const prefix = options.action.slice(0, -1);
      conditions.push(db`action LIKE ${prefix + "%"}`);
    } else {
      conditions.push(db`action = ${options.action}`);
    }
  }
  if (options.blockedOnly) {
    conditions.push(db`blocked = TRUE`);
  }

  const where =
    conditions.length > 0 ? db`WHERE ${conditions.reduce((a, b) => db`${a} AND ${b}`)}` : db``;

  const rows = await db`
    SELECT time, event_id, category, severity, action, description, source,
           session_key, agent_id, user_id, ip_address, channel, blocked, metadata
    FROM security_events
    ${where}
    ORDER BY time ${order}
    LIMIT ${limit} OFFSET ${offset}
  `;

  return rows.map((row: Record<string, unknown>) => pgRowToSecurityEvent(row));
}

/** Convert a PG row back to a SecurityEvent. */
function pgRowToSecurityEvent(row: Record<string, unknown>): SecurityEvent {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const relatedEvents = metadata.relatedEvents as string[] | undefined;
  const context = { ...metadata };
  delete context.relatedEvents;
  return {
    id: row.event_id as string,
    timestamp: new Date(row.time as string).getTime(),
    category: row.category as SecurityEventCategory,
    severity: row.severity as SecurityEventSeverity,
    action: row.action as string,
    description: row.description as string,
    source: row.source as string,
    sessionKey: (row.session_key as string) || undefined,
    agentId: (row.agent_id as string) || undefined,
    userId: (row.user_id as string) || undefined,
    ipAddress: (row.ip_address as string) || undefined,
    channel: (row.channel as string) || undefined,
    blocked: row.blocked as boolean,
    context: Object.keys(context).length > 0 ? context : undefined,
    relatedEvents,
  };
}

/** JSONL-based query fallback. */
async function querySecurityEventsFromJsonl(
  options: SecurityEventQueryOptions,
): Promise<SecurityEvent[]> {
  const events: SecurityEvent[] = [];
  const eventsDir = getSecurityEventsDir();

  try {
    // Get all log files
    const files = await fs.readdir(eventsDir).catch(() => []);
    const logFiles = [
      CURRENT_LOG_FILE,
      ...files.filter((f) => f.startsWith("events-") && f.endsWith(".jsonl")),
    ];

    for (const file of logFiles) {
      const filePath = path.join(eventsDir, file);
      const fileExists = await fs.stat(filePath).catch(() => null);
      if (!fileExists) {
        continue;
      }

      await readEventsFromFile(filePath, events, options);
    }

    // Sort events
    events.sort((a, b) => {
      const diff = a.timestamp - b.timestamp;
      return options.sortOrder === "asc" ? diff : -diff;
    });

    // Apply offset and limit
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 1000;
    return events.slice(offset, offset + limit);
  } catch (err) {
    log.error(
      `failed to query security events: ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}

/**
 * Read events from a file and filter them.
 */
async function readEventsFromFile(
  filePath: string,
  events: SecurityEvent[],
  options: SecurityEventQueryOptions,
): Promise<void> {
  return new Promise((resolve) => {
    const stream = createReadStream(filePath, { encoding: "utf8" });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    rl.on("line", (line) => {
      try {
        const event = JSON.parse(line) as SecurityEvent;
        if (matchesFilter(event, options)) {
          events.push(event);
        }
      } catch {
        // Skip invalid lines
      }
    });

    rl.on("close", () => resolve());
    rl.on("error", () => resolve());
  });
}

/**
 * Check if an event matches the query filters.
 */
function matchesFilter(event: SecurityEvent, options: SecurityEventQueryOptions): boolean {
  if (options.startTime && event.timestamp < options.startTime) {
    return false;
  }
  if (options.endTime && event.timestamp > options.endTime) {
    return false;
  }
  if (options.categories && !options.categories.includes(event.category)) {
    return false;
  }
  if (options.severities && !options.severities.includes(event.severity)) {
    return false;
  }
  if (options.sessionKey && event.sessionKey !== options.sessionKey) {
    return false;
  }
  if (options.userId && event.userId !== options.userId) {
    return false;
  }
  if (options.agentId && event.agentId !== options.agentId) {
    return false;
  }
  if (options.ipAddress && event.ipAddress !== options.ipAddress) {
    return false;
  }
  if (options.channel && event.channel !== options.channel) {
    return false;
  }
  if (options.source && event.source !== options.source) {
    return false;
  }
  if (options.action) {
    if (options.action.endsWith("*")) {
      const prefix = options.action.slice(0, -1);
      if (!event.action.startsWith(prefix)) {
        return false;
      }
    } else if (event.action !== options.action) {
      return false;
    }
  }
  if (options.blockedOnly && !event.blocked) {
    return false;
  }
  return true;
}

/**
 * Get security event statistics.
 */
export interface SecurityEventStats {
  totalEvents: number;
  byCategory: Record<SecurityEventCategory, number>;
  bySeverity: Record<SecurityEventSeverity, number>;
  blockedCount: number;
  timeRange: {
    start: number | null;
    end: number | null;
  };
}

/**
 * Get statistics about security events.
 */
export async function getSecurityEventStats(
  options: Pick<SecurityEventQueryOptions, "startTime" | "endTime"> = {},
): Promise<SecurityEventStats> {
  const stats: SecurityEventStats = {
    totalEvents: 0,
    byCategory: {} as Record<SecurityEventCategory, number>,
    bySeverity: {} as Record<SecurityEventSeverity, number>,
    blockedCount: 0,
    timeRange: { start: null, end: null },
  };

  const events = await querySecurityEvents({
    startTime: options.startTime,
    endTime: options.endTime,
    limit: 100000, // High limit for stats
  });

  for (const event of events) {
    stats.totalEvents++;

    stats.byCategory[event.category] = (stats.byCategory[event.category] ?? 0) + 1;
    stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] ?? 0) + 1;

    if (event.blocked) {
      stats.blockedCount++;
    }

    if (stats.timeRange.start === null || event.timestamp < stats.timeRange.start) {
      stats.timeRange.start = event.timestamp;
    }
    if (stats.timeRange.end === null || event.timestamp > stats.timeRange.end) {
      stats.timeRange.end = event.timestamp;
    }
  }

  return stats;
}

/**
 * Get recent security alerts (high and critical severity events).
 */
export async function getRecentSecurityAlerts(limit = 100): Promise<SecurityEvent[]> {
  return querySecurityEvents({
    severities: ["critical", "high"],
    limit,
    sortOrder: "desc",
  });
}

/**
 * Get blocked events (potential attacks).
 */
export async function getBlockedEvents(limit = 100): Promise<SecurityEvent[]> {
  return querySecurityEvents({
    blockedOnly: true,
    limit,
    sortOrder: "desc",
  });
}

/**
 * Get events for a specific session.
 */
export async function getSessionSecurityEvents(
  sessionKey: string,
  limit = 100,
): Promise<SecurityEvent[]> {
  return querySecurityEvents({
    sessionKey,
    limit,
    sortOrder: "desc",
  });
}

/**
 * Get events by IP address (useful for detecting attacks).
 */
export async function getEventsByIpAddress(
  ipAddress: string,
  limit = 100,
): Promise<SecurityEvent[]> {
  return querySecurityEvents({
    ipAddress,
    limit,
    sortOrder: "desc",
  });
}

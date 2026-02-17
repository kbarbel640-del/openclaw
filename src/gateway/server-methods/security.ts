/**
 * Security monitoring API endpoints for OpenClaw Gateway.
 *
 * Provides endpoints for the cybersecurity agent to monitor
 * security events, alerts, and system status.
 */

import { loadConfig } from "../../config/config.js";
import { runSecurityAudit } from "../../security/audit.js";
import {
  querySecurityEvents,
  getSecurityEventStats,
  getRecentSecurityAlerts,
  getBlockedEvents,
  getSessionSecurityEvents,
  getEventsByIpAddress,
  type SecurityEventQueryOptions,
} from "../../security/events-store.js";
import { type SecurityEventCategory, type SecurityEventSeverity } from "../../security/events.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

// Valid categories for validation
const VALID_CATEGORIES = new Set<SecurityEventCategory>([
  "authentication",
  "authorization",
  "access_control",
  "command_execution",
  "network",
  "file_system",
  "configuration",
  "session",
  "rate_limit",
  "injection",
  "anomaly",
  "audit",
]);

// Valid severities for validation
const VALID_SEVERITIES = new Set<SecurityEventSeverity>([
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

// Type guard for category array
function isValidCategories(value: unknown): value is SecurityEventCategory[] {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every(
    (v) => typeof v === "string" && VALID_CATEGORIES.has(v as SecurityEventCategory),
  );
}

// Type guard for severity array
function isValidSeverities(value: unknown): value is SecurityEventSeverity[] {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every(
    (v) => typeof v === "string" && VALID_SEVERITIES.has(v as SecurityEventSeverity),
  );
}

export const securityHandlers: GatewayRequestHandlers = {
  /**
   * Query security events with filters.
   */
  "security.events.query": async ({ respond, params }) => {
    try {
      const options: SecurityEventQueryOptions = {};

      if (typeof params.startTime === "number") {
        options.startTime = params.startTime;
      }
      if (typeof params.endTime === "number") {
        options.endTime = params.endTime;
      }
      if (isValidCategories(params.categories)) {
        options.categories = params.categories;
      }
      if (isValidSeverities(params.severities)) {
        options.severities = params.severities;
      }
      if (typeof params.sessionKey === "string") {
        options.sessionKey = params.sessionKey;
      }
      if (typeof params.userId === "string") {
        options.userId = params.userId;
      }
      if (typeof params.agentId === "string") {
        options.agentId = params.agentId;
      }
      if (typeof params.ipAddress === "string") {
        options.ipAddress = params.ipAddress;
      }
      if (typeof params.channel === "string") {
        options.channel = params.channel;
      }
      if (typeof params.source === "string") {
        options.source = params.source;
      }
      if (typeof params.action === "string") {
        options.action = params.action;
      }
      if (params.blockedOnly === true) {
        options.blockedOnly = true;
      }
      if (typeof params.limit === "number" && params.limit > 0) {
        options.limit = Math.min(params.limit, 1000);
      } else {
        options.limit = 100;
      }
      if (typeof params.offset === "number" && params.offset >= 0) {
        options.offset = params.offset;
      }
      if (params.sortOrder === "asc" || params.sortOrder === "desc") {
        options.sortOrder = params.sortOrder;
      }

      const events = await querySecurityEvents(options);
      respond(true, { events, count: events.length });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Get security event statistics.
   */
  "security.events.stats": async ({ respond, params }) => {
    try {
      const options: { startTime?: number; endTime?: number } = {};

      if (typeof params.startTime === "number") {
        options.startTime = params.startTime;
      }
      if (typeof params.endTime === "number") {
        options.endTime = params.endTime;
      }

      const stats = await getSecurityEventStats(options);
      respond(true, stats);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Get recent security alerts (high and critical severity).
   */
  "security.alerts": async ({ respond, params }) => {
    try {
      const limit =
        typeof params.limit === "number" && params.limit > 0 ? Math.min(params.limit, 500) : 100;

      const alerts = await getRecentSecurityAlerts(limit);
      respond(true, { alerts, count: alerts.length });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Get blocked events (potential attacks).
   */
  "security.blocked": async ({ respond, params }) => {
    try {
      const limit =
        typeof params.limit === "number" && params.limit > 0 ? Math.min(params.limit, 500) : 100;

      const events = await getBlockedEvents(limit);
      respond(true, { events, count: events.length });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Get security events for a specific session.
   */
  "security.session": async ({ respond, params }) => {
    try {
      if (typeof params.sessionKey !== "string" || !params.sessionKey.trim()) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "sessionKey is required"));
        return;
      }

      const limit =
        typeof params.limit === "number" && params.limit > 0 ? Math.min(params.limit, 500) : 100;

      const events = await getSessionSecurityEvents(params.sessionKey, limit);
      respond(true, { events, count: events.length });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Get security events by IP address.
   */
  "security.ip": async ({ respond, params }) => {
    try {
      if (typeof params.ipAddress !== "string" || !params.ipAddress.trim()) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "ipAddress is required"));
        return;
      }

      const limit =
        typeof params.limit === "number" && params.limit > 0 ? Math.min(params.limit, 500) : 100;

      const events = await getEventsByIpAddress(params.ipAddress, limit);
      respond(true, { events, count: events.length });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Run a security audit on the current configuration.
   */
  "security.audit": async ({ respond, params }) => {
    try {
      const deep = params.deep === true;
      const cfg = loadConfig();

      const report = await runSecurityAudit({
        config: cfg,
        deep,
      });
      respond(true, report);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Get a security summary (quick overview).
   */
  "security.summary": async ({ respond }) => {
    try {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      const [stats, recentAlerts, blockedEvents] = await Promise.all([
        getSecurityEventStats({ startTime: oneDayAgo }),
        getRecentSecurityAlerts(10),
        getBlockedEvents(10),
      ]);

      const criticalCount = stats.bySeverity.critical ?? 0;
      const highCount = stats.bySeverity.high ?? 0;

      respond(true, {
        period: "24h",
        totalEvents: stats.totalEvents,
        criticalCount,
        highCount,
        blockedCount: stats.blockedCount,
        recentAlerts: recentAlerts.slice(0, 5),
        recentBlocked: blockedEvents.slice(0, 5),
        status: criticalCount > 0 ? "critical" : highCount > 0 ? "warning" : "healthy",
      });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};

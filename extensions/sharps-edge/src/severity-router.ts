/**
 * SHARPS EDGE - Severity-Based Alert Routing
 *
 * Routes alerts to appropriate channels based on severity level.
 * INFO -> log only, WARN -> log + notify, BLOCK -> log + stop,
 * REJECT -> log + refuse + notify, CRITICAL -> log + halt + notify.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

import type { AuditLogger } from "./audit-logger.js";
import { Severity, type SharpsEdgeConfig } from "./types.js";

export type AlertTarget = "log" | "whatsapp" | "telegram" | "discord" | "slack";

export class SeverityRouter {
  private api: OpenClawPluginApi;
  private auditLogger: AuditLogger;
  private routing: Record<string, string>;

  constructor(
    api: OpenClawPluginApi,
    auditLogger: AuditLogger,
    routing: Record<string, string>,
  ) {
    this.api = api;
    this.auditLogger = auditLogger;
    this.routing = routing;
  }

  /**
   * Route an alert based on its severity level.
   */
  async route(severity: Severity, message: string, projectId: string): Promise<void> {
    const target = this.routing[severity] ?? "log";

    // Always log
    await this.auditLogger.logAlert(projectId, severity, message);

    // Log to plugin logger
    switch (severity) {
      case Severity.INFO:
        this.api.logger.info?.(`[${projectId}] ${message}`);
        break;
      case Severity.WARN:
        this.api.logger.warn(`[${projectId}] ${message}`);
        break;
      case Severity.BLOCK:
      case Severity.REJECT:
      case Severity.CRITICAL:
        this.api.logger.error(`[${severity}] [${projectId}] ${message}`);
        break;
    }

    // Route to external channel if configured
    if (target !== "log") {
      await this.deliverAlert(target, severity, message, projectId);
    }
  }
  /**
   * Deliver alert via OpenClaw's system event queue.
   * Falls back to logging if the runtime API is unavailable.
   */
  private async deliverAlert(
    target: string,
    severity: Severity,
    message: string,
    projectId: string,
  ): Promise<void> {
    try {
      const formatted = `[SHARPS EDGE ${severity}] [${projectId}] ${message}`;

      // Use OpenClaw's system event queue for channel delivery
      if (typeof this.api.runtime?.system?.enqueueSystemEvent === "function") {
        await this.api.runtime.system.enqueueSystemEvent({
          type: "notification",
          channel: target,
          message: formatted,
          metadata: { source: "sharps-edge", severity, projectId },
        });
      } else {
        this.api.logger.warn(
          `sharps-edge: Cannot deliver to ${target} (runtime API unavailable): ${formatted}`,
        );
      }
    } catch (err) {
      this.api.logger.warn(
        `sharps-edge: Failed to deliver ${severity} alert to ${target}: ${String(err)}`,
      );
    }
  }
}

/**
 * Create and return a severity router instance.
 */
export function createSeverityRouter(
  api: OpenClawPluginApi,
  cfg: SharpsEdgeConfig,
  auditLogger: AuditLogger,
): SeverityRouter {
  const routing = cfg.severityRouting ?? {
    [Severity.INFO]: "log",
    [Severity.WARN]: "log",
    [Severity.BLOCK]: "log",
    [Severity.REJECT]: "log",
    [Severity.CRITICAL]: "log",
  };

  return new SeverityRouter(api, auditLogger, routing);
}

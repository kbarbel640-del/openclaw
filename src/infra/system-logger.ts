import { getGlobalDb } from "./db.js";
import crypto from "node:crypto";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("infra/system-logger");

export type SystemModule = "HIVE" | "FORGE" | "CRON" | "DB" | "UI" | "GENERAL";
export type SystemSeverity = "info" | "warning" | "error" | "critical";

export interface SystemEventLog {
  module: SystemModule;
  severity: SystemSeverity;
  message: string;
  stack?: string;
  workspace_id?: string;
}

export class SystemLogger {
  static log(entry: SystemEventLog) {
    try {
      const db = getGlobalDb();
      const id = crypto.randomUUID();
      const now = Date.now();

      db.prepare(`
        INSERT INTO system_events (id, module, severity, message, stack, workspace_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        entry.module,
        entry.severity,
        entry.message,
        entry.stack || null,
        entry.workspace_id || null,
        now
      );

      // Also mirror to standard subsystem logs for visibility in terminal/files
      const logMessage = `[${entry.module}] ${entry.message}`;
      if (entry.severity === "critical" || entry.severity === "error") {
        log.error(logMessage, { stack: entry.stack });
      } else if (entry.severity === "warning") {
        log.warn(logMessage);
      } else {
        log.info(logMessage);
      }
    } catch (err) {
      // Last resort fallback to console if DB fails
      console.error("[SystemLogger] Failed to persist system event:", err);
      console.error(`[${entry.module}] ${entry.message}`);
    }
  }

  static info(module: SystemModule, message: string, workspace_id?: string) {
    this.log({ module, severity: "info", message, workspace_id });
  }

  static warn(module: SystemModule, message: string, workspace_id?: string) {
    this.log({ module, severity: "warning", message, workspace_id });
  }

  static error(module: SystemModule, message: string, err?: unknown, workspace_id?: string) {
    this.log({
      module,
      severity: "error",
      message,
      stack: err instanceof Error ? err.stack : String(err),
      workspace_id
    });
  }

  static critical(module: SystemModule, message: string, err?: unknown, workspace_id?: string) {
    this.log({
      module,
      severity: "critical",
      message,
      stack: err instanceof Error ? err.stack : String(err),
      workspace_id
    });
  }
}

import { Cron } from "croner";
import type { DatabaseSync } from "node:sqlite";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { SystemLogger } from "./system-logger.js";
import { SystemHealth } from "./system-health.js";

const log = createSubsystemLogger("infra/cron-engine");

export type ScheduledTask = {
  id: string;
  workspace_id: string;
  created_by: string;
  owner_agent_id: string;
  cron_expression: string;
  natural_language_schedule?: string;
  task_payload: any;
  status: 'active' | 'paused' | 'completed' | 'failed';
  next_run_at: number;
  last_run_at?: number;
  run_count: number;
};

export class CronEngine {
  constructor(private db: DatabaseSync) {}

  /**
   * Calculates the next run time for a cron expression.
   */
  calculateNextRun(expression: string): number | null {
    try {
      const c = new Cron(expression);
      const next = c.nextRun();
      return next ? next.getTime() : null;
    } catch (err) {
      log.error(`Failed to parse cron expression "${expression}": ${String(err)}`);
      return null;
    }
  }

  /**
   * Queries due tasks from the database.
   */
  getDueTasks(): ScheduledTask[] {
    try {
      const now = Date.now();
      const rows = this.db.prepare(
        `SELECT * FROM scheduled_tasks WHERE status = 'active' AND next_run_at <= ?`
      ).all(now) as any[];

      return rows.map(row => ({
        ...row,
        task_payload: JSON.parse(row.task_payload)
      }));
    } catch (err) {
      SystemLogger.error("CRON", "Failed to query due tasks", err);
      SystemHealth.update("cron", err);
      return [];
    }
  }

  /**
   * Updates a task after execution.
   */
  async updateTaskAfterRun(taskId: string, success: boolean): Promise<void> {
    try {
      const now = Date.now();
      const task = this.db.prepare(`SELECT * FROM scheduled_tasks WHERE id = ?`).get(taskId) as any;
      if (!task) return;

      const nextRunAt = this.calculateNextRun(task.cron_expression);
      const status = !nextRunAt ? 'completed' : (success ? 'active' : 'failed');

      this.db.prepare(`
        UPDATE scheduled_tasks
        SET last_run_at = ?,
            next_run_at = ?,
            run_count = run_count + 1,
            status = ?,
            updated_at = ?
        WHERE id = ?
      `).run(now, nextRunAt, status, now, taskId);
      SystemHealth.update("cron");
    } catch (err) {
      SystemLogger.error("CRON", `Failed to update task ${taskId} after run`, err);
      SystemHealth.update("cron", err);
    }
  }
}

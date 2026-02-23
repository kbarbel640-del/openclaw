/**
 * task-notifications.ts
 *
 * Proactive task notification system. Runs on a 5-minute interval, checks for
 * overdue tasks (due < now AND status='open' AND notified_at IS NULL), sends
 * macOS notifications via system.notify on connected nodes, then marks them
 * as notified.
 */

import type { DatabaseSync } from "node:sqlite";
import { resolveSessionAgentId } from "../agents/agent-scope.js";
import { resolveMemorySearchConfig } from "../agents/memory-search.js";
import { loadConfig } from "../config/config.js";
import { callGateway, randomIdempotencyKey } from "../gateway/call.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { resolveUserPath } from "../utils.js";

const log = createSubsystemLogger("task-notifications");

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let timer: ReturnType<typeof setInterval> | null = null;

interface OverdueTask {
  id: string;
  text: string;
  due: string;
  priority: string;
}

function openMemoryDb(cfg: ReturnType<typeof loadConfig>, agentId: string): DatabaseSync {
  const memCfg = resolveMemorySearchConfig(cfg, agentId);
  if (!memCfg) {
    throw new Error("memory search is not configured");
  }
  const dbPath = resolveUserPath(memCfg.store.path);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync: SqliteDb } = require("node:sqlite") as typeof import("node:sqlite");
  return new SqliteDb(dbPath);
}

async function checkOverdueTasks(): Promise<void> {
  try {
    const cfg = loadConfig();
    const agentId = resolveSessionAgentId({ config: cfg });
    let db: DatabaseSync;
    try {
      db = openMemoryDb(cfg, agentId);
    } catch {
      // DB may not exist yet if no tasks have been created
      return;
    }

    try {
      // Check if tasks table exists
      const tableExists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'")
        .get();
      if (!tableExists) {
        return;
      }

      const now = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const overdue = db
        .prepare(
          `SELECT id, text, due, priority FROM tasks
           WHERE status = 'open' AND due IS NOT NULL AND due < ? AND notified_at IS NULL`,
        )
        .all(now) as unknown as OverdueTask[];

      if (overdue.length === 0) {
        return;
      }

      log.info(`found ${overdue.length} overdue task(s), sending notifications`);

      for (const task of overdue) {
        try {
          // Send notification via node.invoke → system.notify on all connected nodes
          await callGateway({
            method: "node.invoke",
            params: {
              command: "system.notify",
              params: {
                title: "⏰ Overdue Task",
                body: `${task.text}${task.due ? ` (due: ${task.due})` : ""}`,
                priority: task.priority === "high" ? "timeSensitive" : "active",
                delivery: "system",
              },
              idempotencyKey: randomIdempotencyKey(),
            },
          });

          // Mark as notified
          db.prepare("UPDATE tasks SET notified_at = ? WHERE id = ?").run(Date.now(), task.id);
          log.info(`notified overdue task: ${task.id}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log.warn(`failed to notify task ${task.id}: ${msg}`);
        }
      }
    } finally {
      db.close();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`task notification check failed: ${msg}`);
  }
}

export function startTaskNotificationTimer(): void {
  if (timer) {
    return;
  }
  log.info("starting task notification timer (5 min interval)");
  timer = setInterval(() => {
    void checkOverdueTasks();
  }, CHECK_INTERVAL_MS);
  // Run an initial check shortly after start
  setTimeout(() => void checkOverdueTasks(), 10_000);
}

export function stopTaskNotificationTimer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    log.info("stopped task notification timer");
  }
}

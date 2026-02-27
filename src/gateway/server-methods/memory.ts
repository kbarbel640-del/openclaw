/**
 * memory.ts
 *
 * Gateway RPC handlers for memory-related operations.
 * Currently exposes `memory.tasks` for CRUD on the tasks table.
 */

import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { resolveSessionAgentId } from "../../agents/agent-scope.js";
import { resolveMemorySearchConfig } from "../../agents/memory-search.js";
import { loadConfig } from "../../config/config.js";
import { resolveUserPath } from "../../utils.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

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

function ensureTasksTable(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      due TEXT,
      priority TEXT NOT NULL DEFAULT 'normal',
      source TEXT,
      session_key TEXT,
      notified_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due);`);
}

export const memoryHandlers: GatewayRequestHandlers = {
  "memory.tasks": async ({ params, respond }) => {
    const action = params.action as string | undefined;
    if (!action) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "missing required param: action"),
      );
      return;
    }

    const cfg = loadConfig();
    const sessionKey = (params.sessionKey as string) ?? "main";
    const agentId = resolveSessionAgentId({ sessionKey, config: cfg });
    const db = openMemoryDb(cfg, agentId);

    try {
      ensureTasksTable(db);
      const now = Date.now();

      switch (action) {
        case "list": {
          const status = (params.status as string) ?? "open";
          const rows = db
            .prepare("SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC")
            .all(status);
          respond(true, { tasks: rows }, undefined);
          break;
        }

        case "add": {
          const text = params.text as string | undefined;
          if (!text) {
            respond(
              false,
              undefined,
              errorShape(ErrorCodes.INVALID_REQUEST, "missing required param: text"),
            );
            return;
          }
          const id = randomUUID();
          const due = (params.due as string) ?? null;
          const priority = (params.priority as string) ?? "normal";
          const source = (params.source as string) ?? null;
          const taskSessionKey = (params.session_key as string) ?? sessionKey;
          db.prepare(
            `INSERT INTO tasks (id, text, status, due, priority, source, session_key, created_at, updated_at)
             VALUES (?, ?, 'open', ?, ?, ?, ?, ?, ?)`,
          ).run(id, text, due, priority, source, taskSessionKey, now, now);
          respond(true, { id, text, status: "open", due, priority }, undefined);
          break;
        }

        case "done": {
          const id = params.id as string | undefined;
          if (!id) {
            respond(
              false,
              undefined,
              errorShape(ErrorCodes.INVALID_REQUEST, "missing required param: id"),
            );
            return;
          }
          const result = db
            .prepare("UPDATE tasks SET status = 'done', updated_at = ? WHERE id = ?")
            .run(now, id);
          if ((result as { changes: number }).changes === 0) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "task not found"));
            return;
          }
          respond(true, { id, status: "done" }, undefined);
          break;
        }

        case "dismiss": {
          const id = params.id as string | undefined;
          if (!id) {
            respond(
              false,
              undefined,
              errorShape(ErrorCodes.INVALID_REQUEST, "missing required param: id"),
            );
            return;
          }
          const result = db
            .prepare("UPDATE tasks SET status = 'dismissed', updated_at = ? WHERE id = ?")
            .run(now, id);
          if ((result as { changes: number }).changes === 0) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "task not found"));
            return;
          }
          respond(true, { id, status: "dismissed" }, undefined);
          break;
        }

        default:
          respond(
            false,
            undefined,
            errorShape(
              ErrorCodes.INVALID_REQUEST,
              `unknown action: ${action}. Expected: list, add, done, dismiss`,
            ),
          );
      }
    } finally {
      db.close();
    }
  },
};

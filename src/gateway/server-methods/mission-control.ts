import { getGlobalDb } from "../../infra/db.js";
import { SystemHealth } from "../../infra/system-health.js";
import type { GatewayRequestHandlers } from "./types.js";

export const missionControlHandlers: GatewayRequestHandlers = {
  "mission_control.get_data": async ({ respond }) => {
    const db = getGlobalDb();

    const tasks = db.prepare(`SELECT * FROM mission_tasks ORDER BY created_at DESC LIMIT 50`).all();
    const intel = db.prepare(`SELECT * FROM user_intelligence_memory ORDER BY confidence_score DESC LIMIT 10`).all();
    const audit = db.prepare(`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 20`).all();
    const scheduled = db.prepare(`SELECT * FROM scheduled_tasks WHERE status = 'active' ORDER BY next_run_at ASC`).all();
    const workspaces = db.prepare(`SELECT * FROM workspaces ORDER BY created_at ASC`).all();

    respond(true, {
      tasks,
      intel,
      audit,
      scheduled,
      workspaces
    });
  },

  "mission_control.get_stats": async ({ respond }) => {
    const db = getGlobalDb();

    const taskStats = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM mission_tasks
      GROUP BY status
    `).all();

    // Sum tokens from audit_log diff column
    const tokenResult = db.prepare(`
      SELECT SUM(CAST(json_extract(diff, '$.tokens') AS INTEGER)) as total
      FROM audit_log
      WHERE action = 'token_usage'
    `).get() as { total: number } | undefined;

    const tokens = tokenResult?.total || 0;
    const cost = tokens * 0.00001;

    const activeAgentsResult = db.prepare(`
      SELECT COUNT(DISTINCT actor_id) as count
      FROM audit_log
      WHERE created_at > ?
    `).get(Date.now() - 5 * 60 * 1000) as { count: number } | undefined;

    const nextHeartbeat = db.prepare(`
      SELECT next_run_at
      FROM scheduled_tasks
      WHERE status = 'active'
      ORDER BY next_run_at ASC
      LIMIT 1
    `).get() as { next_run_at: number } | undefined;

    let heartbeatStr = 'N/A';
    if (nextHeartbeat?.next_run_at) {
        const diff = nextHeartbeat.next_run_at - Date.now();
        if (diff > 0) {
            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            heartbeatStr = `${mins}m ${secs}s`;
        } else {
            heartbeatStr = 'Now';
        }
    }

    const agentStats = { online: activeAgentsResult?.count || 0, busy: 0 };

    respond(true, {
      taskStats,
      agentStats,
      tokens,
      cost,
      heartbeat: heartbeatStr
    });
  },

  "mission_control.system_health": async ({ respond }) => {
    respond(true, SystemHealth.getHealthSummary());
  },

  "mission_control.create_task": async ({ params, respond }) => {
    const db = getGlobalDb();
    const { title, description, agent_id, priority, deadline } = params as any;

    if (!title) {
        respond(false, { error: "Title is required" });
        return;
    }

    const taskId = crypto.randomUUID();
    const now = Date.now();
    db.prepare(`
        INSERT INTO mission_tasks (id, agent_id, title, description, status, priority, deadline, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        taskId,
        agent_id || "main",
        title,
        description || null,
        "pending",
        priority || 0,
        deadline || null,
        now,
        now
    );

    respond(true, { taskId });
  }
};

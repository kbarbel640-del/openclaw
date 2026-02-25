import type { DatabaseSync } from "node:sqlite";

/**
 * Ensures that the global infrastructure tables exist in the provided database.
 */
export function ensureGlobalSchema(db: DatabaseSync): void {
  // Proactive Engine
  db.exec(`
    CREATE TABLE IF NOT EXISTS proactive_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      condition TEXT NOT NULL,
      action TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS proactive_patterns (
      id TEXT PRIMARY KEY,
      pattern_type TEXT NOT NULL,
      pattern_data TEXT NOT NULL,
      confidence REAL NOT NULL,
      last_detected_at INTEGER,
      metadata TEXT
    );
  `);

  // Forge Module
  db.exec(`
    CREATE TABLE IF NOT EXISTS forge_jobs (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      failure_reason TEXT,
      status TEXT NOT NULL, -- 'pending', 'analyzing', 'generating', 'testing', 'completed', 'failed'
      generated_code TEXT,
      test_results TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Workspaces
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      config TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Scheduled Tasks (Cron System)
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      workspace_id TEXT,
      created_by TEXT,
      owner_agent_id TEXT,
      cron_expression TEXT,
      natural_language_schedule TEXT,
      task_payload TEXT, -- JSON
      status TEXT NOT NULL DEFAULT 'active', -- active | paused | completed | failed
      next_run_at INTEGER,
      last_run_at INTEGER,
      run_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_run ON scheduled_tasks(next_run_at);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_workspace ON scheduled_tasks(workspace_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_owner ON scheduled_tasks(owner_agent_id);`);

  // User Intelligence Memory
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_intelligence_memory (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL, -- habit | preference | workflow | schedule_pattern | interest | behavioral_pattern
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      confidence_score REAL NOT NULL DEFAULT 0.5,
      source TEXT NOT NULL, -- conversation | inference | task_analysis
      last_observed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_user_intel_user_id ON user_intelligence_memory(user_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_user_intel_category ON user_intelligence_memory(category);`);

  // Intel & Insights
  db.exec(`
    CREATE TABLE IF NOT EXISTS intel_items (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL, -- AI News | Industry Trends | Competitor Watch | Opportunities
      title TEXT NOT NULL,
      summary TEXT,
      source_link TEXT,
      importance TEXT, -- 🔥 | 🔌 | ⚡
      created_at INTEGER NOT NULL
    );
  `);

  // Mission Control
  db.exec(`
    CREATE TABLE IF NOT EXISTS mission_tasks (
      id TEXT PRIMARY KEY,
      parent_id TEXT,
      agent_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL, -- 'pending', 'active', 'completed', 'failed', 'blocked'
      priority INTEGER DEFAULT 0,
      deadline INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS mission_task_events (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_data TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  // Audit Log
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      diff TEXT,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  // System Events for stability logging
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_events (
      id TEXT PRIMARY KEY,
      module TEXT NOT NULL,
      severity TEXT NOT NULL, -- info | warning | error | critical
      message TEXT NOT NULL,
      stack TEXT,
      workspace_id TEXT,
      created_at INTEGER NOT NULL
    );
  `);
}

# OMS Task Enforcement System - Design Document

## Overview

Design for programmatic enforcement of task tracking in OpenClaw agents, starting with Luna. Based on the same pattern as the brain-tiered memory integration - code-enforced, not instruction-based.

**Problem**: Luna keeps missing/not using the oms.tasks table. AGENTS.md instructions don't enforce behavior - LLM can forget or skip them.

**Solution**: Code-level enforcement where the agent has no choice - the implementation handles it automatically.

---

## Database Schema

### Extended `oms.tasks` Table

```sql
-- Migration: 008_task_management.sql

-- New columns for oms.tasks
ALTER TABLE oms.tasks ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE oms.tasks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE oms.tasks ADD COLUMN IF NOT EXISTS category TEXT;           -- feature/bug/improvement/research/discussion
ALTER TABLE oms.tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';  -- critical/high/normal/low
ALTER TABLE oms.tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE oms.tasks ADD COLUMN IF NOT EXISTS source TEXT;             -- chat/testing/heartbeat/manual
ALTER TABLE oms.tasks ADD COLUMN IF NOT EXISTS source_reference TEXT;   -- link to conversation/session
ALTER TABLE oms.tasks ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE oms.tasks ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE oms.tasks ADD COLUMN IF NOT EXISTS owner TEXT DEFAULT 'luna';
ALTER TABLE oms.tasks ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'luna';
ALTER TABLE oms.tasks ADD COLUMN IF NOT EXISTS auto_created BOOLEAN DEFAULT FALSE;  -- TRUE if auto-detected, FALSE if explicit request
ALTER TABLE oms.tasks ADD COLUMN IF NOT EXISTS accepted_by TEXT;        -- joe when approved
ALTER TABLE oms.tasks ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE oms.tasks ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE oms.tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_owner ON oms.tasks(owner);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON oms.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON oms.tasks(category);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON oms.tasks(priority);
```

### New `oms.task_assignments` Table

For multi-agent workflows (Vulcan implements → Aegis tests):

```sql
CREATE TABLE oms.task_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES oms.tasks(task_id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    role TEXT NOT NULL,                -- implement/test/review/research/design/fix
    can_parallel BOOLEAN DEFAULT TRUE, -- Can run same time as others?
    depends_on UUID[],                 -- Assignment IDs that must complete first
    status TEXT DEFAULT 'pending',     -- pending/in_progress/done/blocked
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT,

    UNIQUE(task_id, agent_id, role)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assignments_task ON oms.task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_assignments_agent ON oms.task_assignments(agent_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON oms.task_assignments(status);
```

---

## Reference Values

| Field        | Values                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------- |
| **category** | `feature` / `bug` / `improvement` / `research` / `discussion`                               |
| **priority** | `critical` / `high` / `normal` / `low`                                                      |
| **status**   | `pending` / `assigned` / `in_progress` / `blocked` / `acceptance` / `accepted` / `rejected` |
| **source**   | `chat` / `testing` / `heartbeat` / `manual`                                                 |
| **role**     | `implement` / `test` / `review` / `research` / `design` / `fix`                             |

---

## Status Flow

```
┌─────────┐     ┌──────────┐     ┌─────────────┐     ┌────────────┐     ┌──────────┐
│ pending │ ──► │ assigned │ ──► │ in_progress │ ──► │ acceptance │ ──► │ accepted │
└─────────┘     └──────────┘     └─────────────┘     └────────────┘     └──────────┘
                                        │                   │
                                        ▼                   ▼
                                   ┌─────────┐        ┌──────────┐
                                   │ blocked │        │ rejected │ ──► back to assigned
                                   └─────────┘        └──────────┘
```

| Status        | Meaning                                         |
| ------------- | ----------------------------------------------- |
| `pending`     | Task created, not yet assigned                  |
| `assigned`    | Agents assigned, work not started               |
| `in_progress` | At least one agent working                      |
| `blocked`     | Waiting on something                            |
| `acceptance`  | All agent work done, waiting for Joe's approval |
| `accepted`    | Joe approved, ticket closed ✓                   |
| `rejected`    | Joe rejected, needs rework                      |

---

## Auto-Created vs Explicit Tasks

| Trigger                           | `auto_created` | `source`  |
| --------------------------------- | -------------- | --------- |
| Luna detects feature idea in chat | `TRUE`         | `chat`    |
| User says "create a task for..."  | `FALSE`        | `chat`    |
| Bug found during testing          | `TRUE`         | `testing` |
| User manually adds                | `FALSE`        | `manual`  |

`auto_created = TRUE` means Luna autonomously decided to create the task (detected/inferred).
`auto_created = FALSE` means someone explicitly requested it.

---

## Multi-Agent Assignment Examples

### Parallel - Vulcan implements while Muse designs:

```sql
INSERT INTO oms.task_assignments (task_id, agent_id, role, can_parallel) VALUES
('abc-123', 'vulcan', 'implement', TRUE),
('abc-123', 'muse', 'design', TRUE);    -- Both can start immediately
```

### Sequential - Vulcan first, then Aegis tests:

```sql
-- Vulcan's assignment
INSERT INTO oms.task_assignments (task_id, agent_id, role, depends_on)
VALUES ('abc-123', 'vulcan', 'implement', NULL)
RETURNING assignment_id;  -- Returns: assign-111

-- Aegis depends on Vulcan
INSERT INTO oms.task_assignments (task_id, agent_id, role, depends_on)
VALUES ('abc-123', 'aegis', 'test', ARRAY['assign-111']::UUID[]);
```

### Mixed - Vulcan + Muse parallel, then Aegis:

```sql
INSERT INTO oms.task_assignments VALUES
('abc-123', 'vulcan', 'implement', TRUE, NULL),        -- assign-111
('abc-123', 'muse', 'design', TRUE, NULL),             -- assign-222
('abc-123', 'aegis', 'test', TRUE, ARRAY['assign-111', 'assign-222']);  -- waits for both
```

---

## Enforcement Architecture

Same pattern as brain-tiered memory integration:

```
┌─────────────────────────────────────────────────────────────────┐
│                     OpenClaw Agent Loop                          │
│                                                                  │
│  onMessage(msg) ──► TaskEnforcementManager.beforeProcess()      │
│                              │                                   │
│                    ┌─────────┼─────────┐                        │
│                    ▼         ▼         ▼                        │
│              ┌─────────┐ ┌────────┐ ┌──────────┐               │
│              │ Inject  │ │ Detect │ │ Load     │               │
│              │ Pending │ │ Task   │ │ Context  │               │
│              │ Tasks   │ │ Keywords│ │ from DB  │               │
│              └─────────┘ └────────┘ └──────────┘               │
│                              │                                   │
│                              ▼                                   │
│                    Agent processes message                       │
│                              │                                   │
│                              ▼                                   │
│       TaskEnforcementManager.afterProcess(response)             │
│                              │                                   │
│                    ┌─────────┼─────────┐                        │
│                    ▼         ▼         ▼                        │
│              ┌─────────┐ ┌────────┐ ┌──────────┐               │
│              │ Auto-   │ │ Update │ │ Validate │               │
│              │ Create  │ │ Task   │ │ Task     │               │
│              │ Tasks   │ │ Status │ │ Created  │               │
│              └─────────┘ └────────┘ └──────────┘               │
│                              │                                   │
│                         Response                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agent Config

Similar to brain-tiered memory config:

```json
{
  "memory": {
    "backend": "brain-tiered",
    "brainTiered": { "workspaceId": "..." }
  },
  "tasks": {
    "enabled": true,
    "backend": "oms",
    "oms": {
      "owner": "luna",
      "autoCreate": true,
      "injectPending": true
    }
  }
}
```

---

## TaskEnforcementManager Implementation

```typescript
// src/tasks/task-enforcement-manager.ts

export class TaskEnforcementManager {
  constructor(
    private config: TaskConfig,
    private db: PostgresClient,
  ) {}

  // Called BEFORE agent processes message
  async beforeProcess(message: string, context: AgentContext): Promise<AgentContext> {
    // 1. Load pending tasks from oms.tasks
    const pendingTasks = await this.getPendingTasks(this.config.owner);

    // 2. Inject into context (agent MUST see this)
    context.systemPrompt += this.formatTaskContext(pendingTasks);

    // 3. Detect if message is task-worthy
    const detection = this.detectTaskIntent(message);
    if (detection.shouldCreate) {
      context.taskDetection = detection;
    }

    return context;
  }

  // Called AFTER agent generates response
  async afterProcess(message: string, response: string, context: AgentContext): Promise<void> {
    // 1. Check if task was detected but not created
    if (context.taskDetection?.shouldCreate) {
      const taskCreated = this.responseCreatedTask(response);

      if (!taskCreated) {
        // AUTO-CREATE - agent missed it
        await this.createTask({
          title: context.taskDetection.suggestedTitle,
          category: context.taskDetection.category,
          description: message,
          source: "chat",
          auto_created: true,
          notes: "Auto-created by TaskEnforcementManager - agent did not create",
        });
      }
    }

    // 2. Update any task status mentioned in response
    await this.processTaskUpdates(response);
  }

  private detectTaskIntent(message: string): TaskDetection {
    // Keywords: "add feature", "bug", "should have", "need to", "create task"
    // Returns: { shouldCreate: boolean, category: string, suggestedTitle: string }
  }

  private async getPendingTasks(owner: string): Promise<Task[]> {
    return this.db.query(
      `
      SELECT * FROM oms.tasks
      WHERE owner = $1 AND status NOT IN ('accepted', 'rejected')
      ORDER BY priority DESC, started_at ASC
    `,
      [owner],
    );
  }
}
```

---

## Wiring into Agent Loop

Similar to how brain-tiered is wired into search-manager.ts:

```typescript
// src/agents/pi-embedded-runner.ts (or wherever agent loop is)

import { TaskEnforcementManager } from "../tasks/task-enforcement-manager";

async function processMessage(message: string, context: AgentContext) {
  const taskManager = new TaskEnforcementManager(config.tasks, db);

  // BEFORE - inject tasks, detect intent
  context = await taskManager.beforeProcess(message, context);

  // Agent processes (existing code)
  const response = await agent.process(message, context);

  // AFTER - auto-create missed tasks, update status
  await taskManager.afterProcess(message, response, context);

  return response;
}
```

---

## Files to Create

| File                                          | Purpose                                   |
| --------------------------------------------- | ----------------------------------------- |
| `database/migrations/008_task_management.sql` | Extend oms.tasks, create task_assignments |
| `src/config/types.tasks.ts`                   | Task config types                         |
| `src/tasks/task-enforcement-manager.ts`       | Main enforcement logic                    |
| `src/tasks/task-detection.ts`                 | Keyword/intent detection                  |
| `src/tasks/task-enforcement-manager.test.ts`  | Tests (TDD)                               |

---

## Query Examples

```sql
-- Tasks waiting for acceptance
SELECT * FROM oms.tasks WHERE status = 'acceptance';

-- What's Vulcan working on?
SELECT t.* FROM oms.tasks t
JOIN oms.task_assignments a ON t.task_id = a.task_id
WHERE a.agent_id = 'vulcan' AND a.status = 'in_progress';

-- All bugs we've fixed (with acceptance history)
SELECT * FROM oms.tasks
WHERE category = 'bug' AND status = 'accepted'
ORDER BY accepted_at DESC;

-- Task workflow status
SELECT t.title, a.agent_id, a.role, a.status
FROM oms.tasks t
JOIN oms.task_assignments a ON t.task_id = a.task_id
WHERE t.task_id = 'abc-123'
ORDER BY a.depends_on NULLS FIRST;

-- Luna's pending tasks
SELECT * FROM oms.tasks
WHERE owner = 'luna' AND status NOT IN ('accepted', 'rejected')
ORDER BY priority DESC, started_at ASC;
```

---

## Key Design Decisions

1. **Code-enforced, not instruction-based** - Agent cannot skip or forget
2. **Same pattern as brain-tiered memory** - Config-driven, wired into agent loop
3. **Auto-create missed tasks** - If Luna doesn't create, system does
4. **User acceptance required** - Tasks need Joe's approval to close
5. **Multi-agent support** - Parallel and sequential workflows
6. **Full history preserved** - Even completed tasks retrievable

---

## Related Files

- Brain-tiered memory design: `/Volumes/Dev_Hub/openclaw/docs/brain-integration/DESIGN.md`
- Brain-tiered implementation: `/Volumes/Dev_Hub/openclaw/docs/brain-integration/IMPLEMENTATION_PLAN.md`
- OMS feedback loop schema: `/Users/joechoa/Brain/database/migrations/007_feedback_loop.sql`

---

## Status

**Design Phase** - Not yet implemented

Next steps when ready:

1. Create migration `008_task_management.sql`
2. Build `TaskEnforcementManager`
3. Wire into agent loop
4. Test with Luna
5. Roll out to other agents if needed

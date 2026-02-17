# Dependency Map: command-queue.ts

**Generated:** 2026-02-16
**Source file:** `src/process/command-queue.ts`
**Purpose:** If we change the queue system, this document shows every file that could break.

---

## What command-queue.ts Does (Plain English)

`command-queue.ts` is the traffic cop for the entire bot. It makes sure that tasks (like replying to a message, running a cron job, or compacting a session) don't trample over each other. It uses "lanes" -- think of them like separate checkout lines at a store -- so different kinds of work can run side by side without interfering.

It exports six functions:

| Export | What It Does |
|--------|-------------|
| `enqueueCommandInLane(lane, task)` | Puts a task into a specific lane's queue. The task waits its turn, then runs. |
| `enqueueCommand(task)` | Shortcut -- puts a task into the "main" lane. |
| `setCommandLaneConcurrency(lane, max)` | Sets how many tasks can run at the same time in a lane. |
| `getQueueSize(lane)` | Returns how many tasks are waiting + running in a lane. |
| `getTotalQueueSize()` | Returns the total across ALL lanes. |
| `clearCommandLane(lane)` | Empties a lane's queue (used when aborting/interrupting). |

---

## What command-queue.ts Depends On (Its Own Imports)

These are the files that command-queue.ts itself needs to work:

| File | What It Provides |
|------|-----------------|
| `src/process/lanes.ts` | The `CommandLane` enum -- defines lane names: Main, Cron, Subagent, Nested |
| `src/logging/diagnostic.ts` | `diagnosticLogger`, `logLaneEnqueue`, `logLaneDequeue` -- logging/metrics when tasks enter and leave the queue |

Both are lightweight. `lanes.ts` is just 6 lines defining an enum. The diagnostic logger writes debug events but does not affect queue behavior.

---

## DIRECT Dependencies (Files That Import from command-queue.ts)

These files have an `import` statement that pulls directly from `command-queue.ts`. If you change the function signatures, return types, or behavior of the queue, these files WILL be affected.

### 1. Gateway Layer (Server Startup & Config Reload)

| File | What It Imports | What It Does With It |
|------|----------------|---------------------|
| `src/gateway/server-lanes.ts` | `setCommandLaneConcurrency` | Called at server startup. Sets how many tasks can run in each lane (Cron, Main, Subagent) based on config. |
| `src/gateway/server-reload-handlers.ts` | `setCommandLaneConcurrency` | Called when config is hot-reloaded. Re-applies lane concurrency limits without restarting. |

**Impact:** These two files control the concurrency limits. If you change how `setCommandLaneConcurrency` works, the server will start up or reload with wrong limits.

### 2. Agent Runner (The Core AI Engine)

| File | What It Imports | What It Does With It |
|------|----------------|---------------------|
| `src/agents/pi-embedded-runner/run.ts` | `enqueueCommandInLane` | The main AI agent runner. Every user message goes through here. It enqueues the actual LLM call into both a session-specific lane and a global lane (double-queued for safety). |
| `src/agents/pi-embedded-runner/compact.ts` | `enqueueCommandInLane`, `type enqueueCommand` | Session compaction (trimming old messages when context is full). Also double-enqueues into session + global lanes. Uses the type for parameter signatures. |
| `src/agents/pi-embedded-runner/run/params.ts` | `type enqueueCommand` | Type-only import. Defines the `enqueue` parameter type on `RunEmbeddedPiAgentParams` so callers can optionally override the queue function. |

**Impact:** These are the heart of the system. The agent runner uses `enqueueCommandInLane` to serialize every AI call. If you change the queue's promise behavior, timing, or lane resolution, every AI reply could break.

### 3. Auto-Reply Layer (Message Processing & Queue Management)

| File | What It Imports | What It Does With It |
|------|----------------|---------------------|
| `src/auto-reply/reply/get-reply-run.ts` | `clearCommandLane`, `getQueueSize` | Prepares each inbound message for the AI. Checks queue size to decide if an "interrupt" should clear pending work. Calls `clearCommandLane` to wipe a session's queue when interrupt mode is active. |
| `src/auto-reply/reply/queue/cleanup.ts` | `clearCommandLane` | Cleanup helper. Clears both the followup queue and the command lane for a session. Used during abort/stop operations. |

**Impact:** These files use the queue to implement interrupt mode (new message cancels pending work). If `clearCommandLane` or `getQueueSize` behavior changes, interrupt/abort logic breaks.

### 4. Infrastructure (Heartbeat Monitoring)

| File | What It Imports | What It Does With It |
|------|----------------|---------------------|
| `src/infra/heartbeat-runner.ts` | `getQueueSize` | The heartbeat system checks whether the main queue is busy before deciding to send a heartbeat. If the queue has work, heartbeat skips to avoid interfering. |

**Impact:** If `getQueueSize` returns wrong numbers, heartbeats could fire during busy periods or fail to fire during idle periods.

### 5. Test Files (Mock the Queue)

| File | What It Mocks |
|------|--------------|
| `src/process/command-queue.test.ts` | Direct unit tests for `enqueueCommand` and `getQueueSize`. |
| `src/auto-reply/reply/abort.test.ts` | Mocks `clearCommandLane` to test abort/interrupt behavior. |
| `src/agents/pi-embedded-runner/run.overflow-compaction.test.ts` | Mocks `enqueueCommandInLane` to test overflow compaction without real queuing. |

---

## DIRECT Dependencies on lanes.ts (The Lane Definitions)

`lanes.ts` defines the `CommandLane` enum used by command-queue.ts internally. These files also import `CommandLane` directly and would break if lane names change:

| File | What It Uses |
|------|-------------|
| `src/gateway/server-lanes.ts` | `CommandLane.Cron`, `CommandLane.Main`, `CommandLane.Subagent` for concurrency setup |
| `src/gateway/server-reload-handlers.ts` | Same as above, for hot-reload |
| `src/agents/lanes.ts` | Re-exports `CommandLane.Nested` and `CommandLane.Subagent` as `AGENT_LANE_NESTED` and `AGENT_LANE_SUBAGENT` |
| `src/agents/pi-embedded-runner/lanes.ts` | Uses `CommandLane.Main` as fallback in `resolveSessionLane` and `resolveGlobalLane` |
| `src/infra/heartbeat-runner.ts` | `CommandLane.Main` to check the main queue size |

---

## INDIRECT Dependencies (One Level Deeper)

These files do not import from command-queue.ts, but they import from files that DO. If queue behavior changes, the effects ripple through these files.

### Files that import from gateway files (server-lanes.ts / server-reload-handlers.ts)

| File | Chain | What It Does |
|------|-------|-------------|
| `src/gateway/server.impl.ts` | -> `server-lanes.ts` -> command-queue | The main server implementation. Calls `applyGatewayLaneConcurrency` at startup. |
| `src/gateway/server.impl.ts` | -> `server-reload-handlers.ts` -> command-queue | Also uses reload handlers for live config updates. |

### Files that import from agent runner (run.ts / compact.ts / params.ts)

| File | Chain | What It Does |
|------|-------|-------------|
| `src/agents/pi-embedded-runner.ts` | -> `run.ts`, `compact.ts`, `lanes.ts` -> command-queue | The barrel re-export file. Everything that uses the embedded agent goes through here. |

### Files that import from pi-embedded-runner.ts (the barrel file) -- these are TWO levels away

These 51 files use the embedded agent runner but do not directly touch the queue. They would be affected only if queue changes alter the timing, ordering, or error behavior of AI runs:

- `src/auto-reply/reply/agent-runner.ts` -- orchestrates AI replies
- `src/auto-reply/reply/agent-runner-execution.ts` -- handles execution flow
- `src/auto-reply/reply/followup-runner.ts` -- runs followup messages from the queue
- `src/auto-reply/reply/commands-session.ts` -- session management commands
- `src/auto-reply/reply/commands-compact.ts` -- compact command handler
- `src/auto-reply/reply/commands-subagents.ts` -- subagent command handler
- `src/auto-reply/reply/abort.ts` -- abort/stop logic
- `src/cron/isolated-agent/run.ts` -- cron job agent runner
- `src/commands/agent.ts` -- CLI agent command
- `src/commands/models/list.probe.ts` -- model probe command
- `src/hooks/llm-slug-generator.ts` -- hook-based LLM calls
- Plus ~40 test files for the above

### Files that import from agents/lanes.ts (AGENT_LANE_NESTED / AGENT_LANE_SUBAGENT)

| File | Chain | What It Does |
|------|-------|-------------|
| `src/commands/agent/delivery.ts` | -> `agents/lanes.ts` -> `process/lanes.ts` | Uses `AGENT_LANE_NESTED` for nested agent delivery. |
| `src/auto-reply/reply/commands-subagents.ts` | -> `agents/lanes.ts` -> `process/lanes.ts` | Uses `AGENT_LANE_SUBAGENT` for subagent spawning. |

### Files that import from queue/cleanup.ts

| File | Chain | What It Does |
|------|-------|-------------|
| `src/gateway/server-methods/sessions.ts` | -> `queue/cleanup.ts` -> command-queue | Server endpoint that clears session queues on demand. |

### Files that import from get-reply-run.ts

| File | Chain | What It Does |
|------|-------|-------------|
| `src/auto-reply/reply/get-reply.ts` | -> `get-reply-run.ts` -> command-queue | The top-level "get a reply" function that everything calls. |

### Files that import from heartbeat-runner.ts

| File | Chain | What It Does |
|------|-------|-------------|
| `src/gateway/server.impl.ts` | -> `heartbeat-runner.ts` -> command-queue | Server uses heartbeat runner. |
| `src/commands/health.ts` | -> `heartbeat-runner.ts` -> command-queue | Health check command. |
| `src/commands/status.summary.ts` | -> `heartbeat-runner.ts` -> command-queue | Status summary command. |
| `src/web/auto-reply.impl.ts` | -> `heartbeat-runner.ts` -> command-queue | Web interface auto-reply. |
| `src/gateway/server-cron.ts` | -> `heartbeat-runner.ts` -> command-queue | Cron service setup. |
| `src/gateway/server-close.ts` | -> `heartbeat-runner.ts` -> command-queue | Server shutdown. |
| `src/gateway/server-methods/system.ts` | -> `heartbeat-runner.ts` -> command-queue | System management endpoints. |

---

## Configuration Files That Affect Queue Behavior

The queue itself has no config file, but these configs control how lanes are set up:

| Config Area | What It Controls |
|-------------|-----------------|
| `config.agents.defaults.maxConcurrent` | How many AI tasks can run at once in the Main lane (default: 4) |
| `config.agents.defaults.subagents.maxConcurrent` | How many subagent tasks can run at once (default: 8) |
| `config.cron.maxConcurrentRuns` | How many cron tasks can run at once in the Cron lane (default: 1) |
| `config/types.queue.ts` | Defines `QueueMode` type: steer, followup, collect, steer-backlog, queue, interrupt |
| `config/agent-limits.ts` | Resolves the concurrency numbers from config with defaults |

---

## Dependency Tree (Text Diagram)

```
command-queue.ts
├── IMPORTS FROM:
│   ├── process/lanes.ts (CommandLane enum)
│   └── logging/diagnostic.ts (logLaneEnqueue, logLaneDequeue)
│
├── DIRECTLY IMPORTED BY:
│   ├── gateway/server-lanes.ts ──> gateway/server.impl.ts
│   ├── gateway/server-reload-handlers.ts ──> gateway/server.impl.ts
│   ├── agents/pi-embedded-runner/run.ts ──> agents/pi-embedded-runner.ts ──> (51 files)
│   ├── agents/pi-embedded-runner/compact.ts ──> agents/pi-embedded-runner.ts ──> (51 files)
│   ├── agents/pi-embedded-runner/run/params.ts (type only)
│   ├── auto-reply/reply/get-reply-run.ts ──> auto-reply/reply/get-reply.ts
│   ├── auto-reply/reply/queue/cleanup.ts ──> gateway/server-methods/sessions.ts
│   └── infra/heartbeat-runner.ts ──> (7 files)
│
├── lanes.ts DIRECTLY IMPORTED BY:
│   ├── gateway/server-lanes.ts
│   ├── gateway/server-reload-handlers.ts
│   ├── agents/lanes.ts ──> commands/agent/delivery.ts
│   │                    ──> auto-reply/reply/commands-subagents.ts
│   ├── agents/pi-embedded-runner/lanes.ts
│   └── infra/heartbeat-runner.ts
│
└── TEST FILES:
    ├── process/command-queue.test.ts
    ├── auto-reply/reply/abort.test.ts (mocks clearCommandLane)
    └── agents/pi-embedded-runner/run.overflow-compaction.test.ts (mocks enqueueCommandInLane)
```

---

## Blast Radius: If We Change the Queue, What MUST Be Checked

### CRITICAL (will definitely break if queue API changes)

1. **`src/agents/pi-embedded-runner/run.ts`** -- Every AI reply flows through here. Uses `enqueueCommandInLane` with double-lane pattern (session + global).
2. **`src/agents/pi-embedded-runner/compact.ts`** -- Session compaction uses same double-lane pattern.
3. **`src/auto-reply/reply/get-reply-run.ts`** -- Uses `getQueueSize` and `clearCommandLane` for interrupt mode.
4. **`src/gateway/server-lanes.ts`** -- Server startup lane configuration.
5. **`src/gateway/server-reload-handlers.ts`** -- Hot-reload lane configuration.

### HIGH (will likely break if queue behavior changes)

6. **`src/auto-reply/reply/queue/cleanup.ts`** -- Abort/cleanup depends on `clearCommandLane`.
7. **`src/infra/heartbeat-runner.ts`** -- Heartbeat timing depends on `getQueueSize`.
8. **`src/agents/pi-embedded-runner/run/params.ts`** -- Type definition references `enqueueCommand` type.
9. **`src/process/lanes.ts`** -- Lane definitions used by command-queue internally.

### MEDIUM (test files that mock the queue)

10. **`src/process/command-queue.test.ts`** -- Direct unit tests, must be updated.
11. **`src/auto-reply/reply/abort.test.ts`** -- Mocks `clearCommandLane`.
12. **`src/agents/pi-embedded-runner/run.overflow-compaction.test.ts`** -- Mocks `enqueueCommandInLane`.

### LOW (indirect -- only affected if queue timing/ordering changes ripple outward)

13. **`src/gateway/server.impl.ts`** -- Uses server-lanes and reload-handlers.
14. **`src/agents/pi-embedded-runner.ts`** -- Barrel re-export file.
15. **`src/agents/lanes.ts`** -- Re-exports lane constants.
16. **`src/agents/pi-embedded-runner/lanes.ts`** -- Lane resolution helpers.
17. **`src/auto-reply/reply/get-reply.ts`** -- Calls get-reply-run.
18. **`src/auto-reply/reply/agent-runner.ts`** -- Orchestrates agent runs.
19. **`src/config/agent-limits.ts`** -- Resolves concurrency numbers fed to the queue.
20. **`src/config/types.queue.ts`** -- Defines QueueMode types used by callers.

---

## Summary

**Total files with DIRECT imports from command-queue.ts:** 8 source files + 3 test files = **11 files**

**Total files with DIRECT imports from lanes.ts (queue's dependency):** 5 additional source files

**Total files INDIRECTLY affected (one level deeper):** ~20 source files + ~40 test files

**Total files that could be affected by a queue system change: ~76 files**

The most dangerous changes would be to:
- `enqueueCommandInLane` -- used by the core agent runner (every message)
- `clearCommandLane` -- used by interrupt/abort logic
- `getQueueSize` -- used by heartbeat and interrupt logic
- The `CommandLane` enum values -- used by 10 files for lane routing
- The promise/async behavior of enqueue -- the entire system depends on tasks resolving in order

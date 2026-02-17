# Known Queue & Lane Problems

**Generated:** 2026-02-16
**Scope:** Every queue, lane, priority, and message-ordering issue found in the OpenClaw/Clawdbot codebase.
**Purpose:** Feed the priority preemption feature design with a full picture of what is broken, fragile, or missing.

---

## How to Read This Document

Each issue is written in plain English. "Status" means:
- **OPEN** -- The problem still exists in the code today.
- **MITIGATED** -- A workaround exists, but the root cause is not fully fixed.
- **FIXED** -- The problem has been resolved.

Issues most relevant to the priority preemption feature are marked with **[PREEMPTION-RELEVANT]**.

---

## Category 1: No Priority System Exists At All

### 1.1 The queue is strictly FIFO -- no priority support **[PREEMPTION-RELEVANT]**

**Status:** OPEN

**What happens:** Every task goes into its lane's queue and waits its turn. There is no concept of "this message is more important" or "this task should jump ahead." A user's urgent message waits behind whatever got there first -- even if that earlier task is a low-priority cron heartbeat or a background compaction job.

**Where it lives:**
- `src/process/command-queue.ts` (lines 47-49): The `drainLane` function always does `state.queue.shift()` -- it pops from the front, strictly first-in, first-out. There is no sorting, no priority field, no reordering.
- The `QueueEntry` type (line 9) has no `priority` field at all.

**What causes it:** The queue was designed for simplicity -- serialize work to prevent collisions. Priority was never a design goal.

**Why it matters for preemption:** This is the #1 gap. To add preemption, we need to either:
- Add a priority field to `QueueEntry` and sort/insert accordingly, OR
- Add a separate "express lane" mechanism that bypasses the FIFO queue.

### 1.2 No preemption concept exists anywhere in the codebase **[PREEMPTION-RELEVANT]**

**Status:** OPEN

**What happens:** A search for "preempt" or "preemption" across the entire codebase returns zero results. There is no mechanism to pause a running task, cancel it in favor of a higher-priority one, or interrupt a lane mid-execution to let something else through.

**Where it lives:** Nowhere -- that is the problem. The closest thing is "interrupt" mode (see 2.1 below), but that is a blunt instrument that clears the entire queue rather than intelligently reordering.

**What causes it:** The queue system was built to prevent collisions, not to manage priority. The original design assumed all tasks are equally important.

---

## Category 2: Messages Getting Delayed

### 2.1 Messages wait behind long-running AI calls with no escape **[PREEMPTION-RELEVANT]**

**Status:** MITIGATED (but not solved)

**What happens:** When a user sends a message while the bot is already processing another message (e.g., a long tool-use chain), the new message sits in the session queue. The user sees no response until the current run finishes -- which can take 30-60+ seconds for complex tool chains.

**Where it lives:**
- `src/auto-reply/reply/agent-runner.ts` (lines 161-197): When `isActive` is true, the code either steers (injects into the running conversation) or queues a followup. There is no "cancel the current thing and handle this instead" path based on importance.
- `src/auto-reply/reply/get-reply-run.ts` (lines 328-332): The "interrupt" mode exists but it is a nuclear option -- it clears ALL pending work and aborts the current run. There is no selective interruption.

**Mitigations in place:**
- "Steer" mode injects the new message into the running conversation (but only works if the run is actively streaming -- see 2.2).
- "Collect" mode batches queued messages into a single followup turn (reduces wasted work, but still waits).
- Typing indicators fire immediately on enqueue so the user knows the bot received their message.

**What causes it:** The per-session lane has concurrency=1, so only one AI run can happen per session at a time. This is correct for preventing collisions, but means any new message must wait.

### 2.2 Steering only works when the agent is actively streaming **[PREEMPTION-RELEVANT]**

**Status:** OPEN

**What happens:** The "steer" mechanism (inject a message into a running conversation) only works when `isEmbeddedPiRunStreaming()` returns true. If the agent is active but not yet streaming (e.g., waiting for an API response, running a tool, or in the setup phase), steering silently fails and falls back to a followup queue.

**Where it lives:**
- `src/auto-reply/reply/agent-runner.ts` (lines 161-179): The `shouldSteer && isStreaming` check. If not streaming, the steer path is skipped entirely.
- `src/agents/pi-embedded-runner/runs.ts` (lines 21-37): `queueEmbeddedPiMessage` returns false if the run is not streaming or if it is compacting.

**What causes it:** Steering works by injecting a user message into the LLM's streaming context. This only makes sense when the LLM is actively generating tokens. During tool execution or API wait phases, there is no stream to inject into.

**Why it matters:** A user typing "/stop" or sending an urgent correction during a tool execution phase will not be steered -- it just queues up. This makes the bot feel unresponsive.

### 2.3 Debounce timer adds artificial delay to followup messages

**Status:** OPEN (by design, but can cause confusion)

**What happens:** When messages are queued for followup (in "collect" or "followup" mode), the system waits for a configurable debounce period (default: 1 second) of "quiet" before draining the queue. Every new message resets this timer.

**Where it lives:**
- `src/utils/queue-helpers.ts` (lines 54-71): `waitForQueueDebounce` keeps checking if enough time has passed since the last enqueue.
- `src/auto-reply/reply/queue/state.ts` (line 16): `DEFAULT_QUEUE_DEBOUNCE_MS = 1000`.

**What causes it:** Intentional design to batch rapid-fire messages (prevents "continue, continue" flooding). But for a single urgent message, this adds a full second of extra latency.

### 2.4 Cross-channel collected messages fall back to individual processing

**Status:** MITIGATED

**What happens:** When "collect" mode tries to batch messages but they came from different channels/threads, the system cannot safely merge them. It falls back to processing each one individually, which means multiple sequential agent runs instead of one batched run.

**Where it lives:**
- `src/auto-reply/reply/queue/drain.ts` (lines 24-61): The `hasCrossChannelItems` check. When it detects mixed routing, it sets `forceIndividualCollect = true` and processes messages one at a time.

**What causes it:** Reply routing is per-channel/thread. A collected batch can only go to one destination, so mixed-origin messages cannot be safely merged.

---

## Category 3: Tasks Blocking Each Other

### 3.1 Double-enqueue pattern creates nested lane dependencies **[PREEMPTION-RELEVANT]**

**Status:** OPEN (fragile by design)

**What happens:** Every AI agent run goes through TWO queues: first a per-session lane (e.g., `session:agent:main:whatsapp:+1234`), then a global lane (`main`). The session lane ensures only one run per conversation. The global lane caps total parallelism. But this means a task holds a session lane slot WHILE WAITING for a global lane slot.

**Where it lives:**
- `src/agents/pi-embedded-runner/run.ts` (lines 89-90): `return enqueueSession(() => enqueueGlobal(async () => { ... }))` -- the nested pattern.
- `src/agents/pi-embedded-runner/compact.ts` (lines 485-487): Same double-enqueue pattern for compaction.

**What causes it:** The double-enqueue is intentional -- it prevents two problems:
1. Session lane prevents concurrent runs on the same conversation (which would corrupt the session file).
2. Global lane prevents too many simultaneous LLM calls (rate limit protection).

**The risk:** If the global lane is full (e.g., `maxConcurrent=4` with 4 active runs), a new message's session lane slot is consumed but the task just sits waiting for a global slot. During this wait, the session lane is blocked -- no other work (including abort/interrupt) can enter that session. This is not technically a deadlock, but it is a head-of-line blocking problem.

**Why it matters for preemption:** A priority preemption system would need to handle this double-enqueue carefully. If a high-priority message jumps the global queue, it still needs its session slot. And we cannot just clear the session lane because the current task might be mid-execution.

### 3.2 Compaction can deadlock if called from within a lane **[PREEMPTION-RELEVANT]**

**Status:** MITIGATED

**What happens:** Session compaction uses the same double-enqueue pattern as regular runs. If compaction were called from within an already-running lane task, it would deadlock (trying to enqueue into a lane that is already at capacity, waiting for itself to finish).

**Where it lives:**
- `src/agents/pi-embedded-runner/compact.ts` (lines 105-108): Comment explicitly warns: "Use this when already inside a session/global lane to avoid deadlocks."
- Two separate functions exist: `compactEmbeddedPiSessionDirect` (no queueing, safe inside lanes) and `compactEmbeddedPiSession` (with queueing, safe outside lanes).

**Mitigation:** The codebase has two separate functions for this exact reason. But the naming convention is the only safeguard -- there is no runtime check that prevents calling the wrong one.

### 3.3 Heartbeats blocked by busy main lane

**Status:** MITIGATED

**What happens:** Heartbeat runs use the `main` lane. If the main lane is full (all `maxConcurrent` slots busy with user messages), heartbeats wait in line. This can cause missed heartbeat windows if user traffic is heavy.

**Where it lives:**
- `src/infra/heartbeat-runner.ts` (line 40): Imports `getQueueSize` and checks it before running a heartbeat.
- The heartbeat runner checks queue depth and skips if the queue is too busy, but this means heartbeats silently do not fire during high load.

**Mitigation:** The heartbeat runner checks `getQueueSize(CommandLane.Main)` and can skip if the queue is busy. But this means heartbeats are unreliable under load -- they just get dropped rather than being prioritized.

**Why it matters for preemption:** If we add priority, heartbeats should probably be low-priority (they can wait), while user messages should be high-priority (they should not wait behind heartbeats).

### 3.4 Cron jobs have their own lane but share the process

**Status:** OPEN (acceptable)

**What happens:** Cron jobs run in the `cron` lane (default concurrency: 1). They do not directly block the `main` lane. However, they share the same Node.js process, so heavy CPU work in a cron job could slow down everything.

**Where it lives:**
- `src/gateway/server-lanes.ts` (line 7): `setCommandLaneConcurrency(CommandLane.Cron, cfg.cron?.maxConcurrentRuns ?? 1)`.

**What causes it:** Lane separation only prevents queue-level collisions. It does not provide process-level isolation.

---

## Category 4: Commands Not Executing Immediately

### 4.1 /stop and /abort must wait for the queue like any other message **[PREEMPTION-RELEVANT]**

**Status:** OPEN

**What happens:** When a user sends "/stop" to abort a running task, the abort message enters the same inbound pipeline as any other message. If the session has a running task, the /stop message gets queued as a followup (in collect/followup mode) or steered (in steer mode). In steer mode, if the agent is not streaming, the /stop does not take effect immediately.

**Where it lives:**
- `src/auto-reply/reply/abort.ts`: The abort detection and processing logic.
- `src/auto-reply/reply/get-reply-run.ts` (lines 328-332): In "interrupt" mode, the code does clear the lane and abort -- but only if the queue mode is specifically "interrupt" (which is a legacy mode, not the default).

**What causes it:** Abort commands go through the same message processing pipeline as normal messages. There is no "fast path" for control commands.

**Why it matters for preemption:** Control commands like /stop, /abort, /new, /reset should be highest priority. They should never wait behind a regular message. This is one of the strongest arguments for adding a priority system.

### 4.2 Inline directives (/model, /think, /verbose) processed in-band

**Status:** OPEN (by design)

**What happens:** Commands like `/model`, `/think`, `/verbose` are parsed from the message body during the normal reply pipeline. They are not separate fast-path commands. This means they must wait for any currently-running task to finish before they take effect.

**Where it lives:**
- `src/auto-reply/reply/queue/directive.ts`: The `/queue` directive parser.
- `src/auto-reply/reply/get-reply-run.ts`: Where directives are processed during reply preparation.

**What causes it:** These directives are designed as inline modifications to the next AI run, not as standalone commands. They modify the run parameters rather than being separate actions.

### 4.3 Session reset (/new, /reset) goes through the full pipeline

**Status:** OPEN

**What happens:** When a user sends "/new" or "/reset", the command goes through the complete message processing pipeline, including session resolution, queue mode evaluation, and agent preparation. If a previous run is still active, the reset waits.

**Where it lives:**
- `src/auto-reply/reply/get-reply-run.ts` (lines 196-199): Bare `/new` and `/reset` detection happens after all the queue/session setup.

**What causes it:** Same as 4.1 -- all messages go through the same pipeline.

---

## Category 5: Queue Overflow and Data Loss

### 5.1 Queue cap drops messages with only summary preservation

**Status:** MITIGATED

**What happens:** Each session's followup queue has a cap (default: 20 messages). When the cap is exceeded, the oldest messages are dropped. In "summarize" mode, a one-line summary of each dropped message is preserved and injected as context. In "old" mode, dropped messages are lost entirely. In "new" mode, new messages are rejected.

**Where it lives:**
- `src/utils/queue-helpers.ts` (lines 33-52): `applyQueueDropPolicy` implements the drop logic.
- `src/auto-reply/reply/queue/state.ts` (lines 17-18): Defaults are `cap=20`, `drop=summarize`.

**What causes it:** Intentional design to prevent unbounded queue growth. But summary lines are truncated to 160 characters, so context can be lost.

### 5.2 clearCommandLane discards tasks without notification

**Status:** OPEN

**What happens:** When `clearCommandLane` is called (during interrupt mode or abort), all pending tasks in that lane are removed. Their promises are never resolved or rejected -- they are just abandoned. Any code `await`-ing those promises will hang forever.

**Where it lives:**
- `src/process/command-queue.ts` (lines 145-152): `clearCommandLane` sets `state.queue.length = 0` and returns the count, but does not resolve/reject the pending promises.

**What causes it:** The clear function was designed as a "drop everything" mechanism. It does not track the promises of queued entries to properly reject them.

**Why it matters for preemption:** If preemption involves canceling lower-priority tasks, we need a proper cancellation mechanism that rejects promises (with a distinguishable error) rather than leaving them dangling.

---

## Category 6: Observability and Debugging Gaps

### 6.1 Queue wait warnings are only logged, not surfaced to users

**Status:** OPEN

**What happens:** When a task waits more than 2 seconds (configurable via `warnAfterMs`), a warning is logged via the diagnostic logger and an `onWait` callback fires. But this information never reaches the end user -- they just see silence.

**Where it lives:**
- `src/process/command-queue.ts` (lines 51-56): The `warnAfterMs` threshold and diagnostic log.

**What causes it:** The queue is an internal process mechanism. The warning system was designed for operator debugging, not user feedback.

### 6.2 No way to inspect current queue state at runtime

**Status:** MITIGATED

**What happens:** While `getQueueSize` and `getTotalQueueSize` exist, there is no way to inspect what is actually in the queue (what tasks are waiting, how long they have been waiting, what lane they are in). The only observability is the total count.

**Where it lives:**
- `src/process/command-queue.ts` (lines 130-143): Only `getQueueSize` and `getTotalQueueSize` are exported.

**Mitigation:** Diagnostic logging records enqueue/dequeue events with timing, but this requires parsing log output -- there is no structured query API.

### 6.3 No metrics on queue throughput, wait times, or drop rates

**Status:** OPEN

**What happens:** There are no counters or histograms tracking how long tasks wait, how often the queue is full, or how often messages are dropped. The only signals are individual log lines.

**Where it lives:** Nowhere -- that is the problem. The diagnostic logger outputs individual events but does not aggregate them.

---

## Category 7: Design Limitations Relevant to Priority Preemption

### 7.1 Lane concurrency is global, not per-priority **[PREEMPTION-RELEVANT]**

**Status:** OPEN

**What happens:** The `maxConcurrent` setting applies to the entire lane regardless of task importance. If `main` is set to `maxConcurrent=4` and all 4 slots are taken by low-priority heartbeats, a high-priority user message still waits.

**Where it lives:**
- `src/process/command-queue.ts` (line 48): `while (state.active < state.maxConcurrent && state.queue.length > 0)`.
- `src/config/agent-limits.ts`: Defaults are Main=4, Subagent=8, Cron=1.

**What causes it:** The lane system was designed for isolation (different kinds of work in different lanes), not for priority within a lane.

### 7.2 No mechanism to pause or preempt a running task **[PREEMPTION-RELEVANT]**

**Status:** OPEN

**What happens:** Once a task starts executing (its promise is running), there is no way to pause it, preempt it, or tell it to yield. The only option is full abort (via `abortEmbeddedPiRun`), which kills the entire run rather than pausing it.

**Where it lives:**
- `src/agents/pi-embedded-runner/runs.ts` (lines 40-49): `abortEmbeddedPiRun` -- the only cancellation mechanism, and it is all-or-nothing.

**What causes it:** JavaScript/TypeScript promises do not support cooperative preemption. Once a task is running, it runs to completion (or throws). True preemption would require either:
- Cooperative yielding (tasks periodically check if they should pause)
- AbortController-based cancellation (tasks respect abort signals)

### 7.3 Session lane key is tied to session identity, not message importance **[PREEMPTION-RELEVANT]**

**Status:** OPEN

**What happens:** The session lane key is derived from the session key (e.g., `session:agent:main:whatsapp:+1234`). All messages for a session share the same lane regardless of content or urgency. A "/stop" command and a "tell me a joke" message compete for the same single-concurrency slot.

**Where it lives:**
- `src/agents/pi-embedded-runner/lanes.ts` (lines 3-6): `resolveSessionLane` just prefixes the key with `session:`.

**What causes it:** The lane system was designed around sessions, not around message types or urgency.

### 7.4 The `interrupt` mode is too destructive for general use **[PREEMPTION-RELEVANT]**

**Status:** OPEN

**What happens:** The only existing "preemption-like" feature is `interrupt` mode, which:
1. Clears the entire session command lane (all pending tasks dropped)
2. Aborts the currently running agent
3. Then runs the newest message

This is marked as "legacy" in the documentation and is not the default mode.

**Where it lives:**
- `src/auto-reply/reply/get-reply-run.ts` (lines 328-332): The interrupt implementation.
- `docs/concepts/queue.md` (line 27): Documented as `interrupt (legacy)`.

**What causes it:** Interrupt was the original handling before the more nuanced steer/collect/followup system was built. It works, but it destroys in-progress work rather than gracefully managing priority.

---

## Summary: Issues Most Relevant to Priority Preemption

| # | Issue | Severity |
|---|-------|----------|
| 1.1 | Queue is strictly FIFO, no priority field | Critical -- must be added |
| 1.2 | No preemption concept exists | Critical -- must be designed from scratch |
| 2.1 | Messages wait behind long-running AI calls | High -- the main user pain point |
| 2.2 | Steering only works during streaming | High -- creates gaps in responsiveness |
| 3.1 | Double-enqueue creates nested dependencies | High -- complicates any priority insertion |
| 3.2 | Compaction can deadlock in wrong context | Medium -- existing safeguard is naming-only |
| 4.1 | /stop waits in line like any message | High -- control commands should be instant |
| 5.2 | clearCommandLane leaves promises dangling | Medium -- cancellation needs proper rejection |
| 7.1 | Lane concurrency is global, not per-priority | High -- priority needs its own concurrency |
| 7.2 | No pause/preempt for running tasks | High -- true preemption needs new mechanism |
| 7.3 | Session lanes not aware of message type | Medium -- needs routing awareness |
| 7.4 | Interrupt mode is too destructive | Medium -- need a gentler alternative |

---

## Files Referenced

| File | Role |
|------|------|
| `src/process/command-queue.ts` | The core FIFO queue engine |
| `src/process/lanes.ts` | Lane name definitions (Main, Cron, Subagent, Nested) |
| `src/agents/pi-embedded-runner/run.ts` | AI agent runner with double-enqueue |
| `src/agents/pi-embedded-runner/compact.ts` | Session compaction with deadlock-aware variants |
| `src/agents/pi-embedded-runner/lanes.ts` | Session and global lane resolution |
| `src/agents/pi-embedded-runner/runs.ts` | Active run tracking, steer, abort |
| `src/auto-reply/reply/agent-runner.ts` | Reply orchestration, steer/followup decision |
| `src/auto-reply/reply/get-reply-run.ts` | Inbound message processing, interrupt mode |
| `src/auto-reply/reply/followup-runner.ts` | Followup message execution |
| `src/auto-reply/reply/queue/drain.ts` | Followup queue draining logic |
| `src/auto-reply/reply/queue/enqueue.ts` | Followup queue enqueue with dedup |
| `src/auto-reply/reply/queue/state.ts` | Followup queue state management |
| `src/auto-reply/reply/queue/types.ts` | Queue mode and settings types |
| `src/auto-reply/reply/queue/settings.ts` | Queue settings resolution |
| `src/auto-reply/reply/queue/cleanup.ts` | Session queue cleanup |
| `src/auto-reply/reply/queue/normalize.ts` | Queue mode normalization |
| `src/auto-reply/reply/queue/directive.ts` | /queue command parsing |
| `src/auto-reply/reply/abort.ts` | Abort/stop command handling |
| `src/utils/queue-helpers.ts` | Queue utility functions (debounce, drop, collect) |
| `src/config/agent-limits.ts` | Default concurrency limits |
| `src/gateway/server-lanes.ts` | Gateway lane concurrency setup |
| `src/gateway/server-reload-handlers.ts` | Hot-reload lane reconfiguration |
| `src/infra/heartbeat-runner.ts` | Heartbeat system (checks queue depth) |
| `docs/concepts/queue.md` | Queue design documentation |

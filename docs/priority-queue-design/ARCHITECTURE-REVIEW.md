# Architecture Review: Priority Preemption for OpenClaw/Clawdbot

**Date:** 2026-02-16
**Author:** Integration Reviewer
**Inputs:** MESSAGE-FLOW.md, KNOWN-PROBLEMS.md, DEPENDENCY-MAP.md, TEST-COVERAGE.md, APPROACH-EVALUATION.md, plus independent code review of 10+ source files.
**Audience:** Non-developer business owner

---

## The Big Picture: How Everything Connects

Think of Clawdbot as a restaurant. There is one entrance (the gateway server), several waiters (the channel adapters for WhatsApp, Telegram, Discord, etc.), a kitchen with a limited number of stoves (the lanes), and a head chef (the AI agent runner). Here is how a message travels through the restaurant, and where background tasks like heartbeats and cron jobs create bottlenecks.

### The Full Journey of a Message

1. **A human sends a message** on WhatsApp, Telegram, or any connected platform.

2. **The gateway server receives it.** This is the restaurant's front door. It runs continuously and listens on all channels at once.

3. **The channel adapter translates it.** Each platform speaks its own language. The adapter converts the raw message into a standardized internal format -- same structure whether it came from WhatsApp, Telegram, or Discord.

4. **The dispatch pipeline processes it.** The message goes through duplicate checking, plugin hooks, and routing logic. Then it checks if the message is a command (like /stop or /help). Commands get handled immediately without involving the AI.

5. **The queue mode decision happens.** This is the critical fork in the road. The system asks: "Is the AI already busy with this conversation?" If not, the message proceeds. If the AI IS busy, the system chooses one of several strategies (collect, steer, followup) based on configuration. This decision happens in `get-reply-run.ts`.

6. **The two-lock system kicks in.** Before the AI can start thinking, the message must pass through TWO separate lines:
   - **Lock 1 -- The Session Lane:** Each conversation has its own private lane. Only ONE thing can run per conversation at a time. This prevents the AI from talking to itself or corrupting its own memory.
   - **Lock 2 -- The Global Lane:** After getting the session lock, the message enters the global lane. This limits how many AI runs happen across ALL conversations simultaneously (default: 4). This prevents overwhelming the AI provider's API.

7. **The AI agent runs.** It reads conversation history, thinks about the message, possibly uses tools (running commands, searching the web), and generates a response.

8. **The reply goes back** through the same channel it came from.

9. **The followup queue drains.** If more messages were waiting (from step 5), they now get processed one at a time.

### Where Background Tasks Fit In

**Heartbeats** are scheduled self-checks (default: every 30 minutes). The bot reads a HEARTBEAT.md file and does whatever it says. Here is the critical detail that none of the other documents explicitly called out: **heartbeat runs share the `main` global lane with human messages.** The heartbeat runner checks if the main queue is busy before starting, and skips itself if there is work in the queue. But if a heartbeat starts first and THEN a human message arrives, the human message waits behind the heartbeat. The heartbeat does pass `isHeartbeat: true` through the pipeline, so the system KNOWS it is a heartbeat -- it just does not USE that information for priority or lane routing.

**Cron jobs** come in two flavors:
- **Isolated cron jobs** get their own session and pass `lane: "cron"` to the agent runner, which routes them to the dedicated cron global lane. These do NOT block the main lane.
- **Main-session cron jobs** trigger a heartbeat run on the main session. These go through the main lane just like human messages and CAN block them.

**Agent-to-agent messages** (subagents) use the `subagent` lane with higher concurrency (default: 8). These generally do not block human messages unless they share a session.

### The Two-Lock System: Why It Matters for Priority

The two-lock (session lane + global lane) design is elegant but creates a specific challenge for priority preemption:

- The session lane guarantees that only one AI run touches a conversation at a time. You CANNOT safely have two runs on the same conversation simultaneously -- the session file (the AI's memory) would get corrupted.

- The global lane limits total AI runs across all conversations. Even if a human message gets priority in the global lane, it still needs its session lock first.

- When a background task is running on a session, it holds BOTH locks. A human message for the same session cannot start until the background task releases both locks. This is the root of the blocking problem.

- When a background task is running on a DIFFERENT session, the human message only needs to wait for a global lane slot (if all are taken). The session lock is independent.

This means the blocking problem has two distinct cases:
1. **Same-session blocking:** A heartbeat or cron job is running on the same session as the human's conversation. The human MUST wait because of the session lock. The only escape is to abort the background task.
2. **Cross-session blocking:** Background tasks on other sessions are consuming all global lane slots. The human's session lock is free, but there is no global slot available. The fix here is simpler -- reserve a slot or bump priority.

---

## Where the Teammates' Findings Overlap, Conflict, or Reveal Something New

### Overlap: Everyone Agrees the Queue Is Simple and Unprioritized

All four documents confirm the same core finding: `command-queue.ts` is a 153-line FIFO queue with no priority concept. The Bug Hunter found zero results for "preempt" in the codebase. The Dependency Tracker confirmed the queue exports only six functions, none of which accept a priority parameter. The Test Auditor found only 3 tests for the core queue. The Approach Evaluator built all four approaches around this gap.

### Conflict: Heartbeat Lane Routing

The Message Flow document states: "Heartbeat runs go through the same lane system as regular messages." The Approach Evaluation document states: "Background tasks (cron, heartbeat) use the `main` lane." Both are correct, but they miss a nuance I found in the code:

**Isolated cron jobs pass `lane: "cron"` and DO get their own global lane.** But heartbeat runs (even cron-triggered heartbeats) call `getReplyFromConfig` without a lane parameter, which defaults them to `main`. The heartbeat runner DOES check `getQueueSize(CommandLane.Main)` before starting and skips if the queue is busy -- but this only prevents heartbeats from starting when the queue is already full. It does not help when a heartbeat starts first and a human message arrives during it.

This distinction matters because it means: **isolated cron jobs are already somewhat separated from human messages, but heartbeat runs are not.** Any solution should capitalize on this existing separation rather than reinventing it.

### Something None of Them Saw: The `isHeartbeat` Flag Is Already Threaded Through

My code review found that the `isHeartbeat` boolean is already passed through the entire reply pipeline:
- `heartbeat-runner.ts` passes `{ isHeartbeat: true }` to `getReplyFromConfig`
- `get-reply-run.ts` extracts it: `const isHeartbeat = opts?.isHeartbeat === true`
- It flows into `agent-runner.ts`, `agent-runner-execution.ts`, `typing-mode.ts`, and `followup-runner.ts`

This flag is currently used for two purposes: suppressing typing indicators during heartbeats, and stripping HEARTBEAT_OK tokens from replies. But it COULD be used as a source-type indicator for priority decisions -- without adding any new field to the pipeline. This is an "already paid for" mechanism that makes the priority feature cheaper to implement.

### Something Partially Seen: The `lane` Parameter Already Supports Routing

The Approach Evaluator noted that isolated cron jobs pass `lane: "cron"`, and the Bug Hunter documented that heartbeats share the main lane. But neither connected this to the solution: the `lane` parameter on `RunEmbeddedPiAgentParams` already exists and is optional. Today, human messages leave it undefined (defaulting to `main`). Cron isolated jobs set it to `"cron"`. This means the infrastructure for routing different run types to different global lanes ALREADY EXISTS. The missing piece is simply: when a run is a heartbeat, set `lane` to something other than `"main"`.

### The Dependency Tracker and Test Auditor Reveal the Same Risk

The Dependency Tracker found 76 files that could be affected by queue changes. The Test Auditor found only 3 tests for the core queue, with zero tests for `enqueueCommandInLane`, `setCommandLaneConcurrency`, or `clearCommandLane` against the real queue. Together, these paint a picture: **the queue is the most load-bearing and least tested part of the system.** Any changes to the queue itself carry high risk because there is almost no safety net to catch regressions.

---

## What the Bug Hunter Found That Matters Most

From the 12 issues documented in KNOWN-PROBLEMS.md, these are the five most relevant to adding priority preemption:

### 1. The Queue Is Strictly FIFO With No Priority Support (Issue 1.1)

The `drainLane` function always pops from the front of the array. There is no sorting, no priority field, no reordering. Every task waits its turn regardless of importance. This is the core gap that must be addressed.

**Why it matters:** Without this, a human message literally cannot jump ahead of a background task in the same lane.

### 2. Messages Wait Behind Long-Running AI Calls With No Escape (Issue 2.1)

When the AI is processing a complex request (running multiple tool calls, which can take 30-60+ seconds), any new message for that session sits in the followup queue until the current run finishes. There is no mechanism to say "this new message is from a human and should take priority."

**Why it matters:** This is the user-facing symptom of the problem. The human sends a message and gets silence while the AI finishes background work.

### 3. The Double-Enqueue Creates Nested Lane Dependencies (Issue 3.1)

Every AI run goes through TWO queues (session then global). A task holds its session lane slot WHILE WAITING for a global lane slot. This means the session is locked even when the task is not actually running yet -- it is just waiting in line.

**Why it matters:** This complicates any priority insertion. You cannot just bump a task in the global lane, because the session lane might also be blocked by the same background task waiting for its global slot.

### 4. /stop and /abort Wait in Line Like Any Other Message (Issue 4.1)

When a user sends "/stop" to cancel a stuck run, that abort command goes through the same pipeline as a regular message. If the session has a running task and is in collect/followup mode, the /stop gets queued as a followup. It does not take effect until the current run completes -- which defeats the purpose of aborting.

**Why it matters:** Control commands should be the highest priority. If we are adding priority, /stop should be the first thing to benefit.

### 5. clearCommandLane Leaves Promises Dangling (Issue 5.2)

When a lane is cleared (during interrupt or abort), all pending tasks are removed, but their promises are never resolved or rejected. Any code awaiting those promises will hang forever. This is a bug that would need to be fixed before building any cancellation mechanism for priority preemption.

**Why it matters:** If priority preemption involves canceling lower-priority tasks, we need those cancellations to be clean -- promises must be properly rejected so the system knows the task was canceled.

---

## Where We Have Safety Nets (and Where We Do Not)

Based on the Test Auditor's findings, here is an honest assessment of what is protected by tests and what is flying blind.

### We HAVE Safety Nets For:

- **Followup queue behavior:** 14 tests cover deduplication, routing, collect mode, and drop policies. If we change how followup messages are batched, these tests will catch regressions.
- **Abort/stop behavior:** 5 tests verify that /stop is recognized, that abort clears queues and stops subagents. However, these tests mock the queue rather than testing it for real.
- **Cron job lifecycle:** 18+ tests cover job scheduling, one-shot execution, error handling, and deduplication. Changes to cron lane routing should be caught.
- **Heartbeat utility functions:** ~17 tests cover token stripping and content detection. The heartbeat runner's queue-checking behavior is tested.

### We DO NOT Have Safety Nets For:

- **Lane-specific queuing:** Zero real tests for `enqueueCommandInLane`. Every test that uses it mocks it as a pass-through. We have no test that proves lanes actually work.
- **Concurrency configuration:** Zero tests for `setCommandLaneConcurrency`. We cannot verify that changing concurrency mid-flight behaves correctly.
- **Queue clearing:** The only test for `clearCommandLane` is via mock. We have no test that proves clearing a lane actually drops tasks.
- **Multi-lane concurrent execution:** Zero tests. We have no proof that tasks on different lanes actually run in parallel.
- **Error recovery:** Zero tests for what happens when a queued task throws. We do not know if the queue continues processing after a failure.
- **Human message + background task interaction:** Zero tests for the exact scenario we are trying to fix (human message arrives while cron/heartbeat is running).
- **FIFO ordering:** Ironically, while the queue IS FIFO, there is only one test that implicitly verifies ordering, and it uses the default main lane only.

### Bottom Line:

The areas we need to change (lane routing, priority within lanes, task cancellation) are the areas with the least test coverage. Before making ANY changes, we need to write baseline tests that prove the current behavior. Otherwise, we cannot tell whether our changes break something or fix something.

---

## The Blast Radius

Based on the Dependency Tracker's analysis, here is what could be affected if we change the queue system:

### Direct Impact: 11 Files

8 source files and 3 test files directly import from `command-queue.ts`. Any change to its function signatures, return types, or async behavior will immediately affect these files.

### High Impact: 9 Additional Files

Files that import from `lanes.ts` (the lane name definitions) or that depend on queue-adjacent behavior (gateway lane configuration, agent runner parameters, heartbeat queue checks).

### Indirect Impact: ~56 Additional Files

Files one or two import levels away from the queue. These would only be affected if queue changes alter the timing, ordering, or error behavior of AI runs. This includes about 40 test files.

### Total Potential Blast Radius: ~76 Files

However, the actual blast radius depends entirely on WHAT we change:

| Change Type | Files Affected | Risk |
|-------------|:-------------:|:----:|
| Add a new lane name to the enum | 1-2 | Very Low |
| Add a priority field to QueueEntry | 1 (queue itself) + tests | Low |
| Change how drainLane picks the next task | 1 (queue itself) + tests | Medium |
| Change function signatures on exports | 8-11 source + 3 test files | High |
| Change the double-enqueue pattern | 2 (run.ts, compact.ts) + 51 indirect | Very High |
| Change session lane behavior | 16+ files | Very High |

The safest changes are ones that ADD new capabilities to the queue without changing existing function signatures. The most dangerous changes are ones that alter the double-enqueue pattern or the session lane guarantee.

---

## Key Insight the Other Documents Missed

There is an elegant solution hiding in the existing architecture that none of the five documents fully connected:

**The system already has everything it needs to separate heartbeat runs from human messages -- it just does not connect the pieces.**

1. The `isHeartbeat` flag already flows through the entire pipeline.
2. The `lane` parameter already exists on agent run parameters.
3. Isolated cron jobs already use `lane: "cron"` to route to a separate global lane.
4. The heartbeat runner already checks queue size and skips when busy.

The simplest version of priority preemption is NOT a priority queue at all. It is lane-based source separation: heartbeat runs get routed to their own global lane (like cron jobs already are), and the main lane is reserved for human messages. No priority field needed. No queue reordering needed. No preemption mechanism needed. The existing lane system already supports this -- we just need to wire it up.

For the same-session case (heartbeat and human share a session), the abort mechanism already exists. The missing piece is detecting "a human message arrived while a background task is running on this session" and automatically aborting the background task -- which the `isHeartbeat` flag makes easy to detect.

This is simpler than any of the four approaches evaluated in APPROACH-EVALUATION.md, because it uses existing infrastructure rather than building new mechanisms.

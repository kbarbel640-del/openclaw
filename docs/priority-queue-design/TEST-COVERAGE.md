# Test Coverage Audit: Queue, Sessions, Lanes & Command Execution

> Generated: 2026-02-16
> Auditor: Test Auditor (research-only)
> Framework: Vitest 4.0.18 (pool: forks, timeout: 120s)
> Config: `/vitest.config.ts`

---

## How To Read This Document

This document catalogs every existing test related to the **command queue**, **lanes**,
**sessions**, **command execution**, **followup queue**, **auto-reply pipeline**, **cron
execution**, and **heartbeat** systems. Each test file is listed with plain-English
descriptions of what every test case checks. A **GAPS** section at the end identifies
what is _not_ tested and what tests should exist before making changes.

---

## Test Framework Configuration

| Setting | Value |
|---------|-------|
| Framework | Vitest |
| Pool | `forks` |
| Test timeout | 120 000 ms (120 s) |
| Hook timeout | 120 000 ms (180 s on Windows) |
| Workers (local) | max(4, min(16, cpu_count)) |
| Workers (CI) | 3 (2 on Windows) |
| Test globs | `src/**/*.test.ts`, `extensions/**/*.test.ts`, `test/format-error.test.ts` |
| Excluded | `*.live.test.ts`, `*.e2e.test.ts`, `dist/**`, `node_modules/**` |
| Coverage tool | V8 |
| Coverage thresholds | 70% lines, 70% functions, 55% branches, 70% statements |

**Notable coverage exclusions:** `src/commands/**` is explicitly excluded from coverage
reporting. This means the agent command tests run but do not count toward coverage
metrics.

---

## 1. Command Queue (`src/process/command-queue.ts`)

### Source File Overview

The core queue implementation. Maintains a `Map<string, LaneState>` where each lane has
its own task array, active-task count, and configurable `maxConcurrent`. Key exports:

- `enqueueCommand(task, label?, log?)` -- queues on the default Main lane
- `enqueueCommandInLane(lane, task, label?, log?)` -- queues on a named lane
- `clearCommandLane(lane)` -- drops all pending tasks in a lane
- `setCommandLaneConcurrency(lane, n)` -- sets max parallel tasks per lane
- `getQueueSize(lane)` / `getTotalQueueSize()` -- diagnostics

### Test File: `src/process/command-queue.test.ts`

**3 tests total.**

| # | Test Name | What It Checks |
|---|-----------|----------------|
| 1 | "runs tasks one at a time in order" | Three tasks queued on the default (Main) lane execute sequentially in FIFO order. Verifies serial execution and correct ordering. |
| 2 | "logs enqueue depth after push" | When a task is queued while another is running, the logger receives a diagnostic message showing the current queue depth. |
| 3 | "invokes onWait callback when a task waits past the threshold" | If a task sits in the queue longer than the configured threshold, the `onWait` callback fires with the label and wait duration. |

**What is NOT tested here:**
- `enqueueCommandInLane` (lane-specific queuing) -- zero tests
- `setCommandLaneConcurrency` -- zero tests
- `clearCommandLane` -- zero tests (only mocked elsewhere)
- `getQueueSize` / `getTotalQueueSize` -- zero tests
- Multi-lane concurrent execution -- zero tests
- Error propagation when a queued task throws -- zero tests
- Queue behavior when maxConcurrent > 1 -- zero tests

---

## 2. Lanes (`src/process/lanes.ts`)

### Source File Overview

Defines the `CommandLane` enum:
```
Main = "main"
Cron = "cron"
Subagent = "subagent"
Nested = "nested"
```

### Test Coverage

**Zero dedicated tests.** The lane enum is consumed by other modules but never tested
in isolation. There are no tests verifying lane values or exhaustiveness.

---

## 3. Gateway Lane Configuration (`src/gateway/server-lanes.ts`)

### Source File Overview

`applyGatewayLaneConcurrency(cfg)` reads configuration and calls
`setCommandLaneConcurrency` for the Cron, Main, and Subagent lanes with values from the
config (defaulting to 1).

### Test Coverage

**Zero tests.** This function is not tested anywhere in the codebase. There are no
tests verifying that config values are correctly translated to lane concurrency settings.

---

## 4. Session Lane Resolution (`src/agents/pi-embedded-runner/lanes.ts`)

### Source File Overview

Maps session keys to lane names like `session:<key>`, enabling parallel execution of
different sessions on separate lanes.

### Test Coverage

**Zero dedicated tests.** Session lane resolution is used in production code but the
mapping function itself is not directly tested.

---

## 5. Followup Queue (Auto-Reply Pipeline)

### Test File: `src/auto-reply/reply.queue.test.ts`

**2 tests total.**

| # | Test Name | What It Checks |
|---|-----------|----------------|
| 1 | "collects queued messages and drains after run completes" | When a message arrives while the agent is busy, it is held in "collect" mode. After the agent finishes, collected messages are drained and processed. Verifies debounce behavior. |
| 2 | "summarizes dropped followups when cap is exceeded" | When too many messages queue up (exceeding the cap), the system drops extras and produces a summary notification. Tests the "summarize" drop policy. |

**What is NOT tested here:**
- "followup" mode (individual processing) -- tested indirectly in followup-runner
- Queue interaction with command-queue lanes
- Queue behavior when lane is cleared mid-collection

---

### Test File: `src/auto-reply/reply/queue.collect-routing.test.ts`

**7 tests total.**

| # | Test Name | What It Checks |
|---|-----------|----------------|
| 1 | "deduplicates Discord messages by message_id" | Two messages with the same Discord message_id are treated as one. |
| 2 | "deduplicates exact prompt when routing matches" | Messages with identical text going to the same destination are deduped. |
| 3 | "does not dedup across providers" | A message from Telegram and one from Discord with the same text are NOT deduped. |
| 4 | "opt-in prompt-based dedup" | When prompt-dedup is enabled, identical prompts are collapsed. |
| 5 | "no dedup when prompt-based dedup is off" | With the flag off, identical prompts are kept separate. |
| 6 | "does not collect when destinations differ" | Messages headed for different channels are not batched together. |
| 7 | "collects when channel and destination match" | Messages going to the same channel+destination are correctly batched. |

---

### Test File: `src/auto-reply/reply/followup-runner.test.ts`

**5 tests total.**

| # | Test Name | What It Checks |
|---|-----------|----------------|
| 1 | "auto-compaction notice and tracking" | When context compaction kicks in, the followup runner tracks it. |
| 2 | "drops payloads already sent via messaging tool" | If the messaging tool already delivered a response, the followup runner skips it. |
| 3 | "delivers payloads when not duplicates" | Normal (non-duplicate) payloads are delivered. |
| 4 | "suppresses replies when messaging tool sent via same provider+target" | Avoids double-sending when the messaging tool already sent to the same target. |
| 5 | "persists usage even when replies suppressed" | Token usage is recorded even when the reply itself is suppressed. |

---

## 6. Abort / Stop System

### Test File: `src/auto-reply/reply/abort.test.ts`

**5 tests total.**

| # | Test Name | What It Checks |
|---|-----------|----------------|
| 1 | "triggerBodyNormalized extracts /stop from RawBody" | In group chats, `/stop` is correctly extracted from raw message bodies. |
| 2 | "isAbortTrigger matches bare word triggers" | Various abort keywords ("stop", "cancel", etc.) are recognized. |
| 3 | "fast-aborts even when text commands are disabled" | The `/stop` command works even when text commands are turned off. |
| 4 | "fast-abort clears queued followups and session lane" | Aborting clears the followup queue AND calls `clearCommandLane` for the session lane. This is the ONLY test that exercises `clearCommandLane`, and it does so via a mock. |
| 5 | "fast-abort stops active subagent runs for requester session" | When a session has running subagents, abort cascades to stop them too. |

**Important note:** Test #4 mocks `clearCommandLane` rather than testing it against the
real queue. This means the abort-to-queue integration is not truly verified.

---

## 7. Agent Command Execution

### Test File: `src/commands/agent.test.ts`

**12+ tests total.**

| # | Test Name | What It Checks |
|---|-----------|----------------|
| 1 | "creates a new session when none exists" | The `/agent` command starts a new session if no existing session matches. |
| 2 | "resumes an existing session by key" | Providing a session key resumes the correct prior session. |
| 3 | "thinking flag passes through to agent options" | `--thinking` flag is forwarded to the agent runner. |
| 4 | "verbose flag passes through to agent options" | `--verbose` flag is forwarded to the agent runner. |
| 5 | "emits agent events correctly" | Session events (start, progress, end) are emitted. |
| 6 | "selects model from flag" | The `--model` flag overrides the default model. |
| 7 | "session key handling" | Session keys are normalized and stored correctly. |
| 8 | "agent ID routing" | Different agent IDs route to different agent configurations. |
| 9 | "delivery to channel" | Agent output is delivered to the originating channel. |
| 10 | "handles agent errors gracefully" | When the agent throws, the error is caught and reported. |
| 11 | "respects maxTurns configuration" | Turn limits are enforced. |
| 12 | "passes lane parameter as nested" | The agent command passes `lane: "nested"` to the agent runner. |

**Note:** These tests mock the agent runner and gateway. They verify that the command
_wiring_ is correct but do not test how agent execution interacts with the command queue.

---

## 8. Session Tools

### Test File: `src/agents/clawdbot-tools.sessions.test.ts`

**7+ tests total.**

| # | Test Name | What It Checks |
|---|-----------|----------------|
| 1 | "sessions_list returns active sessions" | The tool lists all active sessions. |
| 2 | "sessions_list returns empty when no sessions" | Returns empty array when nothing is active. |
| 3 | "sessions_history returns session history" | Past session interactions are retrievable. |
| 4 | "sessions_send delivers message to session" | Sending a message to a session works. |
| 5 | "sessions_send fails for unknown session" | Sending to a nonexistent session returns an error. |
| 6 | "uses nested lane for session tools" | Session tool calls specify `lane: "nested"`. |
| 7 | "session key normalization" | Session keys are trimmed and lowercased consistently. |

---

## 9. Heartbeat System

### Test File: `src/auto-reply/heartbeat.test.ts`

**~15 tests total.** These test the `stripHeartbeatToken` utility function:

- Stripping `[HEARTBEAT]` tokens from various positions in text
- Detecting empty content after token removal
- Handling edge cases (multiple tokens, tokens in code blocks, whitespace)
- Preserving non-token content

**These are pure utility tests.** They do not test heartbeat interaction with the queue
or lanes.

### Test File: `src/auto-reply/reply.heartbeat-typing.test.ts`

**2 tests total.**

| # | Test Name | What It Checks |
|---|-----------|----------------|
| 1 | "typing indicator starts for normal runs" | Typing indicator fires when the agent starts a normal turn. |
| 2 | "typing indicator does NOT start for heartbeat runs" | Typing indicator is suppressed during heartbeat-only turns. |

---

## 10. Cron Execution

### Test File: `src/cron/service.runs-one-shot-main-job-disables-it.test.ts`

**10+ tests total.**

| # | Test Name | What It Checks |
|---|-----------|----------------|
| 1 | "runs a one-shot main job and disables it after success" | A one-shot job fires, calls `enqueueSystemEvent`, then gets disabled. |
| 2 | "runs a one-shot job and deletes it after success when requested" | With `deleteAfterRun: true`, the job is removed entirely. |
| 3 | "wakeMode now waits for heartbeat completion when available" | When `runHeartbeatOnce` is provided, the cron job uses it instead of `requestHeartbeatNow`. |
| 4 | "runs an isolated job and posts summary to main" | Isolated jobs call `runIsolatedAgentJob` and post their summary to main via `enqueueSystemEvent`. |
| 5 | "migrates legacy payload.provider to payload.channel on load" | Old job format with `provider` field is migrated to `channel`. |
| 6 | "canonicalizes payload.channel casing on load" | `"Telegram"` is lowercased to `"telegram"`. |
| 7 | "posts last output to main even when isolated job errors" | On error, the last output is still posted as `"Cron (error): ..."`. |
| 8 | "rejects unsupported session/payload combinations" | Main+agentTurn and isolated+systemEvent combos are rejected. |
| 9 | "skips invalid main jobs with agentTurn payloads from disk" | Invalid combos loaded from disk are skipped (not crashed). |

### Test File: `src/cron/service.skips-main-jobs-empty-systemevent-text.test.ts`

**4 tests total.**

| # | Test Name | What It Checks |
|---|-----------|----------------|
| 1 | "skips main jobs with empty systemEvent text" | Jobs with whitespace-only text are skipped and marked `"skipped"`. |
| 2 | "does not schedule timers when cron is disabled" | With `cronEnabled: false`, no timers fire. |
| 3 | "status reports next wake when enabled" | `cron.status()` returns the correct next wake time. |

### Test File: `src/cron/service.prevents-duplicate-timers.test.ts`

**1 test total.**

| # | Test Name | What It Checks |
|---|-----------|----------------|
| 1 | "avoids duplicate runs when two services share a store" | Two CronService instances pointing at the same store file only run the job once. |

### Test File: `src/cron/schedule.test.ts`

**4 tests total.**

| # | Test Name | What It Checks |
|---|-----------|----------------|
| 1-4 | Schedule computation tests | Verifies `nextRunAtMs` calculations for cron expressions and `every` intervals. |

### Test File: `src/cron/cron-protocol-conformance.test.ts`

**2 tests total.**

| # | Test Name | What It Checks |
|---|-----------|----------------|
| 1-2 | Protocol conformance | Verifies cron job payloads conform to the expected protocol schema. |

---

## 11. Block Streaming

### Test File: `src/auto-reply/reply.block-streaming.test.ts`

**5 tests total.**

| # | Test Name | What It Checks |
|---|-----------|----------------|
| 1 | "streams blocks in order" | Streamed content blocks arrive in the correct sequence. |
| 2 | "falls back to single reply on timeout" | If streaming times out, a single consolidated reply is sent. |
| 3 | "handles provider-specific block limits" | Different providers have different max block sizes. |
| 4-5 | Additional edge cases | Empty blocks, partial blocks, and interleaved content. |

---

## 12. Process / Spawn Utilities

### Test File: `src/process/exec.test.ts`

**2 tests total.**

| # | Test Name | What It Checks |
|---|-----------|----------------|
| 1 | "executes command and returns output" | Basic command execution works. |
| 2 | "respects timeout" | Commands that exceed their timeout are killed. |

### Test File: `src/process/spawn-utils.test.ts`

**2 tests total.**

| # | Test Name | What It Checks |
|---|-----------|----------------|
| 1 | "retries on EBADF using fallback options" | When `spawn` fails with EBADF, it retries with fallback stdio options. |
| 2 | "does not retry on non-EBADF errors" | ENOENT and other errors are not retried. |

---

## 13. Delivery Retry

### Test File: `test/auto-reply.retry.test.ts`

**2 tests total.**

| # | Test Name | What It Checks |
|---|-----------|----------------|
| 1 | "retries text delivery on transient failure" | Text message delivery is retried on transient errors. |
| 2 | "retries media delivery on transient failure" | Media delivery is retried on transient errors. |

---

## 14. Overflow Compaction (Mocks Queue)

### Test File: `src/agents/pi-embedded-runner/run.overflow-compaction.test.ts`

This test file **mocks** `enqueueCommandInLane` as a pass-through:
```typescript
vi.fn((_lane: string, task: () => unknown) => task())
```

It tests context-overflow compaction logic, not queue behavior. The mock means
`enqueueCommandInLane` is exercised in production code but its actual queuing behavior
is bypassed in tests.

---

## GAPS -- What Is NOT Tested

### Critical Gap 1: Lane-Specific Queuing

**`enqueueCommandInLane` has zero real tests.** It is used in 6+ production files but is
only ever mocked in test files. No test verifies that:
- Tasks queued on different lanes can run concurrently
- Tasks queued on the same lane execute serially
- Lane names are handled correctly (typos, casing, empty strings)

### Critical Gap 2: Lane Concurrency Configuration

**`setCommandLaneConcurrency` has zero tests.** No test verifies that:
- Setting `maxConcurrent` to 2+ allows parallel execution within a lane
- Setting `maxConcurrent` to 1 enforces serial execution
- Changing concurrency mid-flight affects already-queued tasks
- `applyGatewayLaneConcurrency` correctly translates config values

### Critical Gap 3: Queue Clearing

**`clearCommandLane` is only tested via mock.** The abort test (abort.test.ts #4)
verifies that `clearCommandLane` is _called_ but not that it _works_. No test verifies:
- Clearing a lane drops all pending tasks
- Clearing a lane does not affect the currently running task
- Clearing a lane does not affect other lanes
- Clearing a non-existent lane is safe

### Critical Gap 4: Priority / Ordering

**Zero tests for priority ordering.** The current queue is FIFO within a lane. If
priority-based ordering is added, there are no baseline tests to verify the current
FIFO behavior is preserved or intentionally changed. No test verifies:
- Tasks execute in insertion order
- No starvation occurs under load
- Priority values (if added) affect execution order

### Critical Gap 5: Lane Preemption

**Zero tests for lane preemption.** There is no test verifying that:
- A human message on the Main lane can interrupt or preempt a Cron job
- Subagent lane tasks yield to Main lane tasks
- Priority between lanes is respected

### Critical Gap 6: Human Interrupts Background Tasks

**Zero tests for the scenario where a user sends a message while a cron job or
subagent is running.** This is a key real-world scenario. No test verifies:
- What happens when a human message arrives during a cron execution
- Whether the human message waits, preempts, or runs on a parallel lane
- Whether abort (`/stop`) during a cron run works correctly

### Critical Gap 7: Queue Behavior Under Load

**Zero stress or load tests.** No test verifies:
- Queue behavior with 10+ tasks queued
- Memory behavior with large queues
- Timing behavior under contention
- Whether the `onWait` callback fires correctly under real load

### Critical Gap 8: Error Recovery in the Queue

**Zero error recovery tests.** The command-queue tests do not verify:
- What happens when a queued task throws an exception
- Whether the queue continues processing after a task error
- Whether errors in one lane affect other lanes
- Whether `drainLane` recovers after an exception

### Critical Gap 9: Cron + Human Message Interaction

**Zero tests for cron jobs interacting with human messages.** No test verifies:
- Whether a cron-triggered `enqueueSystemEvent` + `requestHeartbeatNow` conflicts
  with an in-progress human conversation
- What happens when cron fires during an active agent turn
- Whether cron jobs on the Cron lane truly run independently of Main

### Critical Gap 10: Session State During Queue Operations

**Zero tests for session state consistency during queue operations.** No test verifies:
- Session state is preserved when tasks are queued and dequeued
- Session lane mapping (`session:<key>`) works end-to-end with the command queue
- Multiple sessions queuing on different lanes operate independently

---

## Summary

**~65 tests found** across 18 test files covering queue, session, lane, command
execution, auto-reply, cron, and heartbeat behavior.

**Coverage by area:**

| Area | Test Count | Coverage Level |
|------|-----------|----------------|
| Command Queue (core) | 3 | Minimal -- Main lane only |
| Lanes (enum + config) | 0 | None |
| Gateway Lane Config | 0 | None |
| Session Lane Resolution | 0 | None |
| Followup Queue | 14 | Good -- dedup, routing, collect, drop |
| Abort / Stop | 5 | Moderate -- mocks queue clearing |
| Agent Command | 12+ | Good -- wiring and options |
| Session Tools | 7+ | Good -- CRUD and nested lane |
| Heartbeat | ~17 | Good -- utility functions |
| Cron Service | 18+ | Good -- job lifecycle |
| Block Streaming | 5 | Moderate |
| Process / Spawn | 4 | Minimal |
| Delivery Retry | 2 | Minimal |

**Key gaps (in priority order for pre-change testing):**

1. `enqueueCommandInLane` -- zero real tests (mocked everywhere)
2. `setCommandLaneConcurrency` -- zero tests
3. `clearCommandLane` -- only tested via mock
4. Multi-lane concurrent execution -- zero tests
5. Error recovery in the queue -- zero tests
6. Human message + cron/subagent interaction -- zero tests
7. Priority ordering baseline -- zero tests
8. Gateway lane configuration application -- zero tests

---

## Recommendations Before Making Changes

Before modifying the queue, lane, or session systems, the following tests should be
written to establish a safety net:

1. **Lane isolation tests:** Verify that tasks on Lane A and Lane B can run concurrently,
   and tasks within the same lane run serially. This is the most critical missing test.

2. **Concurrency configuration tests:** Verify that `setCommandLaneConcurrency(lane, 2)`
   allows 2 parallel tasks on that lane, and that changing it mid-flight behaves
   predictably.

3. **clearCommandLane integration test:** Test against the real queue (not a mock) that
   clearing a lane drops pending tasks without affecting running tasks or other lanes.

4. **Error propagation test:** Queue a task that throws. Verify the error propagates to
   the caller and the queue continues processing remaining tasks.

5. **Queue size diagnostics tests:** Verify `getQueueSize` and `getTotalQueueSize`
   return correct values as tasks are added, run, and complete.

6. **Session lane mapping test:** Verify that `session:<key>` lane names work correctly
   with `enqueueCommandInLane` and that different sessions truly get different lanes.

7. **FIFO baseline test:** Explicitly verify insertion-order execution within a lane as
   a regression guard before adding any priority logic.

These 7 test suites would cover the most dangerous gaps and provide a safety net for
any queue or lane architecture changes.

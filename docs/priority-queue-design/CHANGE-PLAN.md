# Change Plan: Priority Preemption for Human Messages

**Date:** 2026-02-16
**Author:** Integration Reviewer
**Based On:** ARCHITECTURE-REVIEW.md, MESSAGE-FLOW.md, KNOWN-PROBLEMS.md, DEPENDENCY-MAP.md, TEST-COVERAGE.md, APPROACH-EVALUATION.md, plus independent code review.
**Audience:** Non-developer business owner

---

## The Approach: "Lane Separation + Selective Abort"

After reviewing all five teammate documents and reading the code myself, I am NOT recommending any of the four approaches from APPROACH-EVALUATION.md in their original form. Instead, I am proposing a hybrid that is simpler than all of them, based on a key discovery: **the infrastructure for separating human messages from background tasks already exists in the codebase -- it just is not wired up.**

### The Core Idea (Plain English)

Today, human messages and heartbeat runs share the same highway lane. When a heartbeat is using the road, humans have to wait behind it.

The fix has three parts:

1. **Give heartbeats their own lane** so they stop sharing the road with humans. (Cron jobs already have their own lane -- heartbeats should too.)

2. **When a human message arrives for a session that is busy with a heartbeat, automatically abort the heartbeat** and let the human go first. The heartbeat will run again at the next scheduled interval -- nothing is lost.

3. **Wrap it all behind a config toggle** so existing users are not affected unless they opt in.

This approach avoids all the dangerous complexity of checkpoint/resume, parallel session access, or queue reordering. It uses mechanisms that already exist in the code (lane routing, abort, isHeartbeat flag) and connects them in a new way.

### Why This Is Better Than the Four Evaluated Approaches

| Approach | Problem | This Plan Avoids It |
|----------|---------|-------------------|
| A: Checkpoint & Resume | LLMs cannot truly pause and resume mid-run | Yes -- we abort and re-run later, no checkpoint needed |
| B: Notification + Wait | Does not actually solve the problem, just makes waiting polite | Yes -- we eliminate the wait entirely for same-session conflicts |
| C: Parallel Lanes | Two runs on the same session corrupt the session file | Yes -- we abort the background run first, so only one runs at a time |
| D: Hybrid | Combines all the complexity of A + B | Yes -- we achieve the same result with much less complexity |
| Modified A: Abort + Re-run | Close to what we propose, but does not leverage existing lane separation | We build on this idea but add lane separation to prevent the conflict in most cases |

### What the APPROACH-EVALUATION.md Got Right and Wrong

**Right:** The recommendation to build Approach B (Notification) first as a quick win is sound -- and we include it as Phase 1 of our plan. The "Modified A" (abort + re-run) is also close to what we propose for Phase 3. The identification of the per-session lock as "sacred" is absolutely correct.

**Wrong:** The evaluation missed that heartbeat runs could simply be moved to their own lane, which solves the cross-session blocking case without any queue modifications at all. It also missed that the `isHeartbeat` flag already threads through the entire pipeline, making detection trivially easy. The evaluation treated all four approaches as requiring changes to the queue itself -- but the best first step does not touch the queue at all.

---

## The Plan: Three Phases

Each phase is independently testable and shippable. You can stop after any phase and have a working improvement.

---

## Phase 1: Add the Config Toggle + Notification (The Quick Win)

**Goal:** Add the `priorityPreemption` config option and send an acknowledgment to humans who are waiting behind background tasks. This phase changes the least code, creates the detection infrastructure, and gives immediate UX improvement.

### Change 1.1: Add the Config Toggle

**File:** `src/config/types.messages.ts`
**What changes:** Add a new optional field `priorityPreemption` to the existing `QueueConfig` type.
**In plain English:** We are adding a new on/off switch to the configuration file. When turned on, the system will start treating human messages differently from background tasks. When turned off (the default), everything works exactly as it does today.

**What could break:** Nothing. This is adding a new optional field with a default of `false`. No existing configuration changes.

**How to test:** Load a config file with `messages.queue.priorityPreemption: true` and verify it parses without error. Load a config without this field and verify it defaults to `false`.

**Safe without deep expertise?** Yes -- this is a type definition change only.

---

### Change 1.2: Add the Config Schema Validation

**File:** `src/config/zod-schema.ts` (or the relevant sub-schema for messages/queue)
**What changes:** Add `priorityPreemption: z.boolean().optional()` to the queue config schema.
**In plain English:** We are telling the configuration validation system that this new on/off switch exists and that it accepts true/false values.

**What could break:** Nothing. Adding an optional field to a Zod schema is backward compatible.

**How to test:** Write a test that validates a config with `priorityPreemption: true`, `priorityPreemption: false`, and without the field at all. All three should pass validation.

**Safe without deep expertise?** Yes -- this is schema validation only.

---

### Change 1.3: Detect "Human Waiting Behind Background Task"

**File:** `src/auto-reply/reply/get-reply-run.ts`
**What changes:** After the queue mode decision (around line 334 where `isActive` is checked), add logic that detects: "This is a human message, the config has `priorityPreemption: true`, and the session has an active run that is a heartbeat or background task."
**In plain English:** When a human sends a message and the system sees that the AI is busy with a background task, it flags this as a priority situation. In Phase 1, this flag is only used to send a "got your message, you are next" acknowledgment.

**What could break:** If the detection logic has a false positive (thinks a human message is behind a background task when it is not), it could send an unnecessary acknowledgment. This is annoying but not harmful. If it has a false negative (misses the condition), the behavior is the same as today -- no regression.

**How to test:** Write a test where `isActive` is true, `isHeartbeat` was the reason for the active run, and a non-heartbeat message arrives. Verify the detection triggers. Write a second test where both messages are from humans. Verify the detection does NOT trigger.

**Safe without deep expertise?** Medium -- this file is complex (430+ lines), but the change is additive (an `if` block after existing logic). The key risk is getting the condition wrong, not breaking existing flow.

---

### Change 1.4: Send the Acknowledgment

**File:** `src/auto-reply/reply/get-reply-run.ts` (same file as 1.3)
**What changes:** When the detection from 1.3 triggers, immediately send a short message back to the human through `routeReply` or the typing/reply system: "Got your message. Finishing up a background task -- you are next."
**In plain English:** The human gets a polite "please hold" instead of silence.

**What could break:** If the acknowledgment is sent but then the background task finishes very quickly, the human gets a "please wait" followed by an immediate response. This feels slightly odd but is not harmful. The acknowledgment must NOT be sent if `priorityPreemption` is false.

**How to test:** End-to-end test: trigger a heartbeat run, send a human message during it, verify the acknowledgment appears before the actual response.

**Safe without deep expertise?** Medium -- reply routing is well-tested, but sending an extra message mid-pipeline requires understanding the reply flow.

---

## Phase 2: Move Heartbeats Off the Main Lane (The Real Fix for Cross-Session)

**Goal:** Route heartbeat runs to their own global lane so they never consume a `main` lane slot that a human message needs. This eliminates the cross-session blocking case entirely.

### Change 2.1: Add a Heartbeat Lane

**File:** `src/process/lanes.ts`
**What changes:** Add `Heartbeat = "heartbeat"` to the `CommandLane` enum.
**In plain English:** We are creating a new traffic lane specifically for heartbeat runs, just like cron jobs already have their own lane.

**What could break:** Nothing. Adding a new enum value does not change any existing values.

**How to test:** Verify the enum has the new value. Verify existing lane names are unchanged.

**Safe without deep expertise?** Yes -- this is a one-line enum addition.

---

### Change 2.2: Configure the Heartbeat Lane Concurrency

**File:** `src/gateway/server-lanes.ts`
**What changes:** Add a line: `setCommandLaneConcurrency(CommandLane.Heartbeat, 1)` in `applyGatewayLaneConcurrency`.
**In plain English:** We are telling the system that only one heartbeat run can happen at a time (same as today, but on its own lane instead of sharing the main lane).

**What could break:** If we forget this line, the heartbeat lane defaults to concurrency 1 anyway (the queue's default). So the worst case of a mistake here is correct behavior.

**How to test:** Start the gateway, verify that the heartbeat lane exists with concurrency 1 and the main lane is unchanged.

**Safe without deep expertise?** Yes -- this is a one-line configuration call following the exact pattern of the cron lane setup.

---

### Change 2.3: Route Heartbeat Runs to the Heartbeat Lane

**File:** `src/auto-reply/reply/get-reply-run.ts`
**What changes:** When `isHeartbeat` is true and `priorityPreemption` is enabled in config, set the lane to `"heartbeat"` instead of leaving it undefined (which defaults to `"main"`). This value flows through to `runEmbeddedPiAgent` via the `followupRun.run` object, which accepts an optional `lane` parameter.
**In plain English:** When the system knows a run is a heartbeat and priority preemption is turned on, it sends the heartbeat to its own lane instead of the human lane.

**What could break:** If heartbeat runs on a separate lane interact badly with session locking. However, the session lock is independent of the global lane -- it is based on the session key, not the lane name. So this should be safe. The risk is if there is some implicit assumption elsewhere that heartbeats are on the main lane.

**How to test:**
1. Start a heartbeat run with `priorityPreemption: true`. Verify it uses the `heartbeat` global lane.
2. Start a heartbeat run with `priorityPreemption: false`. Verify it uses the `main` global lane (backward compatible).
3. Start a human message while a heartbeat is running on a different session. Verify the human message is not blocked by the heartbeat.

**Safe without deep expertise?** Medium -- requires understanding how the `lane` parameter flows through the agent runner. But the change is small (conditionally set one field).

---

### Change 2.4: Update the Heartbeat Runner's Queue Check

**File:** `src/infra/heartbeat-runner.ts`
**What changes:** Currently the heartbeat runner checks `getQueueSize(CommandLane.Main)` and skips if there are tasks in the main queue. With priority preemption enabled, it should also (or instead) check the heartbeat lane.
**In plain English:** The heartbeat's "should I even bother running?" check needs to look at the right lane now that heartbeats have their own lane.

**What could break:** If we only check the heartbeat lane and not the main lane, heartbeats could start when human messages are queued. But this is actually FINE now -- because heartbeats are on a separate lane, they do not block human messages. The old behavior of skipping was a workaround for the fact that heartbeats shared the lane. With lane separation, skipping is no longer necessary (though keeping it is also harmless).

**How to test:** Verify heartbeat skip behavior with both `priorityPreemption: true` and `false`.

**Safe without deep expertise?** Yes -- this is a small conditional change to an existing check.

---

## Phase 3: Auto-Abort Background Tasks on Same-Session Conflict (The Full Solution)

**Goal:** When a human message arrives for a session that is currently running a heartbeat or background task, automatically abort the background task and let the human go first. This eliminates same-session blocking.

### Change 3.1: Track Whether the Active Run Is a Background Task

**File:** `src/agents/pi-embedded-runner/runs.ts`
**What changes:** Add a `isBackground: boolean` flag to the active run tracking. Set it to `true` when the run was started with `isHeartbeat: true` or came from a cron trigger. This requires passing the information through from the caller.
**In plain English:** When the system starts an AI run, it now remembers whether that run was triggered by a human or by a background process. This lets it make smarter decisions later.

**What could break:** If the flag is set incorrectly (a human run marked as background, or vice versa), the system could abort the wrong run. This is the highest-risk change in the plan. The detection MUST be reliable.

**How to test:**
1. Start a heartbeat run. Verify it is tracked as `isBackground: true`.
2. Start a human message run. Verify it is tracked as `isBackground: false`.
3. Start a cron-triggered heartbeat. Verify it is tracked as `isBackground: true`.

**Safe without deep expertise?** No -- this requires understanding the run tracking system and ensuring the flag is propagated correctly through multiple files.

---

### Change 3.2: Add "Abort If Background" Logic

**File:** `src/auto-reply/reply/agent-runner.ts` (in the `runReplyAgent` function, around line 161-197)
**What changes:** Before the existing steer/followup decision, add a new check: "If priorityPreemption is enabled, and the current active run is a background task (checked via the flag from 3.1), and this new message is from a human (not a heartbeat), then abort the active run and proceed as if the session were idle."
**In plain English:** When a human sends a message and the AI is busy with a heartbeat, the system automatically cancels the heartbeat and processes the human message immediately. The heartbeat will run again at the next scheduled time.

**What could break:**
- If the abort does not clean up properly, the session could be left in a corrupted state. The existing `abortEmbeddedPiRun` function handles cleanup, but it was designed for user-initiated aborts, not automatic ones.
- If the abort happens mid-tool-execution (e.g., the heartbeat was running a bash command), the tool process may continue running in the background.
- If the followup queue has background task messages waiting, those need to be cleared too (using `clearSessionQueues`).
- The dangling promise issue (Issue 5.2 from KNOWN-PROBLEMS.md) could cause the aborted heartbeat's caller to hang. This needs to be addressed.

**How to test:**
1. Start a heartbeat run. Send a human message while it is running. Verify the heartbeat is aborted and the human message is processed immediately.
2. Verify the session file is not corrupted after the abort.
3. Verify the heartbeat runner handles the abort gracefully (does not crash, does not leave orphaned processes).
4. Verify this ONLY happens when `priorityPreemption: true`. With `false`, behavior is unchanged.

**Safe without deep expertise?** No -- this is the most complex change in the plan. It touches the core execution flow and requires understanding the abort mechanism, session state, and run tracking.

---

### Change 3.3: Fix clearCommandLane to Properly Reject Promises

**File:** `src/process/command-queue.ts`
**What changes:** When `clearCommandLane` removes tasks from the queue, it should call `reject(new Error("Lane cleared: task preempted"))` on each removed entry's promise, instead of just setting `queue.length = 0`.
**In plain English:** When background tasks are canceled to make room for a human message, the system now properly notifies the canceled tasks that they were canceled. This prevents parts of the system from hanging forever waiting for a response that will never come.

**What could break:** Any code that catches rejected promises from `enqueueCommandInLane` needs to handle this new error type. Currently, the system does not catch these rejections because the promises are abandoned (they hang forever). Adding rejection is technically a behavior change, but it is a BUG FIX -- the current behavior (hanging forever) is worse.

**How to test:**
1. Enqueue two tasks in a lane. Clear the lane. Verify the pending task's promise is rejected with a descriptive error.
2. Verify the currently RUNNING task is not affected by the clear.
3. Verify other lanes are not affected.

**Safe without deep expertise?** Medium -- the change is small (iterate and reject instead of truncate), but the implications for callers need to be checked.

---

### Change 3.4: Re-queue the Aborted Background Task (Optional)

**File:** `src/auto-reply/reply/agent-runner.ts` or `src/infra/heartbeat-runner.ts`
**What changes:** After aborting a heartbeat to serve a human, optionally re-queue the heartbeat to run after the human message is processed. This is a nice-to-have, not a must-have, because heartbeats run on a schedule and the next one will happen automatically.
**In plain English:** After the human gets their response, the system says "Oh, I interrupted a heartbeat earlier -- let me run it now." This ensures no scheduled work is skipped.

**What could break:** If the re-queued heartbeat conflicts with a new incoming message, we could get into a loop of abort-requeue-abort. A simple guard (do not re-queue if another human message is waiting) prevents this.

**How to test:** Abort a heartbeat for a human message. Verify the heartbeat runs again after the human message completes. Send another human message during the re-queued heartbeat. Verify it does not create an infinite loop.

**Safe without deep expertise?** Medium -- the re-queue logic is straightforward, but the loop prevention needs careful design.

---

## Phase 4 (Future): Priority Within the Queue

This phase is NOT part of the immediate plan but is documented here for when/if it becomes necessary.

If Phase 1-3 are not sufficient (e.g., multiple background tasks pile up in the main lane and block humans even with lane separation), the next step would be to add a `priority` field to the `QueueEntry` type in `command-queue.ts` and modify `drainLane` to pick the highest-priority task instead of the oldest task.

This would be a MEDIUM risk change because:
- It modifies the core queue behavior
- It affects all 8 direct consumers of the queue
- It requires updating the 3 existing queue tests plus writing new ones
- FIFO ordering within the same priority must be preserved to avoid starvation

We do NOT recommend building this now because Phases 1-3 should eliminate the vast majority of blocking scenarios without touching the queue internals.

---

## Risk Assessment

| Change | Phase | Risk Level | Why |
|--------|:-----:|:----------:|-----|
| Add config toggle | 1 | LOW | New optional field, default false, no behavior change |
| Add schema validation | 1 | LOW | Additive Zod schema change, backward compatible |
| Detect human-behind-background | 1 | LOW | Additive detection logic, false negatives are harmless |
| Send acknowledgment | 1 | LOW | Sends one extra message, does not alter queue behavior |
| Add heartbeat lane enum | 2 | LOW | One-line enum addition, no existing values change |
| Configure heartbeat lane concurrency | 2 | LOW | One-line call following existing cron pattern |
| Route heartbeats to heartbeat lane | 2 | MEDIUM | Conditionally sets one field; requires understanding lane flow |
| Update heartbeat runner queue check | 2 | LOW | Small conditional on existing check |
| Track isBackground on active runs | 3 | MEDIUM | New flag in run tracking; must propagate correctly |
| Auto-abort background for human | 3 | HIGH | Touches core execution flow; must handle cleanup correctly |
| Fix clearCommandLane promise rejection | 3 | MEDIUM | Behavior change on existing function; callers must handle |
| Re-queue aborted heartbeat | 3 | MEDIUM | Loop prevention required; nice-to-have, not essential |

### Overall Risk by Phase:

- **Phase 1:** LOW risk. All changes are additive. Default behavior is unchanged. Worst case is an unnecessary "please wait" message.
- **Phase 2:** LOW-MEDIUM risk. Lane separation is a pattern already proven by cron jobs. The main risk is an assumption somewhere that heartbeats are on the main lane.
- **Phase 3:** MEDIUM-HIGH risk. Auto-aborting runs and fixing promise rejection are behavior changes to core systems. This phase should only be built after Phase 2 is stable and tested.

---

## Implementation Order

### Step 1: Write Safety Net Tests FIRST (Before Any Code Changes)

Before changing a single line of production code, write these tests to establish a baseline:

1. **Lane isolation test:** Prove that tasks on Lane A and Lane B can run concurrently, and tasks on the same lane run serially.
2. **Concurrency configuration test:** Prove that `setCommandLaneConcurrency(lane, 2)` allows 2 parallel tasks.
3. **clearCommandLane integration test:** Prove that clearing a lane drops pending tasks without affecting running tasks.
4. **FIFO ordering test:** Prove that tasks within a lane execute in insertion order.
5. **Error propagation test:** Prove that a failed task does not break the queue for subsequent tasks.

These tests take maybe half a day to write and will catch regressions for all subsequent phases.

### Step 2: Build Phase 1 (Config Toggle + Notification)

Estimated effort: 1 day.
Ship it. Get user feedback. Monitor logs for false positives (unnecessary acknowledgments).

### Step 3: Build Phase 2 (Heartbeat Lane Separation)

Estimated effort: 1 day.
Ship it. This is the biggest bang for the buck -- it eliminates cross-session blocking with minimal risk. Monitor whether heartbeats still fire correctly.

### Step 4: Evaluate Whether Phase 3 Is Needed

After Phases 1 and 2 are live, measure:
- How often humans are still blocked (same-session case only, since cross-session is now fixed).
- How long the remaining waits are.
- Whether users are satisfied with the acknowledgment (Phase 1) plus faster service (Phase 2).

If waits are rare and short, stop here. If same-session blocking is still a problem, proceed to Phase 3.

### Step 5: Build Phase 3 (Auto-Abort Background for Human)

Estimated effort: 2-3 days (includes the promise rejection fix).
Ship it carefully. This is the highest-risk phase. Test heavily on a staging environment before production.

---

## Backward Compatibility

Every change in this plan is gated behind the `messages.queue.priorityPreemption` config toggle:

- **Default value:** `false`
- **When false:** The system behaves exactly as it does today. No heartbeat lane separation. No auto-abort. No acknowledgments. Zero behavior change.
- **When true:** Phases 1, 2, and 3 activate progressively as they are built.

Users can enable the feature at any time by adding one line to their config:

```json5
{
  messages: {
    queue: {
      priorityPreemption: true
    }
  }
}
```

And disable it by setting it to `false` or removing the line.

---

## Queue Modes: Unaffected

The existing queue modes (steer, followup, collect, steer-backlog, interrupt) are completely unaffected by this plan:

- **steer** still works the same way -- inject into streaming runs.
- **followup** still queues messages for the next turn.
- **collect** still batches messages together.
- **steer-backlog** still does both steer and followup.
- **interrupt** (legacy) still aborts everything.

Priority preemption operates at a DIFFERENT layer -- it decides what happens BEFORE the queue mode decision. If a background task is running and a human message arrives:
1. First, priority preemption checks: should I abort the background task? (Phase 3)
2. If yes, it aborts and the message proceeds as if nothing was running.
3. If no (or if the feature is off), the normal queue mode decision takes over.

The two systems are complementary, not conflicting.

---

## What Could Go Wrong: Honest Assessment

### Things That Could Cause Real Problems

1. **Aborting a heartbeat mid-tool-execution** could leave orphaned processes (e.g., a bash command that keeps running). The existing abort mechanism does not kill child processes. This is a pre-existing issue (it happens with /stop too), but auto-abort makes it more likely to occur.

2. **Session state corruption** after auto-abort. If the abort happens while the session file is being written, the file could be partially written. The session write lock should prevent this, but it needs to be verified.

3. **Loop behavior** if heartbeats are re-queued (Phase 3, Change 3.4): human message aborts heartbeat, heartbeat re-queues, another human message aborts the re-queued heartbeat, etc. This is preventable with a simple "do not re-queue if there are pending human messages" guard.

### Things That Are Annoying But Not Dangerous

4. **False positive acknowledgments** (Phase 1): the system sends "please wait" but the background task finishes in 1 second. Mildly confusing but not harmful.

5. **Wasted AI work** (Phase 3): when a heartbeat is aborted, the LLM tokens it consumed are wasted. For a 30-minute heartbeat cycle, this is at most one partial run wasted every 30 minutes, which is negligible.

6. **Heartbeat timing drift** (Phase 2): if heartbeats are on their own lane with concurrency 1, and the lane is already occupied by another heartbeat (unlikely with a 30-minute interval), the second heartbeat waits. This is the same behavior as today on the main lane, just on a different lane.

### Things We Are Explicitly NOT Worried About

7. **Cross-session blocking from non-heartbeat sources** (e.g., subagent runs). Subagents already have their own lane with concurrency 8. This plan does not address subagent blocking because it is already handled.

8. **Cron lane blocking.** Isolated cron jobs already have their own lane. Main-session cron jobs trigger heartbeats, which Phase 2 addresses.

---

## Summary

| Phase | What It Does | Risk | Effort | Ships Independently? |
|:-----:|-------------|:----:|:------:|:-------------------:|
| 0 | Write safety net tests | None | Half day | Yes |
| 1 | Config toggle + "please wait" notification | LOW | 1 day | Yes |
| 2 | Move heartbeats to own lane | LOW-MEDIUM | 1 day | Yes |
| 3 | Auto-abort background tasks for humans | MEDIUM-HIGH | 2-3 days | Yes |
| 4 | Priority field in queue (future, if needed) | MEDIUM | 2 days | Yes |

Total estimated effort for Phases 0-3: **5-6 days.**

The most important thing about this plan: **you can stop after any phase.** Phase 1 alone gives a UX improvement. Phase 2 alone fixes most blocking scenarios. Phase 3 fixes the remaining edge case. Each step is independently valuable and independently testable.

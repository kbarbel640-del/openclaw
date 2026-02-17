# Approach Evaluation: Priority Queue / Human Message Preemption

**Date:** 2026-02-16
**Author:** Engineering Lead (Claude)
**Audience:** Non-developer business owner
**Purpose:** Evaluate four approaches to solving the "human messages blocked by background tasks" problem

---

## The Problem (Plain English)

When your AI agent is busy doing a background job (like a cron task, a heartbeat check, or an agent-to-agent conversation), and a real human sends a message on WhatsApp or Telegram, that human message has to **wait in line** behind the background task. The human might wait 30 seconds, a minute, or longer — because the queue processes things one at a time per session, and background work shares the same "main" lane as human conversations.

## How the Current System Works (What I Found in the Code)

Here's what matters for evaluating these approaches:

1. **The queue is simple and elegant.** It's a ~150-line file (`command-queue.ts`) that manages "lanes" — named queues that each process tasks one at a time (by default). Think of lanes like checkout lines at a grocery store.

2. **Four lane types exist today:**
   - `main` — where human messages AND heartbeats go (default concurrency: 4)
   - `cron` — where scheduled background tasks go (default concurrency: 1)
   - `subagent` — where sub-agents go (default concurrency: 8)
   - `session:<key>` — per-session lanes that guarantee only one run per conversation at a time

3. **The two-lock system:** Every agent run acquires TWO lanes — first a per-session lane (so your conversation doesn't collide with itself), then a global lane (so the system doesn't run too many things at once). This is the `enqueueCommandInLane(sessionLane, () => enqueueCommandInLane(globalLane, task))` pattern seen in `compact.ts`.

4. **"Steer" mode already exists** — it's a partial solution. When set to `steer`, a human message arriving during an active run can be "injected" into the currently running LLM conversation (via `queueEmbeddedPiMessage`). But it only works if the run is actively streaming. If it's doing a tool call (like running a bash command), steer can't inject and falls back to queueing.

5. **Abort already exists** — sending "stop" or "/stop" will abort the current run for a session. This is a nuclear option: it kills the run entirely, doesn't resume it.

6. **The queue has NO priority system.** It's strictly FIFO (first in, first out). There's no concept of "this task is more important than that one." A cron job that started first will finish before a human message that arrived second, even though the human should clearly come first.

7. **Background tasks (cron, heartbeat) use the `main` lane** for their actual runs, sharing concurrency slots with human messages. Cron jobs get their own lane for scheduling, but the agent run itself goes through `main`.

---

## Approach A: "Checkpoint & Resume"

**The idea:** When a human message arrives while a background task is running, signal the background task to pause at the next safe boundary. Save where it was. Process the human message. Then resume the background task.

### Files That Would Need to Change

| File | What Changes | Why |
|------|-------------|-----|
| `src/process/command-queue.ts` | Add pause/resume mechanics to lane processing | Core queue needs to understand "pausable" tasks |
| `src/agents/pi-embedded-runner/compact.ts` | Add checkpoint serialization for LLM state | The agent runner needs to save and restore mid-run state |
| `src/auto-reply/reply/agent-runner.ts` | Add interruption hooks during tool execution | The main reply loop needs pause points |
| `src/auto-reply/reply/agent-runner-execution.ts` | Add checkpoint between tool calls | The execution loop needs safe boundaries |
| `src/auto-reply/reply/get-reply-run.ts` | Add priority detection for human vs background | Needs to know when to trigger preemption |
| `src/auto-reply/reply/queue/drain.ts` | Modify followup drain to support pause/resume | Followup queue needs to understand paused states |
| `src/cron/` (multiple files) | Mark cron runs as pausable | Cron system needs to opt into pausability |
| `src/auto-reply/heartbeat.ts` | Mark heartbeat runs as pausable | Heartbeat needs to opt into pausability |
| New: config schema changes | Add `messages.queue.priorityPreemption` toggle | Configuration for opt-in |

**Estimated file changes: 10-12 files**

### What's the Hardest Part

**Saving and restoring LLM state mid-run.** The agent runner (`runEmbeddedPiAgent`) creates a full session with an LLM, tools, system prompts, and a conversation history. "Checkpointing" this means you'd need to:
- Know exactly which tool call just finished
- Serialize the session state (which lives in memory via `SessionManager`)
- Later restore it and tell the LLM "you were in the middle of X, continue from here"

The LLM doesn't have a true "resume" capability — you'd be starting a new conversation turn with a prompt like "You were previously working on X and completed steps 1-3. Continue from step 4." This is **approximate**, not exact.

### What Could Break

- **Session file corruption:** If the checkpoint save is interrupted (crash, timeout), you could end up with a half-written session file. The system has session write locks (`acquireSessionWriteLock`), but adding pause/resume adds more lock coordination.
- **LLM confusion:** When you tell an LLM "continue where you left off," it doesn't always pick up cleanly. It might repeat work, skip steps, or misunderstand the context.
- **Tool state loss:** If a background task was running a bash command and you pause it, the bash process continues in the background. Resuming the agent won't re-connect to that process.
- **Deadlocks:** The two-lock system (session lane + global lane) is already delicate. Adding pause/resume creates more states where locks could get stuck.

### What Already Exists That Helps or Hurts

- **Helps:** The `abortEmbeddedPiRun` function shows the codebase already has a concept of interrupting runs. But it's a full abort, not a pause.
- **Helps:** `compactEmbeddedPiSession` already serializes session state for compaction, which is similar to checkpointing.
- **Hurts:** The LLM session is created fresh each run with `createAgentSession`. There's no built-in "resume from checkpoint" in the underlying SDK (`@mariozechner/pi-coding-agent`).
- **Hurts:** Tool execution is a black box during execution — you can't pause mid-tool-call.

### Verdict

**HIGH RISK.** This is the most powerful approach but also the most dangerous. It requires deep changes to the agent runtime, introduces complex state management, and the "resume" part is inherently unreliable because LLMs don't have true pause/resume. This is not a good first attempt for someone without deep expertise in this codebase.

---

## Approach B: "Notification + Wait"

**The idea:** When a human message arrives while something is running, immediately send back an acknowledgment ("Got your message, finishing up a task, you're next."). Let the background task finish naturally. Then process the human message.

### Files That Would Need to Change

| File | What Changes | Why |
|------|-------------|-----|
| `src/auto-reply/reply/get-reply-run.ts` | Detect "human waiting behind background task" and send ack | This is where the queue mode decision happens |
| `src/process/command-queue.ts` | Add queue inspection (what's ahead of me?) | Need to know if background tasks are ahead |
| `src/auto-reply/reply/route-reply.ts` | Maybe small changes for ack routing | Ack needs to go back to the right channel |
| Config schema | Add `messages.queue.priorityPreemption` toggle (even for ack-only mode) | Configuration |

**Estimated file changes: 3-4 files**

### What's the Hardest Part

**Knowing the difference between a human message and a background task.** The current queue doesn't tag entries with "this is from a human" vs "this is from cron." You'd need to add metadata to queue entries or check the originating source. The `originatingChannel` field on `FollowupRun` helps, but the command queue (`command-queue.ts`) itself has no concept of task origin.

### What Could Break

- **Very little.** This approach doesn't change queue ordering or execution. It just adds an acknowledgment message. The human still waits, they just know they're waiting.
- **Minor risk:** The ack message could be confusing if the background task finishes very quickly (user gets "please wait" and then an immediate response).

### What Already Exists That Helps or Hurts

- **Helps:** The typing indicator system already fires immediately on enqueue (docs confirm this). So users already see "typing..." while waiting. An ack would be a more informative version of this.
- **Helps:** `routeReply` is well-tested and handles sending messages back to the originating channel.
- **Hurts:** Doesn't actually solve the problem — the human still waits. This is a UX band-aid, not a fix.

### Verdict

**LOW RISK, LOW REWARD.** Very safe to implement. Very few files change. But it doesn't actually solve the problem — it just makes the wait more polite. Good as a quick win or as a fallback if other approaches prove too risky.

---

## Approach C: "Parallel Lanes"

**The idea:** Give human messages their own dedicated lane, separate from background work. Both can run simultaneously. Background tasks use the `cron`/`subagent` lanes. Human messages get a new `priority` lane (or just use `main` with higher concurrency).

### Files That Would Need to Change

| File | What Changes | Why |
|------|-------------|-----|
| `src/process/lanes.ts` | Add a new `Priority` lane type | Define the human message lane |
| `src/process/command-queue.ts` | No changes needed (already supports arbitrary lanes) | Already flexible enough |
| `src/gateway/server-lanes.ts` | Configure concurrency for the new lane | Set up lane on gateway start |
| `src/auto-reply/reply/get-reply-run.ts` | Route human messages to priority lane instead of main | Key routing decision |
| `src/agents/pi-embedded-runner/lanes.ts` | Resolve correct global lane based on message source | Lane resolution logic |
| `src/agents/pi-embedded.ts` | Pass lane parameter based on source type | Agent run needs to know its lane |
| `src/auto-reply/heartbeat.ts` | Ensure heartbeat uses non-priority lane | Keep background work separate |
| `src/cron/` (scheduler files) | Ensure cron uses cron lane consistently | Already mostly correct |
| Config schema | Add `messages.queue.priorityPreemption` toggle | Configuration |

**Estimated file changes: 6-8 files**

### What's the Hardest Part

**Session state sharing between parallel runs.** The current system guarantees that only ONE agent run touches a given session at a time (via the `session:<key>` lane). If you let a human message run in parallel with a background task that uses the same session, you get:
- Two processes trying to write to the same session file
- Conversation history getting interleaved
- The LLM seeing garbled context

This is the **fatal flaw** of this approach. The per-session lock exists for a very good reason. You can't have two runs on the same session simultaneously without causing data corruption.

**The workaround** would be to only allow parallel lanes for different sessions (human on session A, cron on session B). But the problem we're trying to solve is specifically when background work and human messages target the **same session**.

### What Could Break

- **Session file corruption** if two runs write simultaneously
- **LLM context confusion** from interleaved conversation history
- **The per-session guarantee is the foundation** of the system's reliability. Breaking it is dangerous.

### What Already Exists That Helps or Hurts

- **Helps:** Cron and subagent already have their own lanes! The lane system is already designed for parallelism across different session types.
- **Hurts:** The two-lock system (session lane then global lane) means that even if you put human messages on a different global lane, they still block on the session lane. This is by design — and changing it is dangerous.
- **Hurts:** The session write lock (`acquireSessionWriteLock`) is a file-level lock. Two concurrent writes = corruption risk.

### Verdict

**HIGH RISK for same-session scenarios. LOW RISK for cross-session scenarios.** The cross-session case already works (cron on one session doesn't block humans on another). The same-session case — which is the actual problem — can't be safely parallelized without redesigning the session system. Not recommended.

---

## Approach D: "Hybrid (Notification + Checkpoint)"

**The idea:** Immediately acknowledge the human. Check if the background task is almost done — if yes, let it finish. If it has a lot left, checkpoint and pause it. After human interaction, resume from checkpoint.

### Files That Would Need to Change

This is Approach A + Approach B combined, so:

**Everything from Approach A (10-12 files) PLUS the notification logic from Approach B (3-4 files).**

**Estimated file changes: 12-15 files**

### What's the Hardest Part

All the same challenges as Approach A (checkpoint/resume is hard), PLUS:
- **Estimating "how much work is left"** for a background task. LLM runs are unpredictable — you can't easily tell if a task is 90% done or 10% done.
- **Decision logic:** When do you checkpoint vs. wait? This adds another layer of complexity.

### What Could Break

Everything from Approach A, plus wrong decisions about when to pause vs wait could make the experience worse (pausing a task that was about to finish means extra latency, extra cost for the resumed LLM call, and potential context loss).

### Verdict

**HIGHEST RISK.** Most complex, most files, most things that can go wrong. The "smart decision" part (should I pause or wait?) adds complexity without clear benefit. If checkpoint/resume worked perfectly, you'd always want to pause. The "estimate remaining work" heuristic would be unreliable.

---

## My Recommendation

### Build Approach B First (Notification + Wait)

**Why:**
1. **3-4 files, LOW risk, ships fast.** You can have this working in an afternoon.
2. **Immediate UX improvement.** Users stop wondering "did my message get lost?" and instead see "Got it, finishing a task, you're next."
3. **No queue behavior changes.** Default behavior is completely unchanged. Nothing can break for existing users.
4. **Foundation for future work.** The detection logic ("is a background task ahead of this human message?") is needed for ANY priority approach. Building it first means Approach A or D later has a head start.

### Then Evaluate Whether You Actually Need More

Once Approach B is live, you'll know:
- How often humans actually wait behind background tasks
- How long the waits typically are
- Whether the ack message is "good enough" for your users

If waits are short (under 10 seconds), Approach B might be all you need. If waits are long and frequent, then consider:

### If You Need More: A Modified Approach A (Abort + Re-run, Not Checkpoint)

Instead of true checkpoint/resume (which is very hard), consider this simpler variant:

1. Human message arrives while background task is running
2. **Abort** the background task (this already works via `abortEmbeddedPiRun`)
3. Process the human message immediately
4. **Re-queue** the background task from scratch (not resume from checkpoint)

This is simpler because:
- Abort already works and is tested
- Re-queueing is just calling `enqueueCommandInLane` again
- No checkpoint serialization needed
- Background tasks (cron, heartbeat) are designed to be re-runnable

The downside is wasted work (the background task starts over), but for most background tasks this is fine — they're either short or idempotent (safe to repeat).

**This modified approach would change ~6-8 files and be MEDIUM risk.**

---

## Summary Table

| Approach | Files Changed | Risk Level | Solves the Problem? | Recommended Order |
|----------|:------------:|:----------:|:-------------------:|:-----------------:|
| **B: Notification + Wait** | 3-4 | LOW | Partially (UX only) | **BUILD FIRST** |
| **A: Checkpoint & Resume** | 10-12 | HIGH | Yes (but unreliable resume) | Not recommended |
| **C: Parallel Lanes** | 6-8 | HIGH | No (session lock blocks it) | Not recommended |
| **D: Hybrid** | 12-15 | HIGHEST | Yes (but most complex) | Not recommended |
| **Modified A: Abort + Re-run** | 6-8 | MEDIUM | Yes (wastes some work) | **BUILD SECOND** |

---

## Red Flags and Warnings

1. **The per-session lock is sacred.** Any approach that tries to run two things on the same session simultaneously will cause data corruption. Approaches A and D respect this. Approach C does not.

2. **The LLM SDK doesn't support pause/resume.** The `@mariozechner/pi-coding-agent` SDK creates sessions that run to completion. There's no built-in "save state and come back later." Any checkpoint approach must work around this limitation.

3. **Background tasks share the `main` lane.** This is the root cause of the blocking problem. Heartbeat runs go through `main`. The simplest architectural fix might be moving heartbeat to its own lane — but that's already partially done (cron has its own lane). The issue is that all runs eventually need the session lock.

4. **The existing "steer" mode is close to what you want** for streaming scenarios. If your users primarily interact while the agent is streaming (not during tool calls), configuring `steer` mode might solve 70-80% of the problem without any code changes at all.

---

## Quick Win: Have You Tried `steer` Mode?

Before building anything, you could test whether `steer` mode already solves enough of your problem:

```
/queue steer
```

This tells the system: when I send a message while the agent is busy, inject it into the current run immediately (if streaming). The agent will see your message in real-time and adjust its response.

This won't help when the agent is executing a tool call (bash, file read, etc.), but it handles the most common case of the agent being mid-response.

# Agent Orchestration Plan and Logic

## Scope

This document explains how OpenClaw agent orchestration currently works for:

- OpenClaw sub-agents (`runtime: "subagent"`)
- ACP harness sessions (`runtime: "acp"`)

It also proposes a small `v2` refactor plan that preserves current behavior while making orchestration easier to reason about and test.

Related user docs:

- [Sub-Agents](/tools/subagents)
- [ACP Agents](/tools/acp-agents)

## Current Orchestration Entry Point

The orchestration entry point is the `sessions_spawn` tool in `src/agents/tools/sessions-spawn-tool.ts`.

High-level flow:

1. Validate tool params (`task`, `runtime`, `mode`, `thread`, overrides)
2. Route by runtime:
   - `runtime: "subagent"` -> `spawnSubagentDirect(...)` (`src/agents/subagent-spawn.ts`)
   - `runtime: "acp"` -> `spawnAcpDirect(...)` (`src/agents/acp-spawn.ts`)
3. Return an immediate accepted/forbidden/error result to the caller agent

Important boundary:

- `subagents` orchestration controls (`list`, `kill`, `steer`) only manage OpenClaw sub-agent runs, not ACP sessions (`src/agents/tools/subagents-tool.ts`).

## Subagent Orchestration Logic (Current)

### 1. Spawn validation and policy checks

`spawnSubagentDirect(...)` enforces the orchestration rules before any child run starts:

- Resolves spawn mode (`run` vs `session`) from explicit `mode` plus `thread`
- Requires `thread=true` for `mode="session"`
- Enforces max nesting depth (`maxSpawnDepth`)
- Enforces per-requester active child cap (`maxChildrenPerAgent`)
- Enforces `agentId` allowlist (`agents.list[].subagents.allowAgents`)
- Resolves child model/thinking defaults and validates thinking override

This keeps orchestration policy centralized in one path before the child run exists.

### 2. Child session preparation

If allowed, the spawner:

- Creates a child session key (`agent:<id>:subagent:<uuid>`)
- Patches session metadata via gateway RPC (`sessions.patch`) for spawn depth
- Optionally patches model and thinking level
- Optionally prepares thread binding (channel hook path) when `thread=true`

If thread binding setup fails, it deletes the provisional child session and returns an error.

### 3. Child run launch

The spawner then sends a gateway `agent` call with:

- `deliver: false` (child does not directly talk to the user)
- lane = subagent
- a subagent-specific system prompt (`buildSubagentSystemPrompt(...)`)
- a generated task message that includes subagent context and the requested task

The subagent system prompt is the core orchestration contract for worker behavior in `src/agents/subagent-announce.ts`:

- stay focused
- rely on push-based completion
- avoid busy polling
- optionally orchestrate descendants when depth allows

### 4. Registry registration (source of truth for subagent runs)

After launch succeeds, `registerSubagentRun(...)` in `src/agents/subagent-registry.ts` stores a `SubagentRunRecord` (`src/agents/subagent-registry.types.ts`) with:

- `runId`, `childSessionKey`, `requesterSessionKey`
- task/label/model metadata
- cleanup mode (`keep` or `delete`)
- spawn mode (`run` or `session`)
- timeout/archive timestamps
- completion bookkeeping fields

The registry is the orchestration state machine for OpenClaw sub-agents.

### 5. Completion detection (two paths)

The registry tracks completion through both mechanisms:

- Primary: gateway `agent.wait` (`waitForSubagentCompletion(...)`)
- Fallback/resume: lifecycle event listener (`ensureListener()` + `onAgentEvent(...)`)

Why both exist:

- `agent.wait` handles cross-process completion
- lifecycle events help embedded/local timing edge cases and restart recovery

### 6. Completion handling and announce cleanup flow

When a child completes, `completeSubagentRun(...)`:

1. Records terminal state (`endedAt`, `outcome`, `endedReason`)
2. Decides whether to emit `subagent_ended` immediately or defer
3. Starts the announce cleanup flow (`startSubagentAnnounceCleanupFlow(...)`)

The announce flow (`runSubagentAnnounceFlow(...)` in `src/agents/subagent-announce.ts`) is responsible for:

- waiting for the embedded child run to fully settle when needed
- reading the child output
- converting it into an orchestration/user delivery message
- delivering it to the requester session/channel
- respecting `expectsCompletionMessage` and duplicate/silent cases

### 7. Cleanup, retry, and archival behavior

`finalizeSubagentCleanup(...)` in the registry handles post-announce behavior:

- `cleanup: "delete"` -> remove run record and delete/archive child session
- `cleanup: "keep"` -> keep session, mark cleanup complete
- deferred retries when announce delivery is temporarily not ready
- bounded retry/backoff and expiry to avoid infinite loops

The registry also:

- persists run records to disk
- restores them on startup (`restoreSubagentRunsOnce()`)
- resumes pending announce cleanup after restarts
- prunes orphaned runs (missing session/session id)

## Runtime Control Logic (`subagents` tool)

The `subagents` tool in `src/agents/tools/subagents-tool.ts` is the operator interface for subagent orchestration.

### Requester scoping

`resolveRequesterKey(...)` scopes visibility/control to the correct parent session:

- main agent sees its children
- orchestrator subagent (depth allows spawning) sees its own children
- leaf subagent is remapped to parent for sibling visibility

### `list`

- Lists active and recent runs for the requester
- Pulls session metadata for model/token/runtime display
- Returns both machine-readable JSON and human-readable text

### `kill`

- Aborts embedded child runs
- Clears queued follow-ups/lane work
- Marks registry entries terminated
- Cascades to descendants (including descendants of already-finished parents)

This prevents orphaned worker trees when an orchestrator is stopped.

### `steer`

Steer is implemented as a controlled restart of a running subagent session:

1. Resolve target run
2. Reject self-steer and rate-limit rapid steer spam
3. Suppress announce for the interrupted run (`steer-restart`)
4. Abort current child run and clear queued work
5. Wait briefly for settle
6. Start a replacement `agent` run in the same child session
7. Replace registry record (`replaceSubagentRunAfterSteer(...)`)

If restart launch fails, announce suppression is cleared so the original run can still complete normally.

## ACP Orchestration Logic (Current)

ACP sessions share the `sessions_spawn` ingress but use a different backend (`src/agents/acp-spawn.ts`):

- ACP policy gate (`acp.enabled`, allowed agents)
- ACP target agent resolution (`agentId` or `acp.defaultAgent`)
- thread-binding policy checks via channel/session-binding services
- ACP control-plane spawn and session management

Key difference from subagents:

- ACP sessions are not tracked in the subagent registry
- `subagents` tool does not manage ACP runs
- ACP thread/session continuity is handled by ACP runtime + thread binding services

## Why The Current Design Works

The current orchestration model is split by responsibility:

- `sessions_spawn` = API/tool ingress
- `subagent-spawn` / `acp-spawn` = runtime-specific spawn policy + launch
- `subagent-registry` = durable subagent lifecycle state machine
- `subagent-announce` = completion delivery and message shaping
- `subagents` tool = operator controls (list/kill/steer)

This separation is already strong, but the orchestration contract is spread across files and implicit state transitions.

## V2 Plan (Refactor Without Behavior Change)

### Goals

- Make orchestration states explicit
- Reduce cross-file implicit coupling (spawn, registry, announce)
- Keep existing tool behavior and wire protocol stable
- Improve testability of edge cases (restart, deferred announce, steer restart)

### Proposed steps

1. Define a shared orchestration state model
   - Add a small internal state enum/transition helpers for subagent run phases (spawned, running, ended, announcing, cleaned, archived)
   - Keep serialized `SubagentRunRecord` backward compatible

2. Extract a `SubagentOrchestrator` service facade
   - Wrap registry + announce calls behind a narrow API (`register`, `complete`, `resume`, `steerReplace`, `terminateCascade`)
   - Keep existing exported functions as thin compatibility wrappers first

3. Centralize completion source merging
   - Move `agent.wait` + lifecycle event reconciliation into one reducer-style function
   - Make terminal outcome precedence explicit (ok/error/timeout/killed)

4. Centralize announce retry policy
   - Move retry/backoff/expiry decisions behind a pure policy module (most logic exists already; mainly packaging)
   - Add focused tests for retry-limit and restart-resume transitions

5. Add orchestration tracing hooks
   - Emit structured debug events (spawn accepted, run registered, completion detected, announce deferred, cleanup finalized)
   - Keep logs stable and grep-friendly

6. Document ACP vs subagent orchestration contract
   - Keep `sessions_spawn` shared ingress
   - Make runtime-specific capabilities explicit in one doc + one type surface

### Non-goals

- Changing user-facing `sessions_spawn` parameters
- Merging ACP and subagent runtime implementations
- Expanding default permissions/tool access for leaf subagents

## File Map

- `src/agents/tools/sessions-spawn-tool.ts` - shared orchestration ingress
- `src/agents/subagent-spawn.ts` - subagent spawn policy and launch
- `src/agents/subagent-registry.ts` - subagent lifecycle registry, completion, cleanup, restore
- `src/agents/subagent-registry.types.ts` - persisted run record shape
- `src/agents/subagent-announce.ts` - subagent system prompt and announce delivery flow
- `src/agents/tools/subagents-tool.ts` - list/kill/steer operator controls
- `src/agents/acp-spawn.ts` - ACP spawn path and thread/session binding preparation

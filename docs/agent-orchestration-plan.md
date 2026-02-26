---
summary: "V1 plan for orchestrating multi-agent work across planning, execution, retries, and CI-gated delivery"
read_when:
  - Designing or operating a multi-agent task runner for OpenClaw repo work
  - Defining task state, retry behavior, or CI gate policy
  - Running daily orchestration triage and recovery
owner: "openclaw"
status: "draft"
last_updated: "2026-02-26"
title: "Agent Orchestration Plan"
---

# Agent Orchestration Plan

## 1. Purpose

This document defines a V1 architecture and operating model for coordinating multiple coding agents on OpenClaw tasks.

It covers:

- architecture
- workflow
- task lifecycle
- retries and idempotency
- CI gates
- daily operating commands

This is a plan, not a claim that every component below already exists.

## 2. Goals and non-goals

### Goals

- Make task execution predictable across multiple agents and worktrees.
- Keep task state durable and auditable.
- Prevent duplicate work and duplicate PR actions.
- Fail safely when CI, GitHub, or agent runs are flaky.
- Give operators a short set of daily commands for triage and recovery.

### Non-goals (V1)

- Fully autonomous merge-to-main with no human review.
- Cross-repo dependency orchestration.
- Replacing existing repo standards (`AGENTS.md`, commit workflow, PR review norms).

## 3. Architecture (V1)

### Core components

1. `Planner`

- Converts an issue/request into executable tasks.
- Defines acceptance criteria, file scope, and CI expectations.
- Splits large work into independently reviewable units.

2. `Task Queue`

- Stores task records and scheduling metadata.
- Supports priority, retries, lease timeouts, and operator overrides.
- Enforces idempotency keys for enqueue and state transitions.

3. `Orchestrator`

- Assigns queued tasks to agents/worktrees.
- Manages leases and heartbeats.
- Advances task state based on agent reports, CI status, and PR events.
- Triggers retries or marks tasks blocked/failure.

4. `Agent Workers`

- Execute tasks in isolated worktrees/branches.
- Read repo instructions (`AGENTS.md`) and follow local workflows.
- Produce artifacts: diffs, commit SHAs, PR links, logs, test output summaries.

5. `State Store`

- Durable source of truth for tasks, attempts, leases, and outcomes.
- Stores timestamps, actor IDs, retry counters, and external IDs (PR, run ID).

6. `CI/GitHub Integrations`

- Observes PR checks and workflow runs.
- Maps CI results back to task attempts.
- Prevents completion until required gates are green.

7. `Operator Console` (CLI-first in V1)

- Queue triage
- retry/cancel/unblock actions
- stale lease recovery
- CI reconciliation

### Data model (minimum)

`Task`

- `taskId`
- `source` (issue, manual request, batch)
- `summary`
- `status`
- `priority`
- `branch`
- `prNumber` / `prUrl`
- `ciPolicy`
- `createdAt`, `updatedAt`

`Attempt`

- `attemptId`
- `taskId`
- `agentId`
- `worktreePath`
- `leaseId`
- `status`
- `retryIndex`
- `startedAt`, `endedAt`
- `failureClass` (`transient`, `deterministic`, `operator`, `ci`)

`Lease`

- `leaseId`
- `taskId`
- `agentId`
- `heartbeatAt`
- `expiresAt`

### Invariants

- A task has at most one active lease.
- State transitions are append-only in the event log (even if task row is mutable).
- Retry scheduling is idempotent for the same failure event.
- PR creation is idempotent per task branch.
- Completion requires CI gates + required review state (policy-driven).

## 4. Workflow

### Intake and planning

1. Operator creates or imports a task.
2. Planner validates scope, acceptance criteria, and ownership.
3. Task is normalized into a runnable unit:
   - file scope
   - expected commands/tests
   - delivery target (commit only vs PR)
   - CI gate policy
4. Task enters `ready`.

### Dispatch and execution

1. Orchestrator selects a task by priority + freshness + retry backoff.
2. Orchestrator assigns a lease to an available agent.
3. Agent worker executes in its assigned worktree/branch.
4. Worker reports progress heartbeats and structured outcomes:
   - success with diff/commit/PR
   - retryable failure
   - non-retryable failure
   - blocked (needs human input)

### Review and CI

1. If code/doc changes exist, worker creates a scoped commit and pushes branch.
2. Worker opens/updates PR.
3. Orchestrator waits for required CI gates.
4. Failures route to:
   - automatic retry (transient)
   - worker re-run with same branch (fixable)
   - operator intervention (blocked/policy)

### Completion

A task is `completed` only when:

- requested artifacts exist (doc/file change, commit, PR as applicable)
- CI gates are green (or explicitly waived by policy/operator)
- task output is recorded in the state store

## 5. Task lifecycle

### Task states

- `draft`: created but not yet validated
- `ready`: validated and eligible for dispatch
- `leased`: assigned to an agent; waiting for worker start/heartbeat
- `running`: worker is actively executing
- `awaiting_pr`: worker finished local changes and must publish PR artifacts
- `awaiting_ci`: PR/checks in progress
- `changes_requested`: follow-up required after review or CI failure
- `retry_scheduled`: transient failure; backoff timer active
- `blocked`: needs human input/approval/secret/access
- `failed`: terminal failure after retry budget exhausted
- `cancelled`: intentionally stopped
- `completed`: all gates satisfied

### Task transition rules (V1)

- `draft -> ready` after planner validation
- `ready -> leased -> running` after lease acquire + first heartbeat
- `running -> awaiting_pr` when local changes are prepared
- `awaiting_pr -> awaiting_ci` after PR open/update succeeds
- `awaiting_ci -> completed` when required checks pass
- `running/awaiting_pr/awaiting_ci -> retry_scheduled` on retryable failure
- `retry_scheduled -> ready` when backoff expires
- `* -> blocked` when missing input or manual approval is required
- `* -> cancelled` by operator action
- `* -> failed` when retry budget is exhausted or failure is non-retryable

### Attempt lifecycle

- `queued`
- `leased`
- `started`
- `succeeded`
- `failed_retryable`
- `failed_terminal`
- `cancelled`
- `expired` (lease heartbeat timeout)

## 6. Retries and idempotency

### Failure classification

Retryable by default:

- network/API timeout
- GitHub API 5xx / rate limit (after backoff)
- package registry/network fetch failure
- CI runner infrastructure failure
- transient merge race (rebase/push conflict)

Usually non-retryable:

- syntax/type/test failure caused by task changes
- permission denied due to missing access/secret
- invalid task spec or impossible acceptance criteria
- policy violation (forbidden file/path/action)

Operator-decision:

- flaky test failures in historically unstable suites
- reviewer-requested changes
- partial success with ambiguous repo state

### Retry policy (recommended V1)

- Max automatic retries per task: `3`
- Backoff: exponential with jitter (`1m`, `5m`, `15m`)
- Separate budgets:
  - worker execution retries
  - PR/CI observation retries
- Reset retry budget only on a materially new diff/commit (not on polling retries)

### Idempotency keys

Use idempotency keys for side-effecting operations:

- `enqueue:<external-request-id>`
- `lease:<taskId>:<retryIndex>`
- `commit:<taskId>:<tree-hash>`
- `push:<taskId>:<branch>:<commitSha>`
- `pr-create:<taskId>:<branch>`
- `ci-rerun:<taskId>:<runId>`

If an operation is retried with the same key, return the recorded result instead of repeating the side effect.

### Stale lease recovery

- Agent sends heartbeat during execution.
- Orchestrator expires lease if heartbeat is older than threshold (for example `10m`).
- Expired attempts become `expired`, and task moves to `retry_scheduled` or `blocked` depending on prior attempt history.
- Recovery should not assume the worker is gone; all follow-up actions must remain idempotent.

## 7. CI gates

CI gates should be policy-driven per task type but conservative by default.

### Gate classes

1. Local preflight (worker-side)

- formatting/lint checks for changed files
- targeted tests when scope is clear
- required repo-specific checks before commit/PR

2. PR checks (GitHub Actions / external CI)

- required status checks must pass
- no required check may be pending or failed
- reruns are tracked as attempt metadata

3. Human review gates

- required reviewer approval (if policy enabled)
- no unresolved blocking review comments

### Recommended repo checks for OpenClaw changes

- `pnpm check`
- `pnpm build`
- `pnpm test` (or targeted Vitest commands when explicitly scoped)

For resource-constrained retries / operator triage, use the documented low-memory profile:

```bash
OPENCLAW_TEST_PROFILE=low OPENCLAW_TEST_SERIAL_GATEWAY=1 pnpm test
```

### Docs-only fast path (policy option)

For docs-only tasks, allow a lighter gate set:

- docs lint/format checks (if configured)
- link/build checks (if configured)
- skip full runtime test matrix unless the doc changes operational commands or code snippets that need validation

## 8. Daily operating commands (CLI-first)

These are the routine commands for an operator running orchestration manually or diagnosing automation behavior in this repo.

### Repo + branch hygiene

```bash
git status --short
git branch --show-current
git fetch origin --prune
git log --oneline --decorate -5
```

### Dependency and baseline checks

```bash
pnpm install
pnpm check
pnpm build
pnpm test
```

### Lower-memory test retry path

```bash
OPENCLAW_TEST_PROFILE=low OPENCLAW_TEST_SERIAL_GATEWAY=1 pnpm test
```

### Scoped commit workflow (repo standard)

```bash
scripts/committer "Docs: add agent orchestration plan" docs/agent-orchestration-plan.md
```

### PR and CI triage

```bash
gh pr status
gh pr view --web
gh pr checks --watch
gh run list --limit 20
gh run watch <run-id>
gh run rerun <run-id> --failed
```

### Search for duplicate work before opening follow-ups

```bash
gh search prs --repo openclaw/openclaw --match title,body --limit 50 -- "orchestration plan"
gh search issues --repo openclaw/openclaw --match title,body --limit 50 -- "agent orchestration"
```

### Quick recovery checklist (manual)

1. Confirm branch/worktree state (`git status --short`).
2. Confirm task/PR link and latest CI failure reason.
3. Classify failure (`transient` vs `deterministic` vs `blocked`).
4. Retry only idempotent steps first (CI rerun / poll / fetch).
5. Re-run worker execution only after recording the previous attempt outcome.

## 9. Operator guardrails

- Do not use `git stash` as part of automated retries.
- Do not force-push over unrelated work on shared branches.
- Keep commit scope tied to the task output.
- Record exact failure messages and CI run links before retrying.
- Prefer explicit `blocked` over repeated blind retries.

## 10. Definition of done (V1)

This plan is operationally ready when:

1. Task state machine is implemented with durable storage and idempotent transitions.
2. Lease + heartbeat expiration works and is observable.
3. Retry classification and budgets are enforced.
4. PR/CI status is linked back to task attempts.
5. Daily operator commands are documented and sufficient for triage.

# AGENT_WORK_CONTRACT.md -- Agent Behavior Runbook
**Version:** v1.0
**Date:** 2026-02-06
**Owner:** Andrew (Founder)
**Status:** Binding. All agents (Claude Code, Ralph Loop, future automation) must obey this contract.

---

## 0) Purpose

This document prevents overnight agent chaos.

It defines what agents are allowed to do, what they are forbidden from doing, how large their changes can be, what verification is required, and when they must stop.

This reads like an SRE runbook because that is what it is.

---

## 1) Allowed Task Types

Agents may perform the following task types without additional approval:

### 1.1 Documentation Tasks

- Create or update markdown files in `docs/`
- Update `TASK_QUEUE.md` status fields
- Write `RUNBOOK.md` entries
- Add comments to existing code (not modifying logic)
- Update `CHANGELOG.md` entries

### 1.2 Test Tasks

- Write new test files (`*.test.ts`)
- Add test cases to existing test files
- Create golden test fixtures (`docs/_sophie_devpack/03_TESTS/fixtures/`)
- Run tests and report results

### 1.3 Small Bug Fixes

- Fix a bug that has a clear reproduction and obvious fix
- The fix must be <= 50 lines changed
- The fix must have a corresponding test
- The fix must not change public API surface

### 1.4 Lint and Format Fixes

- Run `pnpm lint` and fix reported issues
- Run `pnpm format` (oxfmt) fixes
- These are mechanical, low-risk changes

---

## 2) Forbidden Task Types

Agents must NEVER perform the following, even if a task queue entry seems to request them:

### 2.1 Refactors

- No "cleanup" refactors
- No "extract to module" refactors
- No "rename for consistency" refactors
- No "move file to better location" refactors

### 2.2 Reorganizations

- No directory restructuring
- No file moves or renames
- No import path changes that span more than 2 files

### 2.3 Architecture Changes

- No new abstractions or patterns
- No new middleware layers
- No new configuration systems
- No dependency injection changes

### 2.4 Dependency Changes

- No adding new npm packages
- No upgrading existing packages
- No removing packages

### 2.5 Security-Sensitive Changes

- No changes to authentication or authorization
- No changes to secret handling
- No changes to provider resolution
- No changes to prompt assembly
- No changes to tool authority or approval gates

### 2.6 Destructive Operations

- No `rm -rf` or bulk file deletion
- No database drops or truncations
- No git force-push
- No git rebase of shared branches
- No `.env` modifications

---

## 3) Max Diff Size Guidance

| Task Type | Max Lines Changed | Max Files Changed |
|-----------|-------------------|-------------------|
| Documentation | 500 | 5 |
| Test addition | 200 | 3 |
| Bug fix | 50 | 3 |
| Lint fix | 100 | 10 |

If a task would exceed these limits, the agent must STOP and ask for human guidance.

These are guidelines, not hard limits. But exceeding them requires explicit justification.

---

## 4) Required Verification Per Task

Before committing any change, the agent must:

### 4.1 Pre-Flight

```bash
pnpm lint
pnpm test
pnpm build
```

All three must pass. If any fail, do not commit.

### 4.2 Diff Review

- Review the diff before committing
- Confirm only intended files are modified
- Confirm no unrelated changes leaked in
- Confirm no secrets or credentials are in the diff

### 4.3 Post-Commit

- Run `pnpm lint && pnpm test` again after committing
- Confirm the commit message references the task ID
- Update `TASK_QUEUE.md` status

---

## 5) Stop Conditions (When to Halt and Ask)

The agent must immediately stop and request human input if:

### 5.1 Ambiguity

- The task description is unclear
- Multiple valid implementations exist
- The Definition of Done is not testable

### 5.2 Risk

- The change touches provider resolution or model defaults
- The change touches prompt assembly or the prompt stack
- The change touches authentication, secrets, or security gates
- The change modifies a contract document
- The change could affect external systems (email, databases, APIs)

### 5.3 Failure

- Tests fail after the change
- Build fails after the change
- Lint reports errors that cannot be mechanically fixed
- A regression is detected in unrelated functionality

### 5.4 Scale

- The task requires changing more than 3 files
- The diff exceeds 100 lines
- The task has been in progress for more than 30 minutes without visible progress

### 5.5 Conflict

- Two governance documents contradict each other
- The task queue entry conflicts with `CLAUDE.md` rules
- The developer handoff contradicts current code behavior

---

## 6) Branch and Commit Rules

### 6.1 Branch Naming

```
sophie/YYYYMMDD-<task-slug>
```

Example: `sophie/20260206-add-session-test`

### 6.2 Commit Messages

- Concise, action-oriented
- Reference task ID from `TASK_QUEUE.md`
- Example: `test: add session key format test (TEST-003)`

### 6.3 One Task Per Branch

- Each branch contains exactly one task
- No mixing of unrelated changes
- No "while I was here" additions

### 6.4 No Auto-Merge

- Agents create branches
- Agents do not merge branches
- All merges require human review and approval

---

## 7) Overnight / Unattended Operation Rules

When running without human supervision (overnight, batch mode):

- Process only READY tasks from `TASK_QUEUE.md`
- Process one task at a time
- Stop on first failure
- Log every action to `TASK_QUEUE.md` or a loop log
- Do not retry failed tasks without human review
- Do not escalate permissions or authority
- Do not modify governance documents
- If all READY tasks are complete, stop gracefully

---

## 8) Escalation Protocol

If an agent encounters a situation not covered by this contract:

1. Do not guess
2. Do not proceed
3. Document the situation clearly
4. Mark the task as BLOCKED in `TASK_QUEUE.md`
5. Wait for human input

The default answer to "should I do this?" is **no** unless this contract explicitly says yes.

---

## 9) Contract Enforcement

This contract is enforced by:

- `CLAUDE.md` (references this document)
- Code review of agent-created branches
- CI pipeline (lint, test, build gates)
- Human approval of all merges

Violations of this contract are treated as bugs in the agent's behavior, not features.

---

**End of agent work contract.**

# TASK_QUEUE.md -- Agent Task Queue
**Version:** v1.0
**Date:** 2026-02-06
**Owner:** Andrew (Founder)
**Status:** Active. This is the only place agents pull work from.

---

## 0) Rules

- Agents must only work on tasks listed in this file
- Agents must only work on tasks with status `READY`
- Agents must set status to `IN_PROGRESS` before starting work
- Agents must set status to `COMPLETED` or `FAILED` when done
- Only one task may be `IN_PROGRESS` at a time
- Tasks not in this file are not authorized

### Status Values

| Status | Meaning |
|--------|---------|
| READY | Prerequisites met. Safe to execute. |
| BLOCKED | Prerequisites missing. Do not attempt. |
| IN_PROGRESS | Currently being worked. Lock held. |
| COMPLETED | Done. Verified. |
| FAILED | Attempted and failed. Needs human review. |

### Task Entry Format

```
### <TASK-ID>: <Short Description>
- **Status:** READY | BLOCKED | IN_PROGRESS | COMPLETED | FAILED
- **Type:** docs | test | fix | feature
- **Prerequisites:** List of required tasks or conditions
- **Definition of Done:** What must be true for this to be complete
- **Max Diff:** Estimated lines changed
- **Notes:** Additional context
- **Assigned:** <agent name or "unassigned">
- **Branch:** <branch name if in progress>
- **Completed:** <date if completed>
```

---

## 1) Active Tasks

<!-- No active tasks yet. Add tasks here following the format above. -->

---

## 2) Example Tasks (FOR REFERENCE ONLY -- DO NOT EXECUTE)

> The tasks below are examples showing correct format. They are marked EXAMPLE
> and must not be executed. Remove this section when real tasks are added.

### EXAMPLE-001: Add unit test for session key format
- **Status:** EXAMPLE (not a real task)
- **Type:** test
- **Prerequisites:** None
- **Definition of Done:** Test file exists at `src/gateway/session-key.test.ts`; asserts canonical key format `agent:{agentId}:{channel}:{accountId}:dm:{peerId}`; `pnpm test` passes.
- **Max Diff:** ~50 lines
- **Notes:** See `docs/_sophie_devpack/02_CONTRACTS/interfaces_contracts_spec_sophie_moltbot.md` section 5.1 for key format spec.
- **Assigned:** unassigned
- **Branch:** --
- **Completed:** --

### EXAMPLE-002: Document moonshot smoke test procedure
- **Status:** EXAMPLE (not a real task)
- **Type:** docs
- **Prerequisites:** None
- **Definition of Done:** `RUNBOOK.md` updated with moonshot smoke test steps; includes expected output; references `pnpm moltbot moonshot:smoke`.
- **Max Diff:** ~30 lines
- **Notes:** Smoke test already exists. This is documentation only.
- **Assigned:** unassigned
- **Branch:** --
- **Completed:** --

### EXAMPLE-003: Fix typo in startup log message
- **Status:** EXAMPLE (not a real task)
- **Type:** fix
- **Prerequisites:** None
- **Definition of Done:** Typo corrected in `src/gateway/server-startup-log.ts`; no logic changes; `pnpm test` passes.
- **Max Diff:** 1 line
- **Notes:** Minimal diff. No behavior change.
- **Assigned:** unassigned
- **Branch:** --
- **Completed:** --

---

## 3) Completed Tasks

<!-- Move completed tasks here with their completion date. -->

---

## 4) Failed / Blocked Tasks

<!-- Move failed or blocked tasks here with explanation. -->

---

## 5) Cross-References

- For Sophie implementation roadmap: `docs/_sophie_devpack/TODO_QUEUE.md`
- For agent behavior rules: `AGENT_WORK_CONTRACT.md`
- For verification procedures: `RUNBOOK.md`
- For authority rules: `CLAUDE.md`

---

**End of task queue.**

---
summary: "Migrating from markdown-based workflows to the task scheduler"
read_when:
  - Refactoring a skill from markdown state to structured pipelines
  - Moving from file-based workflows to scheduler-managed jobs
title: "Scheduler Migration Guide"
---

# Scheduler Migration Guide

This guide walks through migrating from markdown-based workflows to
structured pipelines managed by the
[standalone scheduler](standalone-scheduler.md). For the full
scheduler API and primitives, see the
[scheduler RFC](standalone-scheduler.md). For application-layer
patterns, see [scheduler patterns](scheduler-patterns.md).

## 1. When to migrate

### Signs your markdown workflow has outgrown its design

- **Multiple agents scanning the same file for state.** Two agents
  reading and writing `projects.md` creates race conditions. One
  agent's edit overwrites the other's.
- **"Agent forgot X after compaction" bugs.** When context is
  compacted, state stored only in markdown vanishes. The agent loses
  track of what it was doing.
- **No audit trail for decisions.** You cannot tell why a decision
  was made, when it happened, or what data it was based on. The
  markdown only shows the current state, not the history.
- **Manual recovery after crashes.** If the agent crashes mid-edit,
  the markdown may be in an inconsistent state. There is no
  rollback, no transaction log, no way to recover automatically.
- **Race conditions between readers and writers.** Heartbeat tasks
  that scan markdown for changes compete with agents that update
  the same file. Data is silently lost.

### When NOT to migrate

Not everything belongs in a scheduler pipeline:

- **Simple reference docs.** A `TOOLS.md` with SSH hosts and ports
  is fine as markdown. It is read-only state that humans maintain.
- **Human-curated notes.** Meeting notes, brainstorming docs, and
  design documents are authored by humans and consumed by humans.
  Markdown is the right format.
- **Configuration files.** Static config that changes rarely and is
  edited by hand does not benefit from scheduler orchestration.

The rule of thumb: if an agent reads a markdown file, makes a
decision based on its contents, and writes back to the same file,
that workflow is a candidate for migration.

## 2. The migration pattern

```text
MD-based state
  → Identify data vs. presentation
    → Data → JSON / SQLite / DB (source of truth)
        → Scheduler jobs read/write structured state
    → Presentation → Optional export job (tail of chain)
        → Markdown becomes derived view, not source of truth
```

The key insight is separating **data** (things agents act on) from
**presentation** (things humans read). In a markdown workflow, these
are tangled together. In a scheduler pipeline, data lives in
structured storage and markdown is an optional output.

## 3. Step-by-step refactoring

### Step 1: Identify state in your markdown

Look for anything that changes over time:

- **Checklists** (`- [ ]` / `- [x]`) — these are boolean state
  fields.
- **Status fields** (`status: in-progress`) — these are enum
  values.
- **Dates** (`due: 2026-03-01`) — these are temporal constraints.
- **Counts** (`attempts: 3`) — these are numeric accumulators.
- **Decisions** (`approved by @alex on 2026-02-20`) — these are
  audit-worthy events.
- **Constraints** (`max budget: $500`) — these are rules that gate
  actions.

If your markdown contains any of these, you have data trapped in
prose.

### Step 2: Extract to structured format

Move each piece of state to a JSON file or SQLite table with an
explicit schema:

```json
{
  "id": "proj-001",
  "name": "Deploy v2.0",
  "owner": "alex",
  "due": "2026-03-01",
  "status": "in-progress",
  "updated_at": "2026-02-20T14:30:00Z"
}
```

Every field has a type. Every record has a timestamp. No more
parsing prose to extract status.

### Step 3: Create capture jobs

Replace "agent scans markdown on heartbeat" with scheduled capture
jobs that write to structured state:

```json
{
  "name": "project.sync",
  "schedule": "0 */6 * * *",
  "session": "isolated",
  "delivery_guarantee": "at-most-once",
  "overlap_policy": "skip",
  "payload": "Check external sources for project updates. Write changes to data/projects.json. If any project status changed, include PROJECT_UPDATED in your response."
}
```

The capture job runs on a schedule, writes to a well-defined data
file, and emits a signal when something changes. No more scanning
a markdown file hoping the format has not drifted.

### Step 4: Create processing chains

Replace "agent reads markdown and decides" with chained jobs:

```text
capture → analyze → decide → act
```

Each step has a clear input (the data file), a clear output (an
updated data file plus a signal), and a clear trigger:

```json
{
  "name": "project.check",
  "parent_id": "<project.sync job ID>",
  "trigger_on": "success",
  "trigger_condition": "contains:PROJECT_UPDATED",
  "session": "isolated",
  "payload": "Read data/projects.json. Check for overdue projects or approaching deadlines. If any project needs attention, include ALERT_NEEDED in your response."
}
```

### Step 5: Add optional markdown export

If humans still want a readable view, add a tail job that generates
markdown from structured state:

```json
{
  "name": "project.report",
  "parent_id": "<project.check job ID>",
  "trigger_on": "complete",
  "session": "isolated",
  "delivery_guarantee": "at-most-once",
  "payload": "Read data/projects.json. Generate a markdown summary at reports/projects.md with current status, upcoming deadlines, and recent changes."
}
```

`delivery_guarantee: "at-most-once"` is correct here. If the
export job fails, no data is lost — the source of truth is
`projects.json`. The next successful run regenerates the view.

## 4. Concrete example: refactoring a project tracker

### Before: markdown-based

```markdown
# Active Projects

- [ ] Deploy v2.0 — owner: @alex — due: 2026-03-01 — status: in-progress
- [x] Fix login bug — owner: @dana — due: 2026-02-15 — status: done
```

An agent scans this file on a heartbeat, parses the checkboxes,
updates status fields, and writes back to the same file. After
context compaction, the agent forgets which projects it has already
checked. If two agents scan simultaneously, one overwrites the
other's changes.

### After: scheduler-based

**Data store:** `data/projects.json`

```json
[
  {
    "id": "proj-001",
    "name": "Deploy v2.0",
    "owner": "alex",
    "due": "2026-03-01",
    "status": "in-progress",
    "updated_at": "2026-02-22T10:00:00Z"
  },
  {
    "id": "proj-002",
    "name": "Fix login bug",
    "owner": "dana",
    "due": "2026-02-15",
    "status": "done",
    "updated_at": "2026-02-15T16:30:00Z"
  }
]
```

**Pipeline:**

- `project.sync` — scheduled job that checks external sources and
  updates `projects.json`. Emits `PROJECT_UPDATED` on changes.
- `project.check` — chain-triggered by `project.sync`. Evaluates
  deadlines, detects overdue items, sends alerts. Emits
  `ALERT_NEEDED` when action is required.
- `project.report` — chain-triggered tail job. Generates a markdown
  view from `projects.json` for human consumption. Optional; if it
  fails, no data is lost.

Each job has its own execution context. No shared mutable markdown
file. No race conditions. Full audit trail via typed messages.

## 5. Preserving agent memory during migration

Migration does not have to be a hard cutover. Preserve continuity:

- **Do not delete the old markdown immediately.** Keep it as a
  read-only reference during the transition period. Remove it only
  after the pipeline has been stable for a full cycle.
- **Run both systems in parallel.** Let the old heartbeat-based
  workflow and the new scheduler pipeline coexist. Compare their
  outputs to catch discrepancies.
- **Use `context_retrieval: "recent"`** so jobs can reference their
  own recent history. This gives the agent awareness of what it did
  in previous runs, replacing the context it used to get from
  reading the markdown file.
- **Use typed messages for audit trails.** Messages with
  `kind: "decision"` create a permanent record of choices that the
  old markdown system never captured. After migration, you will
  have better memory than before — not worse.

## 6. What you lose (and why it's worth it)

| You lose                    | You gain                                                                  |
| --------------------------- | ------------------------------------------------------------------------- |
| Human-editable state        | Programmatic state + optional human-readable export                       |
| Simplicity of a single file | Reliability, audit trail, crash recovery, concurrency safety              |
| Immediate visibility        | CLI inspection + export jobs that provide the same view — with guarantees |

The markdown file felt simple because it combined data and
presentation in one place. But that simplicity was fragile: one
crash, one compaction, one race condition, and the state was
corrupted with no recovery path.

The scheduler pipeline separates concerns. Data is safe in
structured storage. Presentation is a derived view that can be
regenerated at any time. The audit trail captures every decision,
every state change, every signal — something the markdown file
never provided.

## 7. Migration checklist

<!-- markdownlint-disable MD034 -->

- [ ] Identified all state in markdown files
- [ ] Extracted state to structured format (JSON/SQLite)
- [ ] Created scheduler jobs for each workflow step
- [ ] Set delivery guarantees per job
- [ ] Added task contracts for validated pipeline steps
- [ ] Created optional export job for human-readable view
- [ ] Ran both systems in parallel for validation
- [ ] Verified audit trail captures all decisions
- [ ] Removed old markdown-scanning heartbeat tasks

<!-- markdownlint-enable MD034 -->

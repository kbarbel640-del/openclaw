---
name: run-pr
description: Full end-to-end agent-driven PR pipeline. Chains review, prepare, validate, and merge into an unattended workflow with auto-stop on non-READY reviews.
---

# Run PR (Full Pipeline)

## Overview

Orchestrate the complete PR lifecycle in a single agent-driven session: review → prepare → validate → merge. The agent performs the review, then the script handles recommendation gating, preparation, validation, and merge end-to-end.

## Inputs

- Ask for PR number or URL.
- If missing, always ask.

## Safety

- Follows all safety rules from individual skills.
- Auto-stops if review recommendation is not `READY FOR /prepare-pr`.
- Uses deterministic squash merge with SHA pinning.
- Wrapper commands are cwd-agnostic.

## Execution Contract

Single command, auto-resumable:

```sh
scripts/pr-run <PR>
# or equivalently:
scripts/pr run <PR>
```

The command auto-detects pipeline state and resumes:

| State                         | Action                                                             |
| ----------------------------- | ------------------------------------------------------------------ |
| No worktree                   | Bootstrap review (create worktree, fetch metadata, init templates) |
| Review artifacts incomplete   | Prompt agent to fill `.local/review.md` + `.local/review.json`     |
| Recommendation not READY      | Stop with findings summary                                         |
| Review complete, no prep      | Run prepare → validate → merge                                     |
| Prepare complete, no validate | Run validate → merge                                               |
| Validate complete             | Run merge                                                          |

### Typical agent session

1. Run `scripts/pr-run <PR>` — bootstraps review
2. Agent reads code, fills `.local/review.md` and `.local/review.json`
3. Agent validates: `scripts/pr review-validate-artifacts <PR>`
4. Run `scripts/pr-run <PR>` — same command, now continues through prepare → validate → merge

## Auto-Stop Behavior

The pipeline automatically stops with a non-zero exit code when:

- Review recommendation is anything other than `READY FOR /prepare-pr` (e.g., `NEEDS WORK`, `NEEDS DISCUSSION`, `NOT USEFUL (CLOSE)`)
- Any gate fails (build, check, test)
- CI checks fail or remain pending
- PR head SHA drifts between stages
- Merge fails

When stopped, fix the issue and re-run `scripts/pr-run <PR>`. Already-completed stages are skipped.

## Produced Artifacts

Full artifact chain in `.worktrees/pr-<PR>/.local/`:

| File                          | Stage          | Content                   |
| ----------------------------- | -------------- | ------------------------- |
| `pr-meta.json`, `pr-meta.env` | review-init    | PR metadata               |
| `review-context.env`          | review-init    | Merge base, timestamps    |
| `review.md`, `review.json`    | review (agent) | Findings, recommendation  |
| `prep-context.env`, `prep.md` | prepare        | Prep context, log         |
| `gates.env`                   | prepare        | Gate results              |
| `prep.env`                    | prepare        | Head SHA, co-author email |
| `validate-ci.env`             | validate       | CI check results          |
| `validate-smoke.env`          | validate       | Smoke test results        |
| `validate.env`                | validate       | Combined validation       |

## Guardrails

- Never skip the recommendation gate.
- Never use `gh pr merge --auto`.
- Require `--match-head-commit` during merge.
- The review phase is always agent-driven (not scriptable).
- Each stage writes artifacts that subsequent stages require.

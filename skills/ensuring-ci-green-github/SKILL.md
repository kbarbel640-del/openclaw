---
name: ensuring-ci-green-github
description: Monitors GitHub Actions workflows and fixes failures until all required checks pass. Use when GitHub Actions is failing, PR checks are blocked, a workflow needs debugging, or user says "make CI green" on GitHub.
---

# Ensuring CI Green (GitHub Actions)

Autonomous workflow to monitor, diagnose, and fix GitHub Actions failures until all required checks pass.

## Contents

- [Quick Reference](#quick-reference)
- [Workflow](#workflow)
- [Step 1: Identify PR and Required Checks](#step-1-identify-pr-and-required-checks)
- [Step 2: Monitor Runs](#step-2-monitor-runs)
- [Step 3: Diagnose Failures](#step-3-diagnose-failures)
- [Step 4: Fix and Retry](#step-4-fix-and-retry)
- [Common Failure Patterns](#common-failure-patterns)
- [Gotchas](#gotchas)
- [Verification](#verification)
- **Reference Files:**
  - [references/actions-api.md](references/actions-api.md) - GitHub Actions REST endpoints via `gh api`
- **Related Skills:**
  - `/consulting-other-llms` - Second opinions after repeated failures
  - `/reproducing-bugs` - Capture before/after evidence when debugging

## Quick Reference

| Task                      | Command                                         |
| ------------------------- | ----------------------------------------------- |
| List PR checks (required) | `gh pr checks --required`                       |
| Watch PR checks           | `gh pr checks --watch --fail-fast`              |
| List runs                 | `gh run list -L 20`                             |
| View run summary          | `gh run view <run-id>`                          |
| View failed logs          | `gh run view <run-id> --log-failed`             |
| Watch a run               | `gh run watch <run-id> --exit-status`           |
| Re-run failed jobs        | `gh run rerun <run-id> --failed`                |
| Re-run a specific job     | `gh run rerun <run-id> --job <databaseId>`      |
| Cancel a run              | `gh run cancel <run-id> --force`                |
| Download artifacts        | `gh run download <run-id> -D ./artifacts`       |
| Trigger workflow dispatch | `gh workflow run <workflow.yml> --ref <branch>` |

## Workflow

```
1. Identify PR + required checks
2. Monitor runs with early-failure detection
3. Diagnose failures (logs, job details, artifacts)
4. Fix code and verify locally
5. Re-run failed jobs or dispatch workflow
6. Repeat until all required checks pass
```

**Stop conditions:**

- Infrastructure/outage or GitHub incident (report to user)
- Flaky tests repeated >2 times (quarantine + track)
- Same fix fails twice (escalate to /consulting-other-llms)

## Step 1: Identify PR and Required Checks

### Fast path (current branch)

```bash
# Required checks for the PR associated with the current branch
# (gh chooses the PR automatically when possible)
gh pr checks --required
```

### If you need the PR explicitly

```bash
# Pass a PR number, URL, or branch
# Example: gh pr checks 123 --required
gh pr checks <PR> --required
```

### Find the relevant workflow runs

```bash
# Runs for the repo (use -b to scope to a branch)
gh run list -L 20 -b <branch>

# To see runs tied to a PR, use gh pr checks
# (gh run list does not show PR checks directly)
gh pr checks --required
```

## Step 2: Monitor Runs

### Watch required checks on a PR

```bash
# Fail fast on the first failed check
gh pr checks --watch --fail-fast
```

### Watch a specific run by ID

```bash
# Exit with the run's conclusion (success/failure)
gh run watch <run-id> --exit-status
```

### Scriptable status polling

```bash
# Get structured status for a run
# Useful fields: status, conclusion, jobs

gh run view <run-id> --json status,conclusion,jobs
```

**Interpretation (required checks):**

- Only required checks with `bucket == pass` are acceptable (other buckets include `fail`, `pending`, `skipping`, `cancel`).
- `gh pr checks` exits with code 8 if any checks are pending.

## Step 3: Diagnose Failures

### Immediate log capture

```bash
# Failed steps only (fastest signal)
gh run view <run-id> --log-failed

# Full logs (can be large)
gh run view <run-id> --log
```

### Focus on a single job

```bash
# Get job database IDs for targeted reruns/logs
gh run view <run-id> --json jobs --jq '.jobs[] | {name, databaseId}'

# View a specific job's logs
# (use the databaseId from the query above)
gh run view <run-id> --job <databaseId>
```

### Artifacts and test reports

```bash
# Download all artifacts for inspection
gh run download <run-id> -D ./artifacts
```

### Deep dive (REST via gh api)

Use API endpoints for full job lists, logs, and reruns. See:

- [references/actions-api.md](references/actions-api.md)

## Step 4: Fix and Retry

### After fixing code

```bash
git add -A
git commit -m "Fix CI: <description>"
git push
```

### Re-run CI

```bash
# Re-run only failed jobs
gh run rerun <run-id> --failed

# Re-run a specific job (databaseId)
gh run rerun <run-id> --job <databaseId>

# Trigger workflow_dispatch (if the workflow supports it)
gh workflow run <workflow.yml> --ref <branch>

# Enable runner + step debug logging on reruns
gh run rerun <run-id> --failed --debug
gh run rerun <run-id> --job <databaseId> --debug
```

### Cancel stale runs

```bash
gh run cancel <run-id> --force
```

## Common Failure Patterns

| Pattern            | Symptom                         | Fix                                 |
| ------------------ | ------------------------------- | ----------------------------------- |
| Build error        | Compiler/type errors            | Fix code and re-run                 |
| Test failure       | Assertions fail                 | Fix code or test; rerun failed jobs |
| Lint/format        | Style violations                | Run formatter locally and commit    |
| Timeout            | Job exceeded time limit         | Optimize or split job               |
| Dependency install | lockfile mismatch, cache misses | Clean install, update cache keys    |
| Invalid workflow   | Workflow syntax error           | Fix YAML and push                   |
| Action deprecation | Deprecated action warning/error | Update action versions              |

## Gotchas

- `gh run watch` does not support fine-grained PATs (needs `checks:read`). Use a classic PAT or `gh pr checks --watch` instead.
- `gh run view --log` may fall back to per-job log downloads; if more than 25 job logs are missing the command fails, and some lines can show `UNKNOWN STEP`.
- `gh run list -w <workflow>` only includes disabled workflows if you also pass `-a`.
- `gh run rerun --job` needs the job `databaseId`, not the job number from the URL.

## Verification

### Required checks are green

```bash
# List required checks and ensure all buckets == pass
gh pr checks --required --json name,bucket,state
```

### Run conclusion is success

```bash
gh run view <run-id> --json status,conclusion
```

If any required check is still pending or failed, continue the loop.

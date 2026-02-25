# GitHub Actions API via gh api

Use `gh api` to query Actions data when CLI summaries are insufficient.

## Workflow runs

```bash
# List workflow runs (filter by branch)
gh api /repos/{owner}/{repo}/actions/runs?branch=main

# Get a single workflow run
gh api /repos/{owner}/{repo}/actions/runs/{run_id}

# Re-run a workflow run (optional: enable debug logging)
gh api -X POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun

# Re-run failed jobs only (optional: enable debug logging)
gh api -X POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs
```

## Jobs

```bash
# List jobs for a run
gh api /repos/{owner}/{repo}/actions/runs/{run_id}/jobs

# Get a single job
gh api /repos/{owner}/{repo}/actions/jobs/{job_id}
```

## Logs (ZIP)

```bash
# Download workflow run logs (ZIP)
gh api /repos/{owner}/{repo}/actions/runs/{run_id}/logs > run-logs.zip

# Download job logs (ZIP)
gh api /repos/{owner}/{repo}/actions/jobs/{job_id}/logs > job-logs.zip
```

## Notes

- Log endpoints return ZIP content. Use `> file.zip` to capture.
- Add `--paginate` when lists are long.
- `enable_debug_logging` is supported on rerun endpoints (default false).
- Rerun failed jobs requires `repo` scope for classic PATs, or Actions write permission for fine-grained tokens.

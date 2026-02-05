# NeuronWaves (WIP)

NeuronWaves is an experimental background "reflection" loop.

It runs at random-ish intervals (base interval + jitter) _only when the user has been inactive_.

## Goals

- Keep a small, high-signal "working set" of what matters (CoreMemories + operational state)
- Proactively take safe maintenance actions (format/lint/tests, small refactors)
- Record an audit trail (decision trace) of what was checked and what changed

## Status

MVP (current):

- ✅ background runner + jitter scheduling
- ✅ inactivity gate (best-effort heuristic)
- ✅ decision trace logs under `.openclaw/neuronwaves/logs/*.jsonl`
- ✅ optional GitHub PR comment reporting (best-effort via `gh` CLI)
- 🚧 planner + safe actions
- 🚧 CoreMemories ingestion of wave outcomes

## Autonomy policy

NeuronWaves uses a policy gate for actions.

- Default behavior is **prepare-then-ask** for ASK actions (generate drafts/artifacts first, then ask before external execution).
- A "Dev Approval Mode" can be enabled via policy (more permissive defaults), while still keeping hard limits (rate/spend caps) + audit logs.

Policy file (per workspace):

- `.openclaw/neuronwaves/policy.json`

## Enable (env vars)

NeuronWaves is **disabled by default**.

- `OPENCLAW_NEURONWAVES=1` enable
- `OPENCLAW_NEURONWAVES_INACTIVITY=20m` minimum inactivity window
- `OPENCLAW_NEURONWAVES_BASE=45m` base interval
- `OPENCLAW_NEURONWAVES_JITTER=30m` extra randomized delay
- `OPENCLAW_NEURONWAVES_MAX_WAVE=10m` time budget per wave (reserved for future)

Optional PR reporting:

- `OPENCLAW_NEURONWAVES_PR_COMMENTS=1`
- `OPENCLAW_NEURONWAVES_PR_REPO=openclaw/openclaw`
- `OPENCLAW_NEURONWAVES_PR_NUMBER=9414`

> PR comment posting requires GitHub CLI (`gh`) installed and authenticated.

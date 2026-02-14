# Dispatch Ops Scaffold

This folder contains local and production topology references for running:

- OpenClaw gateway (control plane)
- dispatch-api (data plane)
- postgres (state)
- object storage (attachments/artifacts)
- worker (background jobs)

Use the root scripts for local orchestration:

- `pnpm dispatch:stack:up`
- `pnpm dispatch:stack:status`
- `pnpm dispatch:stack:down`

Runbooks and drill assets:

- `dispatch/ops/runbooks/README.md`
- `dispatch/ops/runbooks/stuck_scheduling.md`
- `dispatch/ops/runbooks/completion_rejection.md`
- `dispatch/ops/runbooks/idempotency_conflict.md`
- `dispatch/ops/runbooks/auth_policy_failure.md`
- `dispatch/ops/runbooks/mvp_06_on_call_drill.md`
- `dispatch/ops/runbooks/mvp_08_pilot_cutover_readiness.md`

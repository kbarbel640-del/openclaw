# Dispatch Operability Runbooks

These runbooks are the operational response set for MVP-06 alerting in `dispatch-api`.

Alert sources:
- `GET /metrics`
- `GET /ops/alerts`
- durable sink files:
  - `DISPATCH_LOG_SINK_PATH`
  - `DISPATCH_METRICS_SINK_PATH`
  - `DISPATCH_ALERTS_SINK_PATH`

Runbook index:
- `stuck_scheduling.md`
- `completion_rejection.md`
- `idempotency_conflict.md`
- `auth_policy_failure.md`
- `mvp_06_on_call_drill.md`

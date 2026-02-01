# Heartbeat efficiency (cost + latency)

Heartbeats are meant to be cheap, boring, and frequent.

This runbook collects patterns to reduce cost/latency and avoid accidental “expensive no-ops.”

## Principles

1) **No-op fast when there’s nothing to do**
- If the heartbeat checklist is empty, do not call external tools.
- If there are no deltas since the last run, emit a heartbeat ack and stop.

2) **Cache + diff, don’t re-scan**
- Store lightweight state (last run timestamp, last seen IDs, hashes) per source.
- Only fetch new items since the last watermark.

3) **Batch checks**
- Prefer a single heartbeat that checks 2–4 sources over many tiny jobs.

4) **Keep prompts tiny**
- Heartbeats should not include large chat history.
- Keep output terse unless something actionable is found.

## Recommended implementation patterns

### A) State file per heartbeat
Keep a small JSON state file, e.g.

```json
{
  "lastRunAt": 0,
  "sources": {
    "email": { "lastId": "..." },
    "x": { "lastSeenTweetId": "..." }
  }
}
```

### B) Delta-only fetch
- Use provider APIs’ “since” cursor when available.
- Otherwise, store a content hash and ignore duplicates.

### C) Cost ceilings
- Route heartbeats to cheaper models (or local) by default.
- Use a fallback chain only when validation fails (not on every run).

## Operator guidance

If a heartbeat is costing money and producing no output:
- shrink the checklist
- add state+diffing
- reduce model size / switch to local
- add a hard stop condition

## Related
- Model routing + receipts: see `docs/runbooks/model-routing-and-cost-receipts.md`

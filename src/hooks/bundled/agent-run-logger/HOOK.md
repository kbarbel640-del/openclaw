---
name: agent-run-logger
description: Logs agent run start and end times to a local file for auditing and debugging.
events:
  - agent:beforeRun
  - agent:afterRun
---

# Agent Run Logger

Appends a line to `~/.openclaw/logs/agent-runs.log` for every agent run.

**Before run:**

```
2026-02-26T21:00:00.000Z START sessionKey=agent:main:main
```

**After run:**

```
2026-02-26T21:00:05.123Z END   sessionKey=agent:main:main duration=5123ms length=420
```

Useful for auditing activity, spotting stuck runs, and measuring response times.

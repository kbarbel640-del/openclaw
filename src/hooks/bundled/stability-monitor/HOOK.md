---
name: stability-monitor
description: "Session metadata tracking (exchange count and duration)"
homepage: https://docs.openclaw.ai/automation/hooks#stability-monitor
metadata:
  {
    "openclaw":
      {
        "emoji": "🛡️",
        "events": ["agent:bootstrap"],
        "export": "handler",
        "requires": {},
        "install": [{ "id": "bundled", "kind": "bundled", "label": "Bundled with OpenClaw" }],
      },
  }
---

# Stability Monitor Hook

Tracks only session metadata for each agent session.

## What It Does

Injects a single session stats line before each agent turn:

- **Session exchange count**
- **Session duration**

## Example Output

```
Session: 36 exchanges | Duration: 1h 31m
```

## Notes

Advanced monitoring features (entropy detection, topic tracking, loop detection) are not available in internal `agent:bootstrap` hooks because message/tool payloads are not exposed there.

Those features require plugin hooks with message access.

## Disabling

To disable this hook:

```bash
openclaw hooks disable stability-monitor
```

Or remove it from your config:

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "stability-monitor": { "enabled": false }
      }
    }
  }
}
```

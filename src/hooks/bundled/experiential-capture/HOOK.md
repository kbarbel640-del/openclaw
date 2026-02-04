---
name: experiential-capture
description: "Capture significant experiential moments as Meridia records — tool results, pre-compaction checkpoints, session summaries, and session transitions"
metadata:
  {
    "openclaw":
      {
        "emoji": "🧠",
        "events": ["agent:tool:result", "agent:precompact", "command:new", "command:stop"],
        "requires": { "config": ["hooks.internal.entries.experiential-capture.enabled"] },
        "install": [{ "id": "bundled", "kind": "bundled", "label": "Bundled with OpenClaw" }],
      },
  }
---

# Experiential Capture (Meridia)

Captures significant experiential moments into a local, append-only record stream (JSONL + SQLite).

## Capture Triggers

| Event               | Priority | Rate Limited | Description                                                 |
| ------------------- | -------- | ------------ | ----------------------------------------------------------- |
| `agent:tool:result` | HIGH     | Yes          | Significant tool results evaluated by heuristic + LLM       |
| `agent:precompact`  | CRITICAL | No           | Pre-compaction checkpoint — last chance before context loss |
| `command:new`       | HIGH     | No           | Session transition — captures session summary synthesis     |
| `command:stop`      | HIGH     | No           | Session end — captures session summary synthesis            |

## Configuration

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "experiential-capture": {
          "enabled": true,
          "dir": "~/.openclaw/meridia",
          "min_significance_threshold": 0.6,
          "max_captures_per_hour": 10,
          "min_interval_ms": 300000,
          "evaluation_model": "google/gemini-3-flash-preview",
          "evaluation_timeout_ms": 3500
        }
      }
    }
  }
}
```

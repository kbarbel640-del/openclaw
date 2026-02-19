---
name: insight-logger
description: "Extract and append operational insights from sessions to docs/ru/insight.md"
homepage: https://docs.openclaw.ai/hooks#insight-logger
metadata:
  {
    "openclaw":
      {
        "emoji": "💡",
        "events": ["command:new"],
        "requires": { "config": ["workspace.dir"] },
        "install": [{ "id": "bundled", "kind": "bundled", "label": "Bundled with OpenClaw" }],
      },
  }
---

# Insight Logger Hook

Automatically extracts operational insights (debugging findings, configuration fixes, architectural decisions) from completed sessions and appends them to `docs/ru/insight.md`.

## What It Does

When you issue `/new` to start a fresh session:

1. **Reads the previous session** transcript (last N messages, default 30)
2. **Checks for insight-worthy content** — problems found, root causes identified, fixes applied
3. **Generates structured insight** via LLM in Russian, following the established format (Symptoms / Root Cause / Fix)
4. **Appends to `docs/ru/insight.md`** — the project's operational knowledge base
5. **Skips if no insights** — sessions without debugging/operational content are ignored

## Configuration

| Option     | Type   | Default | Description                                          |
| ---------- | ------ | ------- | ---------------------------------------------------- |
| `messages` | number | 30      | Number of messages to read from the previous session |

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "insight-logger": {
          "enabled": true,
          "messages": 30
        }
      }
    }
  }
}
```

## Disabling

```bash
openclaw hooks disable insight-logger
```

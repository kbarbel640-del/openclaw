---
name: pre-compaction-flush
description: "Inject a memory-flush system event before compaction"
homepage: https://docs.openclaw.ai/hooks#pre-compaction-flush
metadata:
  {
    "openclaw":
      {
        "emoji": "💾",
        "events": ["command:compact"],
        "requires": { "config": ["workspace.dir"] },
        "install": [{ "id": "bundled", "kind": "bundled", "label": "Bundled with OpenClaw" }],
      },
  }
---

# Pre-Compaction Flush Hook

Injects a system event before `/compact` to remind the agent to flush memory.

## What It Does

When `/compact` is issued:

1. **Injects a system message** into the session before compaction runs
2. The message tells the agent to update daily logs, PROJECT-STATE files, and create a handoff if needed
3. The agent gets one turn to flush its memory before context is compacted

## Why

Context compaction discards most of the conversation history. Without this hook,
the agent loses track of decisions, progress, and context. This ensures the agent
has a chance to persist important information to files before it happens.

## Configuration

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "pre-compaction-flush": {
          "enabled": true
        }
      }
    }
  }
}
```

## Disabling

```bash
openclaw hooks disable pre-compaction-flush
```

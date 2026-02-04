---
name: compaction
description: "Preserve Meridia continuity state before auto-compaction"
metadata:
  {
    "openclaw":
      {
        "emoji": "🧩",
        "events": ["agent:precompact", "agent:compaction:end"],
        "requires": { "config": ["hooks.internal.entries.compaction.enabled"] },
        "install": [{ "id": "meridia", "kind": "plugin", "label": "Meridia plugin" }],
      },
  }
---

# Compaction (Meridia)

Creates a snapshot before embedded-agent auto-compaction, and records a v2 trace event.

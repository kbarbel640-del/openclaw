---
name: stability-monitor
description: "Session health monitoring with exchange tracking and topic fixation alerts"
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

Real-time session health monitoring for long-running agent sessions.

## What It Does

Injects a `[MEMORY CONTEXT]` block before each agent turn with:

- **Session stats** — Exchange count and duration
- **Topic tracking** — Active topics with fixation warnings

> **Note:** Full entropy tracking (conversation instability detection) and loop detection (repetitive tool calls) require plugin hooks with message access and `after_tool_call` events. These features are architecturally planned but not yet functional in the internal hook system.

## Example Output

```
[MEMORY CONTEXT]
Session: 36 exchanges | Started: 1h 31m ago
Topics: token (fixated x18), config (active), memory (active)
[TOPIC NOTE] 'token' has appeared 18 times recently.
```

## Topic Tracking

Tracks word frequency across a sliding window (default: 6 exchanges).

- **Active topics** — Appeared 1-2 times
- **Fixated topics** — Appeared 3+ times, generates `[TOPIC NOTE]` warning

Topic fixation can indicate the agent is stuck on a concept instead of making progress.

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `topicTracking.enabled` | boolean | true | Enable topic tracking |
| `topicTracking.fixationThreshold` | number | 3 | Topic mentions before fixation warning |
| `topicTracking.windowSize` | number | 6 | Sliding window size in exchanges |
| `context.maxTopics` | number | 5 | Maximum topics to show in output |
| `context.maxNotes` | number | 2 | Maximum fixation notes to show |

Example configuration:

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "stability-monitor": {
          "enabled": true,
          "topicTracking": {
            "fixationThreshold": 3,
            "windowSize": 6
          }
        }
      }
    }
  }
}
```

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

## Best Practices

1. **Topic fixation** — If a topic is fixated, ask yourself if you're making progress or spinning
2. **Long sessions** — Monitor exchange count; very long sessions may benefit from a reset

## Future Enhancements

The following features require plugin hook support (not internal hooks):

- **Entropy tracking** — Requires message content access via plugin hooks
- **Loop detection** — Requires `after_tool_call` event from plugin hook system

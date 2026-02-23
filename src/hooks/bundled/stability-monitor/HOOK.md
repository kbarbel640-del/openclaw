---
name: stability-monitor
description: "Session health monitoring with entropy tracking, loop detection, and topic fixation alerts"
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
- **Entropy score** — Measures conversation instability (0.0 = stable, 1.0+ = critical)
- **Topic tracking** — Active topics with fixation warnings
- **Loop warnings** — Alerts when the agent is stuck in repetitive behavior

## Example Output

```
[MEMORY CONTEXT]
Session: 36 exchanges | Started: 1h 31m ago
Entropy: 0.00 (nominal) | Sustained: 0 turns
Topics: token (fixated x18), config (active), memory (active)
[TOPIC NOTE] 'token' has appeared 18 times recently.
Loop warning: You called 'exec' 5 times in a row. Step back and reassess.
```

## Entropy Detection

Entropy increases when:

| Signal | Entropy Added |
|--------|---------------|
| User correction ("actually", "you're wrong") | +0.4 |
| Emotional escalation ("concerned", "worried") | +0.3 |
| Agent uncertainty ("both are true", "paradox") | +0.2 |
| Agent self-correction ("I realize", "I see now") | +0.2 |
| Temporal mismatch (planning vs claiming done) | +0.3 |

### Status Labels

- **nominal** (0.0 - 0.4): Conversation is stable
- **active** (0.4 - 0.8): Some instability signals detected
- **elevated** (0.8 - 1.0): Multiple instability signals, monitor closely
- **critical** (1.0+): Session may need intervention

## Loop Detection

Detects three types of loops:

1. **Consecutive tool calls** — Same tool called N times in a row (default: 5)
2. **File re-reads** — Same file read N times (default: 3)
3. **Output repetition** — Identical outputs from consecutive calls (default: 3)

## Topic Tracking

Tracks word frequency across a sliding window (default: 6 exchanges).

- **Active topics** — Appeared 1-2 times
- **Fixated topics** — Appeared 3+ times, generates `[TOPIC NOTE]` warning

Topic fixation can indicate the agent is stuck on a concept instead of making progress.

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entropy.warningThreshold` | number | 0.8 | Entropy level for "elevated" status |
| `entropy.criticalThreshold` | number | 1.0 | Entropy level for "critical" status |
| `loopDetection.consecutiveToolThreshold` | number | 5 | Consecutive calls before warning |
| `loopDetection.fileRereadThreshold` | number | 3 | File re-reads before warning |
| `topicTracking.fixationThreshold` | number | 3 | Topic mentions before fixation warning |
| `topicTracking.windowSize` | number | 6 | Sliding window size in exchanges |

Example configuration:

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "stability-monitor": {
          "enabled": true,
          "entropy": {
            "warningThreshold": 0.8,
            "criticalThreshold": 1.0
          },
          "loopDetection": {
            "consecutiveToolThreshold": 5,
            "fileRereadThreshold": 3
          },
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

1. **High entropy** — If entropy stays elevated for multiple turns, consider asking for clarification
2. **Topic fixation** — If a topic is fixated, ask yourself if you're making progress or spinning
3. **Loop warnings** — Stop and reassess your approach when you see a loop warning
4. **Sustained instability** — If entropy is sustained for 45+ minutes, suggest a session reset

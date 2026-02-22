---
name: model-usage
description: Summarize model-level cost usage and basic observability for OpenClaw. Use when you need CodexBar per-model cost (current/all), recent failed or aborted sessions, or a combined overview report for cost + errors.
metadata:
  {
    "openclaw":
      {
        "emoji": "📊",
        "os": ["darwin", "linux"],
        "requires": { "bins": ["codexbar", "openclaw"] },
      },
  }
---

# Model usage + observability

## Overview

A unified script that provides two capabilities:

1. Cost: per-model cost aggregation via CodexBar
2. Observability: failed/aborted session scan via OpenClaw sessions + gateway log hints

## Usage

```bash
# Cost: current model
python {baseDir}/scripts/model_usage.py --provider codex --mode current

# Cost: all models
python {baseDir}/scripts/model_usage.py --provider codex --mode all --days 7

# Errors: recent failed/aborted sessions
python {baseDir}/scripts/model_usage.py --mode errors --error-limit 50

# Overview: cost + errors
python {baseDir}/scripts/model_usage.py --provider codex --mode overview --days 7 --error-limit 50

# JSON output
python {baseDir}/scripts/model_usage.py --mode overview --format json --pretty
```

## Modes

- `current`: current model cost summary
- `all`: all-model cost aggregation
- `errors`: recent failed/aborted sessions + log hints
- `overview`: combined cost and error report

## Notes

- `current/all/overview` require `codexbar`.
- `errors/overview` require `openclaw`.
- Logs are read from `journalctl` first (Linux/systemd); on macOS it falls back to `~/.openclaw/logs/gateway.log`.

## References

- `references/codexbar-cli.md`

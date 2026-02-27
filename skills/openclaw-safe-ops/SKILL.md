---
name: openclaw-safe-ops
description: Execute high-risk OpenClaw operations with backup, health checks, and rollback. Use when running gateway restart/start/stop/install/uninstall/run, config set/unset, plugins install/update/uninstall/enable/disable, or editing openclaw.json.
metadata: { "openclaw": { "emoji": "🛟", "skillKey": "openclaw-safe-ops" } }
---

# OpenClaw Safe Ops

Use this workflow whenever an operation can break OpenClaw runtime or channel connectivity.

## High-Risk Operations

- `openclaw gateway restart|start|stop|install|uninstall|run|status`
- `openclaw config set|unset`
- `openclaw plugins install|update|uninstall|enable|disable`
- Any change touching `~/.openclaw/openclaw.json`

## Preferred Execution Path

Run risky commands through the safety wrapper first:

```bash
./scripts/openclaw-safe.sh <openclaw args...>
```

Examples:

```bash
./scripts/openclaw-safe.sh gateway restart
./scripts/openclaw-safe.sh config set channels.dingtalk-connector.dmPolicy pairing
./scripts/openclaw-safe.sh plugins update dingtalk-connector
```

## Manual Fallback Workflow

If wrapper is unavailable, execute this sequence exactly:

1. Backup config:
   - `cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.manual.$(date +%Y%m%d-%H%M%S).bak`
2. Run one risky command only.
3. Validate immediately:
   - `openclaw channels status --probe`
   - `openclaw status --deep`
4. If validation fails:
   - `cp ~/.openclaw/openclaw.json.bak ~/.openclaw/openclaw.json`
   - `openclaw gateway restart`
   - `openclaw status --deep`

## Reporting Format

After each risky operation, report:

- Command executed
- Backup path used
- Health check result
- Rollback status (applied or not)

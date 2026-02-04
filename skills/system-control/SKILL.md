# Skill: System Control

Manage OpenClaw gateway service lifecycle (start, stop, restart) on this specific host.

## Environment Notes
- Root directory: `/Users/hexiaonan/workspace/openclaw`
- CLI runner: `pnpm openclaw`

## Commands

### Stop Gateway
Use this when the user wants to shut down the service.
```bash
cd /Users/hexiaonan/workspace/openclaw && pnpm openclaw gateway stop
```

### Restart Gateway
Use this to apply configuration changes or refresh the service.
```bash
cd /Users/hexiaonan/workspace/openclaw && pnpm openclaw gateway restart
```

### Status Check
Check if the gateway is currently running.
```bash
cd /Users/hexiaonan/workspace/openclaw && pnpm openclaw gateway status
```

## Troubleshooting
If `pnpm` commands report "Gateway service not loaded" but the process is clearly still alive, fall back to process termination:
```bash
ps aux | grep openclaw | grep -v grep | awk '{print $2}' | xargs kill -9
```

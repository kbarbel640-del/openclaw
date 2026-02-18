# OpenClaw Fork — Deployment Runbook

> ⚠️ This guide is for the fork deployment. The gateway runs from `~/zt_dev/openclaw-dev`, NOT the npm-installed version.
> **Do NOT use `openclaw gateway start` or `openclaw tui`** — those point to the upstream npm package.

---

## Quick Reference

| Item         | Path                                               |
| ------------ | -------------------------------------------------- |
| Fork repo    | `~/zt_dev/openclaw-dev`                            |
| Plist        | `~/Library/LaunchAgents/ai.openclaw.gateway.plist` |
| Logs         | `~/.openclaw/logs/gateway.log` + `gateway.err.log` |
| Detailed log | `/tmp/openclaw/openclaw-YYYY-MM-DD.log`            |

---

## Normal Restart

Use when gateway is running and you need to restart (e.g. after a code change):

```bash
launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway
```

Sends SIGTERM then restarts. Bear comes back automatically via boot hook.

> If you get **"Could not find service"**, the service isn't loaded. Bootstrap it first — see [Gateway Won't Start](#gateway-wont-start--crashed).

---

## Gateway Won't Start / Crashed

1. Check if running:

```bash
ps aux | grep openclaw-gateway | grep -v grep
```

2. Check error log:

```bash
tail -30 ~/.openclaw/logs/gateway.err.log
```

3. Start via launchctl:

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/ai.openclaw.gateway.plist
```

> 🚫 DO NOT use `openclaw gateway start` — it regenerates the plist and points it back to the upstream npm package, not the fork.

---

## Orphan Process / Restart Loop

If `gateway.err.log` shows repeated "Port 18789 is already in use" errors every ~10 seconds, the gateway is running but launchctl doesn't own it. Launchctl keeps spawning new instances that fail to bind the port.

**Fix — stop everything, kill the orphan, bootstrap clean:**

```bash
launchctl bootout gui/$(id -u)/ai.openclaw.gateway
# Find and kill the orphan
ps aux | grep openclaw-gateway | grep -v grep
kill <orphan_pid>
# Wait a moment, then bootstrap fresh
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/ai.openclaw.gateway.plist
```

Verify single process:

```bash
ps aux | grep openclaw-gateway | grep -v grep
```

---

## Session Lock Errors

If you see "session file locked" errors after a crash:

```bash
trash ~/.openclaw/agents/main/sessions/*.lock
```

These are small (~61 byte) sentinel files left behind when the gateway crashes mid-session. Safe to remove.

---

## Open the TUI (from fork)

```bash
pnpm --dir ~/zt_dev/openclaw-dev tui
```

Or:

```bash
node ~/zt_dev/openclaw-dev/scripts/run-node.mjs tui
```

> 🚫 Do NOT use `openclaw tui` — that runs the upstream npm-installed version, not the fork.

---

## After Rebuilding the Fork

1. Build (wait for it to finish completely):

```bash
cd ~/zt_dev/openclaw-dev && pnpm build
```

2. Then restart:

```bash
launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway
```

> ⏱️ ALWAYS wait for the build to finish BEFORE restarting. If the gateway starts during a build, it loads partial/stale files and nothing works.

---

## Rollback to Upstream

If the fork is broken and you need the stable npm version:

```bash
# Stop the fork
launchctl bootout gui/$(id -u)/ai.openclaw.gateway

# Start upstream (regenerates plist to npm package)
openclaw gateway start
```

---

## Verify Which Version is Running

```bash
grep filePath /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log | tail -1
```

- **Fork:** path contains `zt_dev/openclaw-dev/dist/`
- **Upstream:** path contains `pnpm/global/.../openclaw/dist/`

---

## Prerequisites

- **bash 5+** — required for the repo's git pre-commit hooks (`mapfile` builtin). macOS ships bash 3.2.
  ```bash
  brew install bash
  ```
  Verify: `bash --version` should show 5.x. Homebrew installs to `/opt/homebrew/bin/bash` which `env bash` picks up.

---

## Common Issues

- **"Config invalid / prePromptHook"** — Normal on fork. Doctor warns about fork-only config keys. Ignore or skip doctor.
- **"session file locked"** — Clear locks: `trash ~/.openclaw/agents/main/sessions/*.lock`
- **Bear not responding** — Wait 10–15s for Discord reconnect. Check `gateway.err.log` if longer.
- **Stale compile cache** — Clear: `trash $TMPDIR/node-compile-cache/`
- **`openclaw doctor --fix` removes prePromptHook** — Don't run `doctor --fix` on the fork. It strips fork-only config keys.
- **Pre-commit hook fails with "mapfile: command not found"** — Install bash 5+: `brew install bash`
- **"Port already in use" loop in error log** — See [Orphan Process / Restart Loop](#orphan-process--restart-loop).

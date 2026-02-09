# Claude Proxy Skill (Antigravity)

**Description:** Observe and operate the local `claude-proxy` service (antigravity-claude-proxy), which bridges Claude Code CLI with Antigravity's Claude models. Use when asked to check "claude proxy" status, logs, or manage accounts.

**Service URL:** http://localhost:8080 (Web Interface)

## Capability: Status & Health

Check if the service is running and responding.

```bash
# Check process
ps aux | grep "antigravity-claude-proxy" | grep -v grep

# Check health/UI (returns 200 OK and HTML if running)
curl -I http://localhost:8080/
```

## Capability: Control (Start/Stop)

Manage the proxy process.

```bash
# Start (background)
# Note: Usually run in a dedicated terminal or via process manager.
# If running via OpenClaw, use 'process' tool to keep it alive.
antigravity-claude-proxy start

# Stop
pkill -f "antigravity-claude-proxy"
```

## Capability: Account Management

Manage the Google accounts used for rotation.

```bash
# List accounts
antigravity-claude-proxy accounts list

# Add account (Interactive - requires browser flow)
antigravity-claude-proxy accounts add

# Remove account
antigravity-claude-proxy accounts remove

# Verify tokens
antigravity-claude-proxy accounts verify

# Clear all
antigravity-claude-proxy accounts clear
```

## Capability: Configuration

Configure Claude Code CLI to use this proxy.

**File:** `~/.claude/settings.json`

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:8080"
  }
}
```

## Capability: Logs

Logs are typically output to stdout of the running process.

- If running in a terminal, check that window.
- The Web UI also has a "Logs" tab at http://localhost:8080.

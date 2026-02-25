#!/usr/bin/env bash
set -euo pipefail

# Full-Control macOS Agent Setup
# Configures Moltbot for a fully autonomous macOS agent with maximum permissions.

cat <<'BANNER'
================================================================================
  WARNING: Full-Control Agent Mode

  This script configures Moltbot with MAXIMUM agent permissions:
  - Unrestricted shell command execution on the gateway host
  - No confirmation prompts for tool invocations
  - Elevated privileges enabled by default
  - Sandbox mode disabled

  Only run this on a machine you fully trust and control.
  Do NOT run this on shared or production infrastructure.
================================================================================
BANNER

printf '\n'
read -r -p "Continue with full-control agent setup? [y/N] " confirm
case "$confirm" in
  [yY]|[yY][eE][sS]) ;;
  *) echo "Aborted."; exit 1 ;;
esac

echo "Configuring agent tool profile..."
moltbot config set tools.profile full
moltbot config set tools.exec.host gateway
moltbot config set tools.exec.security full
moltbot config set tools.exec.ask off
moltbot config set tools.elevated.enabled true
moltbot config set tools.web.search.enabled true
moltbot config set tools.web.fetch.enabled true

echo "Configuring agent model defaults..."
moltbot config set agents.defaults.model.primary "anthropic/claude-opus-4-6"
moltbot config set agents.defaults.model.fallbacks '["anthropic/claude-sonnet-4-20250514"]'
moltbot config set agents.defaults.thinkingDefault medium
moltbot config set agents.defaults.elevatedDefault full
moltbot config set agents.defaults.subagents.maxConcurrent 3
moltbot config set agents.defaults.sandbox.mode off

echo "Writing exec-approvals.json..."
mkdir -p "$HOME/.clawdbot"
cat > "$HOME/.clawdbot/exec-approvals.json" <<'EOF'
{
  "security": "full",
  "ask": "off",
  "autoAllowSkills": true
}
EOF

echo ""
echo "Full-control agent setup complete."
echo "Restart the gateway to apply changes."

#!/usr/bin/env bash
# setup-server.sh — Headless gateway provisioning for container deployments.
#
# Runs non-interactive onboard, configures sandbox isolation, and disables
# the control UI for headless operation. Designed to run once at container
# startup before `node openclaw.mjs gateway`.
#
# NOTE: This script should run as the `node` user so config is written to
# /home/node/.openclaw/. Docker daemon startup (which requires root) is
# handled separately by start-dockerd.sh.
#
# Required env vars:
#   GEMINI_API_KEY          — Google AI provider key
#   OPENCLAW_GATEWAY_TOKEN  — Gateway auth token
#
# Optional env vars:
#   ALLOWED_ORIGINS         — JSON array of CORS origins (default: none)
#   OPENCLAW_MODEL          — Primary model override (default: google/gemini-3-pro-preview)

set -euo pipefail

# Onboard — provider, workspace, gateway basics.
# Sets: gateway.mode=local, auth profile, gateway.auth.token,
# agents.defaults.workspace, agents.defaults.model.primary
node openclaw.mjs onboard \
  --non-interactive \
  --accept-risk \
  --gemini-api-key "$GEMINI_API_KEY" \
  --gateway-auth token \
  --gateway-token "$OPENCLAW_GATEWAY_TOKEN" \
  --gateway-bind lan \
  --skip-channels \
  --skip-skills \
  --skip-health \
  --skip-daemon \
  --skip-ui

# Override model if OPENCLAW_MODEL env var is set.
if [ -n "${OPENCLAW_MODEL:-}" ]; then
  node openclaw.mjs models set "$OPENCLAW_MODEL"
fi

# Sandbox — isolate each session via Docker.
if command -v docker &>/dev/null && docker info &>/dev/null; then
  node openclaw.mjs config set agents.defaults.sandbox.mode all
  node openclaw.mjs config set agents.defaults.sandbox.scope session
  node openclaw.mjs config set agents.defaults.sandbox.workspaceAccess none
else
  echo "[setup] Docker not available, sandbox disabled."
  node openclaw.mjs config set agents.defaults.sandbox.mode off
fi

# HTTP API — enable OpenAI-compatible chat completions endpoint.
node openclaw.mjs config set gateway.http.endpoints.chatCompletions.enabled true

# Headless server — disable control UI and device auth.
node openclaw.mjs config set gateway.controlUi.enabled false
node openclaw.mjs config set gateway.controlUi.dangerouslyDisableDeviceAuth true
node openclaw.mjs config set gateway.auth.skipDevicePairing true

# CORS origins (if provided).
if [ -n "${ALLOWED_ORIGINS:-}" ]; then
  node openclaw.mjs config set gateway.controlUi.allowedOrigins "$ALLOWED_ORIGINS" --json
fi

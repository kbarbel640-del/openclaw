# OpenClaw Migration Guide

This document describes the migration from **Clawdbot** to **OpenClaw** (v2026.1.29).

## Overview

The project has been rebranded from "Clawdbot" to "OpenClaw". This guide documents the migration steps taken and current state.

## Migration Steps Completed

### 1. Repository Update
- **Old:** `github.com/clawdbot/clawdbot`
- **New:** `github.com/openclaw/openclaw`
- Updated git remote and pulled latest code (v2026.1.29)

### 2. Docker Image Rebuild
- Built new image: `openclaw:local`
- Previous image: `clawdbot:local` (removed)

### 3. Configuration Migration
- **Config directory:** `~/.clawdbot/` → `~/.openclaw/`
- **Config file:** `clawdbot.json` → `openclaw.json`
- **Environment variables:** `CLAWDBOT_*` → `OPENCLAW_*`
- Updated `.env` file with new variable names

### 4. Deprecated Config Removed
- Removed `browser.controlUrl` from config (no longer supported)
- Updated to new OpenClaw schema

### 5. Gateway Authentication Setup

The Control UI requires authentication via gateway token.

#### Token Configuration

The gateway token has been configured in `~/.openclaw/openclaw.json`:

```json
{
  "gateway": {
    "auth": {
      "mode": "token",
      "token": "9734f91122a3f49feba7ace0b673de4e60f41e9d6d9d64eedb89bbfe3eb88363"
    }
  }
}
```

#### Accessing the Control UI

**URL:** http://localhost:18789

**To authenticate:**
1. Navigate to the Overview page in the left sidebar
2. Enter the gateway token in the "Gateway Token" field:
   ```
   9734f91122a3f49feba7ace0b673de4e60f41e9d6d9d64eedb89bbfe3eb88363
   ```
3. Click "Connect"

The token is saved in browser local storage, so you only need to enter it once per browser.

**Alternative:** Generate a tokenized URL:
```bash
docker exec clawdbot-openclaw-gateway-1 node dist/index.js dashboard --no-open
```

### 6. Container Management

**Current containers:**
- `clawdbot-openclaw-gateway-1` - Main gateway service
- `clawdbot-openclaw-cli-1` - CLI container

**Commands:**
```bash
# Start containers
docker compose up -d

# Restart containers
docker compose restart

# View logs
docker logs -f clawdbot-openclaw-gateway-1

# Check status
docker exec clawdbot-openclaw-gateway-1 node dist/index.js status
```

## Current Status

- ✅ OpenClaw v2026.1.29 running
- ✅ WhatsApp channel connected and linked
- ✅ Gateway accessible on port 18789
- ✅ 3 active sessions preserved from migration
- ✅ Control UI accessible (requires token authentication)

## Files Modified

- `.env` - Updated environment variables
- `~/.openclaw/openclaw.json` - Migrated and updated config
- `docker-compose.yml` - Updated service names (auto-generated from repo)

## Verification

Run the following to verify the installation:

```bash
# Check version
docker exec clawdbot-openclaw-gateway-1 node dist/index.js --version

# Check health
docker exec clawdbot-openclaw-gateway-1 node dist/index.js health

# Check channel status
docker exec clawdbot-openclaw-gateway-1 node dist/index.js channels status
```

## Troubleshooting

### Gateway Token Missing Error
If you see "disconnected (1008): unauthorized: gateway token missing":
1. The token is configured in the gateway config
2. You need to enter it in the browser UI on the Overview page
3. This is expected security behavior - the browser needs to authenticate

### Container Won't Start
Check logs:
```bash
docker logs clawdbot-openclaw-gateway-1
```

### Config Issues
Run doctor to fix:
```bash
docker exec clawdbot-openclaw-gateway-1 node dist/index.js doctor --fix
```

## References

- Docs: https://docs.openclaw.ai
- Control UI Auth: https://docs.openclaw.ai/web/dashboard
- Gateway Troubleshooting: https://docs.openclaw.ai/gateway/troubleshooting

---
name: sonos-cloud
description: Control Sonos speakers remotely via the Sonos Cloud API (no local network needed). Play, pause, volume, favorites, grouping — works from any agent, anywhere.
metadata: { "openclaw": { "emoji": "🔊" } }
---

# Sonos Cloud Control

Control Sonos speakers through the Sonos Cloud API. No local network access required — works from any agent, sandboxed or not.

## Setup (one-time)

### 1. Store credentials

```bash
python3 /opt/openclaw/skills/sonos-cloud/scripts/token_manager.py setup <client_id> <client_secret> <redirect_uri>
```

### 2. Authorize a household

Start the OAuth callback server:

```bash
python3 /opt/openclaw/skills/sonos-cloud/scripts/oauth_callback.py --household <name>
```

Send the user the auth URL (printed by the server). They log into Sonos, authorize, and tokens are saved automatically.

Or manually:

```bash
# Get the auth URL
python3 /opt/openclaw/skills/sonos-cloud/scripts/token_manager.py auth-url

# After user authorizes, exchange the code
python3 /opt/openclaw/skills/sonos-cloud/scripts/token_manager.py exchange <code> <household_name>
```

### 3. Set up token refresh cron

Tokens expire every 24h. Set up a cron job to refresh them:

```
python3 /opt/openclaw/skills/sonos-cloud/scripts/token_manager.py refresh-all
```

## Usage

### Discovery & Status

```bash
# Full discovery (households, groups, players, favorites)
python3 /opt/openclaw/skills/sonos-cloud/scripts/sonos_api.py discover [household]

# Current status (what's playing, volume)
python3 /opt/openclaw/skills/sonos-cloud/scripts/sonos_api.py status [household]

# List households
python3 /opt/openclaw/skills/sonos-cloud/scripts/sonos_api.py households [household]
```

### Playback

```bash
python3 /opt/openclaw/skills/sonos-cloud/scripts/sonos_api.py play <group_id> [household]
python3 /opt/openclaw/skills/sonos-cloud/scripts/sonos_api.py pause <group_id> [household]
python3 /opt/openclaw/skills/sonos-cloud/scripts/sonos_api.py toggle <group_id> [household]
python3 /opt/openclaw/skills/sonos-cloud/scripts/sonos_api.py next <group_id> [household]
python3 /opt/openclaw/skills/sonos-cloud/scripts/sonos_api.py prev <group_id> [household]
```

### Volume

```bash
python3 /opt/openclaw/skills/sonos-cloud/scripts/sonos_api.py volume <group_id> [household]
python3 /opt/openclaw/skills/sonos-cloud/scripts/sonos_api.py set-volume <group_id> <0-100> [household]
python3 /opt/openclaw/skills/sonos-cloud/scripts/sonos_api.py mute <group_id> [household]
python3 /opt/openclaw/skills/sonos-cloud/scripts/sonos_api.py unmute <group_id> [household]
```

### Favorites

```bash
python3 /opt/openclaw/skills/sonos-cloud/scripts/sonos_api.py favorites <household_id> [household]
python3 /opt/openclaw/skills/sonos-cloud/scripts/sonos_api.py play-favorite <group_id> <fav_id> [household]
```

### Token Management

```bash
python3 /opt/openclaw/skills/sonos-cloud/scripts/token_manager.py list          # Show all households
python3 /opt/openclaw/skills/sonos-cloud/scripts/token_manager.py refresh-all   # Refresh expiring tokens
python3 /opt/openclaw/skills/sonos-cloud/scripts/token_manager.py get-token [household]  # Get valid token
```

## Multi-Household Support

Each authorized user gets a household name (e.g., "cole", "kellen"). Pass the household name as the last argument to any command:

```bash
python3 sonos_api.py status kellen
python3 sonos_api.py play <group_id> kellen
```

## Architecture

- **Credentials**: `/opt/openclaw/skills/sonos-cloud/config/credentials.json` — client_id, secret, redirect_uri
- **Tokens**: `/opt/openclaw/skills/sonos-cloud/config/tokens.json` — per-household access + refresh tokens
- **API base**: `api.ws.sonos.com/control/api/v1`
- **Auth**: OAuth 2.0 with 24h access tokens + long-lived refresh tokens

## Files

- `scripts/token_manager.py` — Token storage, refresh, OAuth URL generation
- `scripts/sonos_api.py` — Full Sonos Control API wrapper + CLI
- `scripts/oauth_callback.py` — Temporary OAuth callback web server
- `config/credentials.json` — Client credentials (created during setup)
- `config/tokens.json` — Per-household OAuth tokens (created during authorization)

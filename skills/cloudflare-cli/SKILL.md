---
name: cloudflare-cli
description: Manage Cloudflare DNS via CLI. Use when listing zones, creating/updating DNS records, toggling proxy status, or verifying propagation for Cloudflare-hosted domains.
---

# Cloudflare CLI

## Overview

Operate Cloudflare DNS safely using a CLI tool (preferred: `flarectl`). This skill focuses on read-then-write updates, preserving existing records, and quick verification for subdomains.

## When to Use

- Add/update DNS records for Cloudflare-managed domains.
- Toggle proxy status (orange/gray cloud) on existing records.
- Verify DNS propagation.

## Preferred Tooling

- **CLI:** `flarectl` (Cloudflare-supported CLI)
- **Not for DNS:** `cloudflared` is for tunnels, not DNS record management.

If `flarectl` isn’t installed, install via:

```bash
# Prefer yay/pacman
yay -S flarectl
# or
pacman -S flarectl
```

## Auth (Token-Based)

Use a scoped API token (DNS edit for specific zones).

Env vars expected by `flarectl`:

- `CF_API_TOKEN`
- `CF_ACCOUNT_ID` (needed for some commands)

Recommended storage:

- 1Password **Agents** vault item: `Cloudflare API`
- Local env file: `~/.config/cloudflare/env`

Example env file:

```bash
CF_API_TOKEN=...
CF_ACCOUNT_ID=...
```

## Quick Start

```bash
# List zones
flarectl zone list

# List DNS records for a zone
flarectl dns list --zone <zone-id>

# Create A record
flarectl dns create --zone <zone-id> --name zap.klabo.world --type A --content <public-ip> --ttl 300

# Update an existing record (use record ID)
flarectl dns update --zone <zone-id> --id <record-id> --name zap.klabo.world --type A --content <public-ip> --ttl 300

# Toggle proxying
flarectl dns update --zone <zone-id> --id <record-id> --proxied true
```

## Safe Update Workflow

1. **List records** for the zone.
2. **Create/Update** with the smallest change possible.
3. **Verify** locally:
   ```bash
   getent hosts zap.klabo.world
   ```

## Notes

- Always use scoped API tokens; avoid global keys.
- Keep TTL low (300) while iterating.
- For root + www, ensure you’re not accidentally removing required records.

## Local Tools

- CLI: `flarectl`
- Env config (optional): `~/.config/cloudflare/env`

---
name: cloudflare-wrangler
description: Reliable, non-interactive Cloudflare Workers deploy for SATMAX agents (op-backed auth; avoid wrangler login).
version: 1.0.0
date: 2026-02-10
---

# cloudflare-wrangler

Reliable, non-interactive Cloudflare Workers deploy for SATMAX agents.

**Date:** 2026-02-10

## Problem

Agents often hit Cloudflare `wrangler` errors like:

- `Unable to authenticate request [code: 10001]`

This happens when `wrangler` is not logged in (browser OAuth) or is using the wrong/expired credential.

## Rule

On ANY auth error (`401`/`403`/`10001`): **check 1Password first**. Do not debug code/infra until credentials are confirmed.

## Source Of Truth (1Password)

Vault: `Agents`

Workers deploy token:

- Item: `Cloudflare`
- Field: `API Token`
- Path: `op://Agents/Cloudflare/34ubyxcgl2imfr2ggwldp4etwi`

Account ID for maximumsats.com zone routes:

- `de053b53c1f2f0f2977bb71fd8a60bd5`

## Recommended Usage (Repo Wrapper)

Use the repo wrapper so the token never appears in command line args:

```bash
cd ~/OneDrive/satsmax
./scripts/wrangler.sh whoami
./scripts/wrangler.sh deploy --config path/to/wrangler.toml
```

The wrapper:

- reads the token via `op read ...`
- sets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
- uses local `wrangler` if installed, otherwise `npx wrangler@4`

## Troubleshooting

- If `op read ...` fails: your `OP_SERVICE_ACCOUNT_TOKEN` setup is broken on this machine.
- If deploy hits `10001`: token is missing/wrong, or the token lacks Workers permissions for the target account.
- If deploy hits route/DNS issues: verify you are deploying to the **personal** account that owns the `maximumsats.com` zone.

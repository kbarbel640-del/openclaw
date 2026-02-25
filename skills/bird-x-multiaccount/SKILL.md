---
name: bird-x-multiaccount
description: Use bird reliably with multiple X accounts (SATMAX @satsmax + Joel personal) via repo wrappers and 1Password-backed cookie auth.
version: 1.0.0
date: 2026-02-10
---

# bird (X/Twitter) Multi-Account

**Date:** 2026-02-10

## Rule

Never call `bird` directly in SATMAX automation.
Always use the repo wrapper so the correct account is used:

- SATMAX (product) account:
  - `~/OneDrive/satsmax/scripts/bird.sh --account satsmax -- <bird args...>`
- Joel personal:
  - `~/OneDrive/satsmax/scripts/bird.sh --account joel -- <bird args...>`

## Why

On agent hosts, Chromium cookies often belong to Joel's account, not `@satsmax`.
Posting from the wrong account is a severe ops error.

## 1Password Source Of Truth

Vault: `Agents`

Item: `X (Twitter) - MaximumSats`

Required cookie fields for `bird` non-interactive auth:

- `auth_token`
- `ct0`

## Setting Cookies

Use:

```bash
cd ~/OneDrive/satsmax
./scripts/bird-set-cookies.sh --auth-token '...' --ct0 '...'
```

Verify:

```bash
./scripts/bird.sh --account satsmax -- whoami
```

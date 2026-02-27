---
name: lightning
description: Operates the klabo.world Lightning node on honkbox using LND + LNbits. Use for Lightning commands, channel management, LNbits admin, and honkdash/klabo.world integration.
invocation: user
---

# Lightning (LND + LNbits) Skill

## Purpose

Operate the klabo.world Lightning node on honkbox using LND + LNbits with strong reliability and backups. Focus: operational commands, service management, and integration touchpoints (honkdash + klabo.world LNURLp proxy).

## Topology

- Host: **honkbox** (192.168.1.165)
- LND: Docker, host network
- LNbits: Docker + Postgres, host network
- Reverse proxy: Caddy (system service) on honkbox
- Bitcoin Core: systemd user service on honkbox, data on honkstorage NFS

## Key Paths

- LND data: `/home/klabo/lnd`
- LND config: `/home/klabo/lnd/lnd.conf`
- LND systemd: `/home/klabo/.config/systemd/user/lnd.service`
- LNbits stack: `/home/klabo/lnbits/` (`docker-compose.yml`, `.env`, data/)
- LNbits data: `/home/klabo/lnbits/data`
- LNbits Postgres: `/home/klabo/lnbits/postgres`
- Caddyfile: `/etc/caddy/Caddyfile`
- OneDrive backup dir: `/home/klabo/onedrive-sync/backups/lnd/`

## Services

- LND: `systemctl --user status lnd`
- LNbits: `systemctl --user status lnbits`
- Bitcoin: `systemctl --user status bitcoind`
- Caddy: `sudo systemctl status caddy`

## Common Commands

- LND info:
  - `ssh honkbox "docker exec lnd lncli --network=mainnet --lnddir=/data getinfo"`
- LND unlock:
  - `ssh honkbox "docker exec -it lnd lncli --network=mainnet --lnddir=/data unlock"`
- LNbits logs:
  - `ssh honkbox "docker logs -n 200 lnbits"`
- LNbits URL (reverse proxy): `https://lnbits.klabo.world`
- LN+ swaps (public list):
  - `lnplus swaps pending 20 any | jq -r '.[].web_url'`

## LNbits Auth (Caddy + App Login)

- **Basic auth (Caddy)** user: `lnbitsadmin`
  - Password stored in 1Password **Agents** vault item `LNbits` (fields: `username`, `password`).
- **LNbits app login** user: `joeladmin`
  - Password stored in the same 1Password item (fields: `app_username`, `app_password`).
- Duplicate `joel` accounts were removed; use `joeladmin` for app login.

### LNbits API Auth Notes

- `POST /api/v1/auth` → returns Bearer token.
- `GET /api/v1/wallets` requires `Authorization: Bearer <token>` (not `/api/v1/wallet`).
- To create invoices/payments, use `X-Api-Key: <adminkey>` from wallet list.
- When accessing via `https://lnbits.klabo.world`, **Basic auth** is required for all endpoints.

## Backup (OneDrive)

- Watcher: `/home/klabo/onedrive-sync/backups/scripts/watch-lnd-channel-backup.sh`
- Sync: `/home/klabo/onedrive-sync/backups/scripts/onedrive-backup-sync.sh`
- Systemd watcher: `systemctl --user status lnd-backup-watch`
- Copies `channel.backup` on each change (never use `channel.db`).

## LND Config

`/home/klabo/lnd/lnd.conf`:

- alias: `klabo.world`
- listens: `0.0.0.0:9735`, RPC/REST on localhost
- bitcoind rpc + zmq on 127.0.0.1

## LND Node Details (klabo.world)

- Alias: `klabo.world`
- Pubkey: `0276dc1ed542d0d777b518f1bd05f042847f19f312718cf1303288119a0a789a68`
- Color: `#f7931a`
- Network: `mainnet`
- Listen: `0.0.0.0:9735`
- RPC: `127.0.0.1:10009`
- REST: `127.0.0.1:8080`

## Honkdash Integration

- Server collector added: `get_lightning()` in `/home/pi/honkdash/server.py`
- UI section: `/home/pi/honkdash/static/index.html` + `/home/pi/honkdash/index.html`
- UI logic: `/home/pi/honkdash/static/js/app.js`
- Collects: status, peers, channels, balances, pending, fees, sync, version
- Status detail shows errors (e.g., macaroon missing, bitcoind timeout)

## Current Channel State (2026-02-05)

- Active channel: `LightningNetworkLiquidity` (capacity 200k, local ~196k, remote 0).
- Pending channel (opening): funding txid `cbd49f5204db9f94389701ab5c432bfebf7ce7d9410b15f447822d3720d14bd7`
  - Remote pubkey: `038ab01139ebfa57a03bf6e6dfd0bf4b7605e0a3c3df2cc31d79ef8ab13f5689e3`
  - Capacity 300k, push_amt 100k (gives inbound once confirmed).

Notes:

- LOOP node (`021c97…`) rejects non-zero push amounts.
- LightningNetworkLiquidity rejects keysend (INCORRECT_OR_UNKNOWN_PAYMENT_DETAILS).

## klabo.world Integration

- LNURLp proxy routes:
  - `app/src/app/.well-known/lnurlp/[username]/route.ts`
  - `app/src/app/api/lnurlp/[username]/invoice/route.ts`
- Helper: `app/src/lib/lnbits.ts`
- Env vars: `LNBITS_BASE_URL`, `LNBITS_BASIC_AUTH`, `NOSTRSTACK_BASE_URL`, `NOSTRSTACK_LN_ADDRESS`

## LN+ (Lightning Network Plus) API Access

LN+ uses a signed message for auth (no API key). Scripted access is set up at
`/home/klabo/bin/lnplus` and defaults to signing via LND on honkbox.

### Script

- File: `/home/klabo/bin/lnplus`
- Env override: `LNPLUS_LNCLI_CMD` (if running locally on honkbox)
- Requires: `jq`, `curl`, LND wallet unlocked

### Usage

- Get a message: `lnplus message`
- Sign + verify: `lnplus verify`
- List swaps (public): `lnplus swaps pending 20 any`
- Applicable swaps (auth): `lnplus applicable-swaps`
- My swaps (auth): `lnplus my-swaps`
- Notifications (auth): `lnplus notifications`

### Notes

- The swaps endpoint returns a JSON **array**, so use `jq '.[].id'`.
- LN+ API base: `https://lightningnetwork.plus/api/2`
- LN+ auth messages expire after ~5 minutes; re-run `lnplus message` if a call fails.

## Reliability Notes

- LND systemd ExecStartPre waits for `bitcoin-cli getblockchaininfo` (prevents bitcoind-start timeout loops).
- If LND flaps, check bitcoind readiness and RPC connectivity first.
- LND wallet must be unlocked after restarts.

## Security Notes

- LNbits behind Caddy basic auth + HTTPS.
- Disable `LNBITS_ALLOW_NEW_ACCOUNTS` after initial setup.
- Keep macaroons and TLS certs private.

## LNbits Backend (LND REST)

LNbits is wired to LND over REST with the admin macaroon + TLS cert:

```
LNBITS_BACKEND_WALLET_CLASS=LndRestWallet
LND_REST_ENDPOINT=https://127.0.0.1:8080
LND_REST_CERT=/lnd/tls.cert
LND_REST_MACAROON=/lnd/data/chain/bitcoin/mainnet/admin.macaroon
LNBITS_ALLOW_NEW_ACCOUNTS=false
```

Config lives in `/home/klabo/lnbits/.env` and is passed through
`/home/klabo/lnbits/docker-compose.yml`. The LND directory is mounted read-only at
`/lnd` in the LNbits container.

Quick verification:

```
ssh honkbox "docker logs -n 40 lnbits | rg -n 'Funding source|Backend'"
```

### End-to-End Check (Login + Invoice)

```
# Auth (local)
curl -s -H 'Content-Type: application/json' \
  -d '{"username":"joeladmin","password":"<app_password>"}' \
  http://127.0.0.1:5000/api/v1/auth

# Wallets (local)
curl -s -H "Authorization: Bearer <token>" \
  http://127.0.0.1:5000/api/v1/wallets

# Create invoice (local)
curl -s -H "X-Api-Key: <adminkey>" \
  -d '{"out":false,"amount":10,"memo":"Test tip"}' \
  http://127.0.0.1:5000/api/v1/payments
```

Note: With only outbound liquidity, invoices remain pending until inbound liquidity exists.

## References

- LND image: `lightninglabs/lnd:v0.19.0-beta`
- LNbits image: `lnbits/lnbits:v1.4.1`

## LNbits Admin User

- Username: `joeladmin`
- User ID: `e491c7ac26c84d80bce279e112f75c33`
- Created via: `docker exec lnbits sh -lc 'uv run lnbits-cli users new -u joeladmin -p <password>'`
- Hardening env:
  - `LNBITS_ALLOW_NEW_ACCOUNTS=false`
  - `LNBITS_ADMIN_USERS=e491c7ac26c84d80bce279e112f75c33`
  - `LNBITS_ALLOWED_USERS=e491c7ac26c84d80bce279e112f75c33`

## Superuser

- Retrieve via: `docker exec lnbits sh -lc 'uv run lnbits-cli superuser'`

## Notes

- LNbits requires DB URL `postgres://...` (not `postgresql://`).
- Admin password stored locally at `/home/klabo/Desktop/docs/lnbits-admin-password.txt` until moved to 1Password.

## Azure Deployment (klabo.world)

- Platform: Azure App Service (Linux, container)
- Resource group: `klabo-world-rg`
- Web app: `klabo-world-app`
- Set app settings via:
  - `az webapp config appsettings set -g klabo-world-rg -n klabo-world-app --settings ...`
- LNURLp + LNbits envs set in App Service:
  - `NOSTRSTACK_LN_ADDRESS=joel@klabo.world`
  - `NEXT_PUBLIC_NOSTRSTACK_LN_ADDRESS=joel@klabo.world`
  - `LNBITS_BASE_URL=https://lnbits.klabo.world`
  - `LNBITS_BASIC_AUTH=<basic auth user:pass>`

## Validation Targets

- LNURLp: `https://klabo.world/.well-known/lnurlp/joel`
- Invoice callback from LNURLp JSON

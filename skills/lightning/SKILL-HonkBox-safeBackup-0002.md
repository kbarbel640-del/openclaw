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

## klabo.world Integration

- LNURLp proxy routes:
  - `app/src/app/.well-known/lnurlp/[username]/route.ts`
  - `app/src/app/api/lnurlp/[username]/invoice/route.ts`
- Helper: `app/src/lib/lnbits.ts`
- Env vars: `LNBITS_BASE_URL`, `LNBITS_BASIC_AUTH`, `NOSTRSTACK_BASE_URL`, `NOSTRSTACK_LN_ADDRESS`

## Reliability Notes

- LND systemd ExecStartPre waits for `bitcoin-cli getblockchaininfo` (prevents bitcoind-start timeout loops).
- If LND flaps, check bitcoind readiness and RPC connectivity first.
- LND wallet must be unlocked after restarts.

## Security Notes

- LNbits behind Caddy basic auth + HTTPS.
- Disable `LNBITS_ALLOW_NEW_ACCOUNTS` after initial setup.
- Keep macaroons and TLS certs private.

## References

- LND image: `lightninglabs/lnd:v0.19.0-beta`
- LNbits image: `lnbits/lnbits:v1.4.1`

## LNbits Admin User

- Username: `joel`
- User ID: `dd4ed54611e645778b41aa27d7b3632e`
- Created via: `docker exec lnbits sh -lc 'uv run lnbits-cli users new -u joel -p <password>'`
- Hardening env:
  - `LNBITS_ALLOW_NEW_ACCOUNTS=false`
  - `LNBITS_ADMIN_USERS=<user_id>`
  - `LNBITS_ALLOWED_USERS=<user_id>`

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

---
name: lnbits
description: Operates LNbits v1.4.1 on honkbox via REST API. Covers all 168 endpoints across 18 categories including wallets, payments, LNURLp, NWC, node, admin, users, extensions, assets, audit, fiat, tinyurl, webpush, and websockets. Use when creating invoices, checking balances, managing pay links, configuring NWC, querying node, administering LNbits, or working with any LNbits API.
invocation: user
arguments: "[balance|pay|invoice|links|nwc|node|status|admin|users|extensions|assets]"
---

# LNbits API

Operate LNbits v1.4.1 on honkbox via REST API. 168 endpoints across 18 categories.

## Quick Reference

| Task                 | Command                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Wallet balance       | `curl -s -H 'X-Api-Key: <inkey>' http://127.0.0.1:5000/api/v1/wallet`                                                   |
| Create invoice       | `curl -s -H 'X-Api-Key: <adminkey>' -d '{"out":false,"amount":100,"memo":"tip"}' http://127.0.0.1:5000/api/v1/payments` |
| Pay bolt11           | `curl -s -H 'X-Api-Key: <adminkey>' -d '{"out":true,"bolt11":"lnbc..."}' http://127.0.0.1:5000/api/v1/payments`         |
| List payments        | `curl -s -H 'X-Api-Key: <inkey>' http://127.0.0.1:5000/api/v1/payments?limit=10`                                        |
| List pay links       | `curl -s -H 'X-Api-Key: <inkey>' http://127.0.0.1:5000/lnurlp/api/v1/links`                                             |
| List NWC connections | `curl -s -H 'X-Api-Key: <adminkey>' http://127.0.0.1:5000/nwcprovider/api/v1/nwc`                                       |
| Node info            | `curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:5000/node/api/v1/info`                                      |
| Health check         | `curl -s http://127.0.0.1:5000/api/v1/health`                                                                           |
| Decode invoice       | `curl -s -d '{"data":"lnbc..."}' http://127.0.0.1:5000/api/v1/payments/decode`                                          |
| BTC rate             | `curl -s http://127.0.0.1:5000/api/v1/rate/USD`                                                                         |

**All commands run via:** `ssh klabo@honkbox "<command>"`

## Contents

- [Authentication](#authentication)
- [Wallets](#wallets)
- [Payments](#payments)
- [LNURLp Pay Links](#lnurlp-pay-links)
- [NWC Service Provider](#nwc-service-provider)
- [Node Management](#node-management)
- [Admin Operations](#admin-operations)
- [User Management](#user-management)
- [Extension Management](#extension-management)
- [Assets](#assets)
- [Audit](#audit)
- [Fiat API](#fiat-api)
- [TinyURL](#tinyurl)
- [Utilities](#utilities)
- [Real-time & Notifications](#real-time--notifications)
- [Infrastructure](#infrastructure)
- [Troubleshooting](#troubleshooting)
- **Reference Files:**
  - [references/api-catalog.md](references/api-catalog.md) - Full 168-endpoint catalog with auth requirements
  - [references/schemas.md](references/schemas.md) - All request/response schemas
  - [references/extensions-available.md](references/extensions-available.md) - All 49 available extensions

## Authentication

### Credentials

| Wallet | ID                                 | Admin Key                          | Invoice Key                        |
| ------ | ---------------------------------- | ---------------------------------- | ---------------------------------- |
| Main   | `7571409bed0c436e87d57285120ddac4` | `807e7a698910439780ce659b5bac8b8c` | `194bf915f3c6471c909d0868aef29e17` |
| Max    | `538fdb485ff84f249273b004ef8e1c1c` | `4d4f301ce0bd45f9a70fefec089821e1` | `653f9ed8eceb44c5b317fe5456c9248a` |

- **1Password:** Agents vault, item `LNbits` (fields: `username`, `password`)
- **Admin user:** `joeladmin` (ID: `e491c7ac26c84d80bce279e112f75c33`)

### Four Auth Methods

| Method               | Header/Param                    | Scope  | Use For                                                                     |
| -------------------- | ------------------------------- | ------ | --------------------------------------------------------------------------- |
| **API Key (header)** | `X-Api-Key: <key>`              | Wallet | Payments, invoices, pay links, NWC connections, tinyurl, fiat subscriptions |
| **API Key (query)**  | `?api-key=<key>`                | Wallet | Same as header (alternative delivery)                                       |
| **Bearer Token**     | `Authorization: Bearer <token>` | User   | Node, admin, settings, users, extensions, wallets list, assets, audit       |
| **OAuth2 Password**  | POST `/api/v1/auth`             | User   | Login flow, returns Bearer token                                            |

### Key Permissions

| Operation                   | Admin Key | Invoice Key |
| --------------------------- | --------- | ----------- |
| Read wallet/payments        | Yes       | Yes         |
| Create receive invoice      | Yes       | Yes         |
| Pay outbound (bolt11/LNURL) | **Yes**   | **No**      |
| Delete/modify resources     | **Yes**   | **No**      |

**Rule:** Use `inkey` for reads. Use `adminkey` for spending or mutations.

### Get Bearer Token

```bash
ssh klabo@honkbox 'curl -s -H "Content-Type: application/json" \
  -d "{\"username\":\"joeladmin\",\"password\":\"$(op item get LNbits --vault Agents --fields label=password --reveal)\"}" \
  http://127.0.0.1:5000/api/v1/auth | python3 -c "import json,sys; print(json.load(sys.stdin)[\"access_token\"])"'
```

Full auth endpoints: 19 (see [api-catalog.md](references/api-catalog.md#auth))

## Wallets

```bash
# Get wallet balance
ssh klabo@honkbox "curl -s -H 'X-Api-Key: 194bf915f3c6471c909d0868aef29e17' \
  http://127.0.0.1:5000/api/v1/wallet"

# List all wallets (Bearer)
ssh klabo@honkbox "curl -s -H 'Authorization: Bearer $TOKEN' \
  http://127.0.0.1:5000/api/v1/wallets"

# Rename wallet
ssh klabo@honkbox "curl -s -X PUT -H 'X-Api-Key: 807e7a698910439780ce659b5bac8b8c' \
  http://127.0.0.1:5000/api/v1/wallet/NewName"

# Create wallet (Bearer)
ssh klabo@honkbox "curl -s -X POST -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' -d '{\"name\":\"Test Wallet\"}' \
  http://127.0.0.1:5000/api/v1/wallet"

# Share wallet
ssh klabo@honkbox "curl -s -X PUT -H 'X-Api-Key: 807e7a698910439780ce659b5bac8b8c' \
  -H 'Content-Type: application/json' -d '{\"user_id\":\"...\"}' \
  http://127.0.0.1:5000/api/v1/wallet/share"
```

Full wallet endpoints: 12 (see [api-catalog.md](references/api-catalog.md#wallet))

## Payments

```bash
# Create receive invoice (100 sats)
ssh klabo@honkbox "curl -s -H 'X-Api-Key: 807e7a698910439780ce659b5bac8b8c' \
  -H 'Content-Type: application/json' \
  -d '{\"out\":false,\"amount\":100,\"memo\":\"Test invoice\"}' \
  http://127.0.0.1:5000/api/v1/payments"

# Pay a bolt11 invoice
ssh klabo@honkbox "curl -s -H 'X-Api-Key: 807e7a698910439780ce659b5bac8b8c' \
  -H 'Content-Type: application/json' \
  -d '{\"out\":true,\"bolt11\":\"lnbc...\"}' \
  http://127.0.0.1:5000/api/v1/payments"

# Pay Lightning Address / LNURL
ssh klabo@honkbox "curl -s -H 'X-Api-Key: 807e7a698910439780ce659b5bac8b8c' \
  -H 'Content-Type: application/json' \
  -d '{\"lnurl\":\"user@domain.com\",\"amount\":100}' \
  http://127.0.0.1:5000/api/v1/payments/lnurl"

# Check payment status
ssh klabo@honkbox "curl -s -H 'X-Api-Key: 194bf915f3c6471c909d0868aef29e17' \
  http://127.0.0.1:5000/api/v1/payments/<payment_hash>"

# List recent payments (filterable)
ssh klabo@honkbox "curl -s -H 'X-Api-Key: 194bf915f3c6471c909d0868aef29e17' \
  'http://127.0.0.1:5000/api/v1/payments?limit=10&sortby=time&direction=desc'"

# Payment history (chart data)
ssh klabo@honkbox "curl -s -H 'X-Api-Key: 194bf915f3c6471c909d0868aef29e17' \
  http://127.0.0.1:5000/api/v1/payments/history"

# Decode bolt11 (no auth)
ssh klabo@honkbox "curl -s -d '{\"data\":\"lnbc...\"}' http://127.0.0.1:5000/api/v1/payments/decode"

# Cancel pending payment
ssh klabo@honkbox "curl -s -X POST -H 'X-Api-Key: 807e7a698910439780ce659b5bac8b8c' \
  -d '{\"payment_hash\":\"abc...\"}' \
  http://127.0.0.1:5000/api/v1/payments/cancel"

# Add labels to payment
ssh klabo@honkbox "curl -s -X PUT -H 'X-Api-Key: 807e7a698910439780ce659b5bac8b8c' \
  -H 'Content-Type: application/json' -d '[\"tip\",\"automated\"]' \
  http://127.0.0.1:5000/api/v1/payments/<hash>/labels"
```

**Filter params:** `limit`, `offset`, `sortby`, `direction`, `search`, `status`, `tag`, `amount`, `memo`, `time`, `payment_hash`, `wallet_id`, `labels`

**CreateInvoice body:** `out` (bool), `amount` (number), `memo` (string), `unit` ("sat"/"msat"/fiat), `expiry` (seconds), `bolt11` (when out=true), `webhook` (URL), `labels` (string[]), `extra` (object), `internal` (bool)

Full payment endpoints: 15 (see [api-catalog.md](references/api-catalog.md#payments))

## LNURLp Pay Links

```bash
# List all pay links
ssh klabo@honkbox "curl -s -H 'X-Api-Key: 194bf915f3c6471c909d0868aef29e17' \
  http://127.0.0.1:5000/lnurlp/api/v1/links"

# Create pay link with Lightning Address
ssh klabo@honkbox "curl -s -H 'X-Api-Key: 807e7a698910439780ce659b5bac8b8c' \
  -H 'Content-Type: application/json' \
  -d '{\"description\":\"Tips\",\"min\":1,\"max\":100000,\"comment_chars\":255,\"username\":\"joel\",\"wallet\":\"7571409bed0c436e87d57285120ddac4\"}' \
  http://127.0.0.1:5000/lnurlp/api/v1/links"

# Update / Delete pay link
ssh klabo@honkbox "curl -s -X PUT -H 'X-Api-Key: 807e7a698910439780ce659b5bac8b8c' \
  -H 'Content-Type: application/json' -d '{\"description\":\"Updated\",\"min\":1,\"max\":500000}' \
  http://127.0.0.1:5000/lnurlp/api/v1/links/<link_id>"

# Lightning Address resolution (public)
curl -s https://lnbits.klabo.world/lnurlp/api/v1/well-known/joel

# LNURLp settings (Bearer)
ssh klabo@honkbox "curl -s -H 'Authorization: Bearer $TOKEN' \
  http://127.0.0.1:5000/lnurlp/api/v1/settings"
```

**CreatePayLink body:** `description` (required), `wallet`, `min`, `max`, `comment_chars` (0-799), `username` (Lightning Address), `zaps` (bool), `currency`, `webhook_url/headers/body`, `success_text/url`

Full LNURLp endpoints: 15 (see [api-catalog.md](references/api-catalog.md#lnurlp-extension))

## NWC Service Provider

```bash
# List NWC connections
ssh klabo@honkbox "curl -s -H 'X-Api-Key: 807e7a698910439780ce659b5bac8b8c' \
  http://127.0.0.1:5000/nwcprovider/api/v1/nwc"

# Get/update NWC config (Bearer)
ssh klabo@honkbox "curl -s -H 'Authorization: Bearer $TOKEN' \
  http://127.0.0.1:5000/nwcprovider/api/v1/config"

ssh klabo@honkbox "curl -s -X POST -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{\"relay\":\"ws://127.0.0.1:7777\",\"relay_alias\":\"wss://nostr.klabo.world\"}' \
  http://127.0.0.1:5000/nwcprovider/api/v1/config"

# Register/update NWC connection with budget
ssh klabo@honkbox "curl -s -X PUT -H 'X-Api-Key: 807e7a698910439780ce659b5bac8b8c' \
  -H 'Content-Type: application/json' \
  -d '{\"permissions\":[\"pay_invoice\",\"get_balance\",\"make_invoice\"],\"description\":\"My App\",\"expires_at\":0,\"budgets\":[{\"budget_msats\":100000000,\"refresh_window\":86400}]}' \
  http://127.0.0.1:5000/nwcprovider/api/v1/nwc/<pubkey>"

# Delete NWC connection
ssh klabo@honkbox "curl -s -X DELETE -H 'X-Api-Key: 807e7a698910439780ce659b5bac8b8c' \
  http://127.0.0.1:5000/nwcprovider/api/v1/nwc/<pubkey>"

# Get available NWC permissions (public)
curl -s http://127.0.0.1:5000/nwcprovider/api/v1/permissions
```

**NWC relay:** `ws://127.0.0.1:7777` (local strfry), public: `wss://nostr.klabo.world`

Full NWC endpoints: 11 (see [api-catalog.md](references/api-catalog.md#nwc-service-provider))

## Node Management

All node endpoints require Bearer token (except public).

```bash
# Node info
ssh klabo@honkbox "curl -s -H 'Authorization: Bearer $TOKEN' \
  http://127.0.0.1:5000/node/api/v1/info"

# List/open/close channels, set fees
ssh klabo@honkbox "curl -s -H 'Authorization: Bearer $TOKEN' \
  http://127.0.0.1:5000/node/api/v1/channels"

ssh klabo@honkbox "curl -s -X PUT -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' -d '{\"fee_ppm\":100,\"fee_base_msat\":1000}' \
  http://127.0.0.1:5000/node/api/v1/channels/<channel_id>"

# Peers, rank
ssh klabo@honkbox "curl -s -H 'Authorization: Bearer $TOKEN' \
  http://127.0.0.1:5000/node/api/v1/peers"

# Public node info (no auth)
curl -s https://lnbits.klabo.world/node/public/api/v1/info
```

Full node endpoints: 15 (see [api-catalog.md](references/api-catalog.md#node-management))

## Admin Operations

All require Bearer token.

```bash
# Settings (get/update/patch/delete/defaults)
ssh klabo@honkbox "curl -s -H 'Authorization: Bearer $TOKEN' \
  http://127.0.0.1:5000/admin/api/v1/settings"

# Restart / Backup / Audit / Monitor / Test email
ssh klabo@honkbox "curl -s -H 'Authorization: Bearer $TOKEN' \
  http://127.0.0.1:5000/admin/api/v1/restart"

ssh klabo@honkbox "curl -s -H 'Authorization: Bearer $TOKEN' \
  http://127.0.0.1:5000/admin/api/v1/backup -o lnbits-backup.tar"
```

Full admin endpoints: 10 (see [api-catalog.md](references/api-catalog.md#admin))

## User Management

All require Bearer token.

```bash
# List/create users
ssh klabo@honkbox "curl -s -H 'Authorization: Bearer $TOKEN' \
  http://127.0.0.1:5000/users/api/v1/user"

# Get/update/delete user, toggle admin, reset password
ssh klabo@honkbox "curl -s -H 'Authorization: Bearer $TOKEN' \
  http://127.0.0.1:5000/users/api/v1/user/<user_id>"

# Manage user wallets, adjust balance
ssh klabo@honkbox "curl -s -X PUT -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' -d '{\"amount\":1000}' \
  http://127.0.0.1:5000/users/api/v1/balance"
```

Full user endpoints: 13 (see [api-catalog.md](references/api-catalog.md#user-management))

## Extension Management

All require Bearer token. **Currently enabled:** lnurlp, nwcprovider (2 of 49 available).

```bash
# List installed / List ALL available
ssh klabo@honkbox "curl -s -H 'Authorization: Bearer $TOKEN' \
  http://127.0.0.1:5000/api/v1/extension"
ssh klabo@honkbox "curl -s -H 'Authorization: Bearer $TOKEN' \
  http://127.0.0.1:5000/api/v1/extension/all"

# Install / Enable / Disable / Activate / Deactivate / Delete
ssh klabo@honkbox "curl -s -X PUT -H 'Authorization: Bearer $TOKEN' \
  http://127.0.0.1:5000/api/v1/extension/<ext_id>/enable"

# Extension builder (deploy/preview/zip)
ssh klabo@honkbox "curl -s -X POST -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' -d '{...}' \
  http://127.0.0.1:5000/api/v1/extension/builder/deploy"

# Releases, reviews, paid extensions
ssh klabo@honkbox "curl -s -H 'Authorization: Bearer $TOKEN' \
  http://127.0.0.1:5000/api/v1/extension/<ext_id>/releases"
```

Full extension endpoints: 22 (see [api-catalog.md](references/api-catalog.md#extension-management))

## Assets

File/image asset management. All require Bearer token.

```bash
# Upload / List / Get / Update / Delete / Binary / Thumbnail
ssh klabo@honkbox "curl -s -X POST -H 'Authorization: Bearer $TOKEN' \
  -F 'file=@image.png' http://127.0.0.1:5000/api/v1/assets"

ssh klabo@honkbox "curl -s -H 'Authorization: Bearer $TOKEN' \
  'http://127.0.0.1:5000/api/v1/assets/paginated?limit=10'"

ssh klabo@honkbox "curl -s -H 'Authorization: Bearer $TOKEN' \
  http://127.0.0.1:5000/api/v1/assets/<asset_id>/binary"
```

Full asset endpoints: 7 (see [api-catalog.md](references/api-catalog.md#assets))

## Audit

Detailed request audit log. Bearer required.

```bash
# Paginated entries (filter: ip_address, user_id, path, request_method, response_code, component)
ssh klabo@honkbox "curl -s -H 'Authorization: Bearer $TOKEN' \
  'http://127.0.0.1:5000/audit/api/v1?limit=50&request_method=POST'"

# Stats (counts by method, response code, component)
ssh klabo@honkbox "curl -s -H 'Authorization: Bearer $TOKEN' \
  http://127.0.0.1:5000/audit/api/v1/stats"
```

## Fiat API

Fiat payment provider integration.

```bash
# Test provider (Bearer) / Create subscription (API Key) / Cancel subscription (API Key)
ssh klabo@honkbox "curl -s -X PUT -H 'Authorization: Bearer $TOKEN' \
  http://127.0.0.1:5000/api/v1/fiat/check/<provider>"

ssh klabo@honkbox "curl -s -X POST -H 'X-Api-Key: 807e7a698910439780ce659b5bac8b8c' \
  -H 'Content-Type: application/json' \
  -d '{\"subscription_id\":\"...\",\"quantity\":1,\"payment_options\":{\"wallet_id\":\"...\",\"memo\":\"sub\"}}' \
  http://127.0.0.1:5000/api/v1/fiat/<provider>/subscription"
```

## TinyURL

URL shortening. API Key required (except redirect).

```bash
# Create (with ?endless=true for permanent)
ssh klabo@honkbox "curl -s -X POST -H 'X-Api-Key: 807e7a698910439780ce659b5bac8b8c' \
  'http://127.0.0.1:5000/api/v1/tinyurl?url=https://example.com&endless=true'"

# Get / Delete
ssh klabo@honkbox "curl -s -H 'X-Api-Key: 194bf915f3c6471c909d0868aef29e17' \
  http://127.0.0.1:5000/api/v1/tinyurl/<id>"

# Redirect (public)
curl -sL http://127.0.0.1:5000/t/<id>
```

## Utilities

Public endpoints, no auth required.

| Method | Path                           | Description              |
| ------ | ------------------------------ | ------------------------ |
| GET    | `/api/v1/health`               | Health check             |
| GET    | `/api/v1/status`               | Detailed status (Bearer) |
| GET    | `/api/v1/currencies`           | List fiat currencies     |
| GET    | `/api/v1/rate/{currency}`      | BTC exchange rate        |
| GET    | `/api/v1/rate/history`         | Rate history (Bearer)    |
| POST   | `/api/v1/conversion`           | Fiat to sats conversion  |
| GET    | `/api/v1/qrcode/{data}`        | Generate QR code PNG     |
| GET    | `/api/v1/qrcode`               | QR code (query param)    |
| POST   | `/api/v1/payments/decode`      | Decode bolt11 invoice    |
| GET    | `/api/v1/payments/fee-reserve` | Fee reserve info         |
| POST   | `/api/v1/account`              | Create account (legacy)  |
| POST   | `/api/v1/callback/{provider}`  | Generic webhook handler  |

## Real-time & Notifications

### WebSocket

Connect to `wss://lnbits.klabo.world/api/v1/ws/{item_id}` (no auth). Push data via REST:

```bash
# Push data to connected WS clients
curl -s -X POST http://127.0.0.1:5000/api/v1/ws/<item_id>?data=<payload>
curl -s http://127.0.0.1:5000/api/v1/ws/<item_id>/<data>

# Subscribe to web push (Bearer)
ssh klabo@honkbox "curl -s -X POST -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' -d '{\"subscription\":\"...\"}' \
  http://127.0.0.1:5000/api/v1/webpush"
```

**Note:** SSE was removed in v1.0.0. Use WebSocket or webhooks for real-time updates.

### Webhooks

Set `webhook` URL when creating invoices -- LNbits POSTs full Payment object on settlement:

```bash
ssh klabo@honkbox "curl -s -H 'X-Api-Key: 807e7a698910439780ce659b5bac8b8c' \
  -H 'Content-Type: application/json' \
  -d '{\"out\":false,\"amount\":100,\"memo\":\"tip\",\"webhook\":\"https://myserver.com/hook\"}' \
  http://127.0.0.1:5000/api/v1/payments"
```

### Internal Transfers

No dedicated endpoint. Create invoice on Wallet A, pay from Wallet B -- LNbits auto-detects same-instance and processes in-database (no Lightning fees). The `checking_id` starts with `"internal_"`.

### LNURL Scan

```bash
# Resolve LNURL or Lightning Address
ssh klabo@honkbox "curl -s -H 'X-Api-Key: 194bf915f3c6471c909d0868aef29e17' \
  http://127.0.0.1:5000/api/v1/lnurlscan/user@domain.com"

# LNURL-auth
ssh klabo@honkbox "curl -s -X POST -H 'X-Api-Key: 807e7a698910439780ce659b5bac8b8c' \
  -d '{\"callback\":\"https://...\"}' http://127.0.0.1:5000/api/v1/lnurlauth"
```

### Pagination

All paginated endpoints: max 1000 per page. Filter operators: `EQ`, `NE`, `GT`, `LT`, `GE`, `LE`, `IN`, `NOT_IN`, `LIKE`, `EVERY`, `ANY`.

## Infrastructure

| Component    | Location                                                               |
| ------------ | ---------------------------------------------------------------------- |
| LNbits       | `docker compose` at `/home/klabo/lnbits/docker-compose.yml`            |
| Postgres     | Port 5433, container `lnbits-postgres`                                 |
| Caddy        | `/etc/caddy/Caddyfile`, `sudo systemctl reload caddy`                  |
| strfry relay | Port 7777, container `strfry`, config `/home/klabo/strfry/strfry.conf` |
| LND          | Container `lnd`, REST at `127.0.0.1:8080`                              |
| Public URL   | `https://lnbits.klabo.world`                                           |
| OpenAPI spec | `http://127.0.0.1:5000/openapi.json` (168 endpoints, 240KB)            |
| Swagger UI   | `http://127.0.0.1:5000/docs`                                           |
| ReDoc        | `http://127.0.0.1:5000/redoc`                                          |

## Troubleshooting

| Error                       | Fix                                                                      |
| --------------------------- | ------------------------------------------------------------------------ |
| `Wallet not found`          | Wrong API key or wallet ID                                               |
| `Unauthorized`              | Using inkey for admin op; switch to adminkey                             |
| `401` on Bearer endpoints   | Token expired; re-login via `/api/v1/auth`                               |
| NWC relay connection failed | Check strfry: `docker logs strfry`                                       |
| Payment stuck pending       | `docker exec lnd lncli --network=mainnet --lnddir=/data pendingchannels` |
| Invoice unpayable           | No inbound liquidity; need channel with remote balance                   |
| Extension not showing       | `GET /api/v1/extension`, then `PUT /extension/{id}/enable`               |

## Verification

```bash
ssh klabo@honkbox 'curl -s -H "X-Api-Key: 194bf915f3c6471c909d0868aef29e17" \
  http://127.0.0.1:5000/api/v1/wallet | python3 -c "import json,sys; w=json.load(sys.stdin); print(f\"{w[\"name\"]}: {w[\"balance\"]}msat\")"'
ssh klabo@honkbox 'curl -s http://127.0.0.1:5000/api/v1/health'
```

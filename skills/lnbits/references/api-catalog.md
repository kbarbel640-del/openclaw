# LNbits v1.4.1 Full API Catalog

168 endpoints across 18 categories. Base URL: `http://127.0.0.1:5000`
Source: `/openapi.json` (Swagger UI: `/docs`, ReDoc: `/redoc`)

## Wallet (12 endpoints)

| Method | Path                                             | Auth    |
| ------ | ------------------------------------------------ | ------- |
| GET    | `/api/v1/wallet`                                 | API Key |
| POST   | `/api/v1/wallet`                                 | Bearer  |
| PATCH  | `/api/v1/wallet`                                 | API Key |
| GET    | `/api/v1/wallet/paginated`                       | Bearer  |
| PUT    | `/api/v1/wallet/{new_name}`                      | API Key |
| DELETE | `/api/v1/wallet/{wallet_id}`                     | Bearer  |
| PUT    | `/api/v1/wallet/reset/{wallet_id}`               | Bearer  |
| PUT    | `/api/v1/wallet/share`                           | API Key |
| PUT    | `/api/v1/wallet/share/invite`                    | API Key |
| DELETE | `/api/v1/wallet/share/invite/{share_request_id}` | Bearer  |
| DELETE | `/api/v1/wallet/share/{share_request_id}`        | API Key |
| PUT    | `/api/v1/wallet/stored_paylinks/{wallet_id}`     | API Key |

## Payments (15 endpoints)

| Method | Path                                              | Auth    |
| ------ | ------------------------------------------------- | ------- |
| GET    | `/api/v1/payments`                                | API Key |
| POST   | `/api/v1/payments`                                | API Key |
| GET    | `/api/v1/payments/{payment_hash}`                 | None    |
| GET    | `/api/v1/payments/paginated`                      | API Key |
| GET    | `/api/v1/payments/all/paginated`                  | Bearer  |
| GET    | `/api/v1/payments/history`                        | API Key |
| GET    | `/api/v1/payments/stats/count`                    | Bearer  |
| GET    | `/api/v1/payments/stats/daily`                    | Bearer  |
| GET    | `/api/v1/payments/stats/wallets`                  | Bearer  |
| POST   | `/api/v1/payments/decode`                         | None    |
| GET    | `/api/v1/payments/fee-reserve`                    | None    |
| POST   | `/api/v1/payments/cancel`                         | API Key |
| POST   | `/api/v1/payments/settle`                         | API Key |
| PUT    | `/api/v1/payments/{payment_hash}/labels`          | API Key |
| POST   | `/api/v1/payments/{payment_request}/pay-with-nfc` | None    |

**Filter params:** `limit`, `offset`, `sortby`, `direction`, `search`, `status`, `tag`, `amount`, `memo`, `time`, `payment_hash`, `wallet_id`, `labels`

## LNURL (4 endpoints)

| Method | Path                       | Auth    |
| ------ | -------------------------- | ------- |
| GET    | `/api/v1/lnurlscan/{code}` | API Key |
| POST   | `/api/v1/lnurlscan`        | API Key |
| POST   | `/api/v1/payments/lnurl`   | API Key |
| POST   | `/api/v1/lnurlauth`        | API Key |

## Auth (19 endpoints)

| Method | Path                            | Auth   |
| ------ | ------------------------------- | ------ |
| POST   | `/api/v1/auth`                  | None   |
| GET    | `/api/v1/auth`                  | Bearer |
| POST   | `/api/v1/auth/register`         | None   |
| POST   | `/api/v1/auth/logout`           | None   |
| POST   | `/api/v1/auth/usr`              | None   |
| POST   | `/api/v1/auth/nostr`            | None   |
| PUT    | `/api/v1/auth/password`         | Bearer |
| PUT    | `/api/v1/auth/pubkey`           | Bearer |
| PUT    | `/api/v1/auth/update`           | Bearer |
| PUT    | `/api/v1/auth/reset`            | None   |
| PUT    | `/api/v1/auth/first_install`    | None   |
| GET    | `/api/v1/auth/{provider}`       | None   |
| GET    | `/api/v1/auth/{provider}/token` | None   |
| GET    | `/api/v1/auth/acl`              | Bearer |
| PUT    | `/api/v1/auth/acl`              | Bearer |
| DELETE | `/api/v1/auth/acl`              | Bearer |
| PATCH  | `/api/v1/auth/acl`              | Bearer |
| POST   | `/api/v1/auth/acl/token`        | Bearer |
| DELETE | `/api/v1/auth/acl/token`        | Bearer |

## Core / Utilities (10 endpoints)

| Method | Path                      | Auth   | Description             |
| ------ | ------------------------- | ------ | ----------------------- |
| GET    | `/api/v1/health`          | None   | Health check            |
| GET    | `/api/v1/status`          | Bearer | Detailed status         |
| GET    | `/api/v1/currencies`      | None   | List fiat currencies    |
| GET    | `/api/v1/rate/{currency}` | None   | BTC exchange rate       |
| GET    | `/api/v1/rate/history`    | Bearer | Rate history            |
| POST   | `/api/v1/conversion`      | None   | Fiat to sats conversion |
| GET    | `/api/v1/qrcode/{data}`   | None   | Generate QR code PNG    |
| GET    | `/api/v1/qrcode`          | None   | QR code (query param)   |
| POST   | `/api/v1/account`         | None   | Create account (legacy) |
| GET    | `/api/v1/wallets`         | Bearer | List all user wallets   |

## Admin (10 endpoints)

| Method | Path                             | Auth   |
| ------ | -------------------------------- | ------ |
| GET    | `/admin/api/v1/settings`         | Bearer |
| PUT    | `/admin/api/v1/settings`         | Bearer |
| PATCH  | `/admin/api/v1/settings`         | Bearer |
| DELETE | `/admin/api/v1/settings`         | Bearer |
| GET    | `/admin/api/v1/settings/default` | Bearer |
| GET    | `/admin/api/v1/audit`            | Bearer |
| GET    | `/admin/api/v1/monitor`          | Bearer |
| GET    | `/admin/api/v1/backup`           | Bearer |
| GET    | `/admin/api/v1/restart`          | Bearer |
| GET    | `/admin/api/v1/testemail`        | Bearer |

## User Management (13 endpoints)

| Method | Path                                                    | Auth   |
| ------ | ------------------------------------------------------- | ------ |
| GET    | `/users/api/v1/user`                                    | Bearer |
| POST   | `/users/api/v1/user`                                    | Bearer |
| GET    | `/users/api/v1/user/{user_id}`                          | Bearer |
| PUT    | `/users/api/v1/user/{user_id}`                          | Bearer |
| DELETE | `/users/api/v1/user/{user_id}`                          | Bearer |
| GET    | `/users/api/v1/user/{user_id}/admin`                    | Bearer |
| PUT    | `/users/api/v1/user/{user_id}/reset_password`           | Bearer |
| GET    | `/users/api/v1/user/{user_id}/wallet`                   | Bearer |
| POST   | `/users/api/v1/user/{user_id}/wallet`                   | Bearer |
| DELETE | `/users/api/v1/user/{user_id}/wallet/{wallet}`          | Bearer |
| PUT    | `/users/api/v1/user/{user_id}/wallet/{wallet}/undelete` | Bearer |
| DELETE | `/users/api/v1/user/{user_id}/wallets`                  | Bearer |
| PUT    | `/users/api/v1/balance`                                 | Bearer |

## Extension Management (22 endpoints)

| Method | Path                                                | Auth   | Summary              |
| ------ | --------------------------------------------------- | ------ | -------------------- |
| GET    | `/api/v1/extension`                                 | Bearer | List installed       |
| POST   | `/api/v1/extension`                                 | Bearer | Install extension    |
| GET    | `/api/v1/extension/all`                             | Bearer | List all available   |
| DELETE | `/api/v1/extension/{ext_id}`                        | Bearer | Uninstall            |
| PUT    | `/api/v1/extension/{ext_id}/activate`               | Bearer | Activate             |
| PUT    | `/api/v1/extension/{ext_id}/deactivate`             | Bearer | Deactivate           |
| PUT    | `/api/v1/extension/{ext_id}/enable`                 | Bearer | Enable               |
| PUT    | `/api/v1/extension/{ext_id}/disable`                | Bearer | Disable              |
| GET    | `/api/v1/extension/{ext_id}/details`                | None   | Public details       |
| GET    | `/api/v1/extension/{ext_id}/releases`               | Bearer | List releases        |
| DELETE | `/api/v1/extension/{ext_id}/db`                     | Bearer | Drop extension DB    |
| PUT    | `/api/v1/extension/reviews`                         | Bearer | Create review        |
| GET    | `/api/v1/extension/reviews/tags`                    | Bearer | Get review tags      |
| GET    | `/api/v1/extension/reviews/{ext_id}`                | Bearer | Get reviews          |
| GET    | `/api/v1/extension/release/{org}/{repo}/{tag_name}` | Bearer | Get specific release |
| POST   | `/api/v1/extension/builder/deploy`                  | Bearer | Build & deploy       |
| POST   | `/api/v1/extension/builder/preview`                 | Bearer | Build & preview      |
| POST   | `/api/v1/extension/builder/zip`                     | Bearer | Build & download zip |
| DELETE | `/api/v1/extension/builder`                         | Bearer | Delete builder       |
| PUT    | `/api/v1/extension/{ext_id}/invoice/enable`         | Bearer | Pay to enable        |
| PUT    | `/api/v1/extension/{ext_id}/invoice/install`        | Bearer | Pay to install       |
| PUT    | `/api/v1/extension/{ext_id}/sell`                   | Bearer | Configure selling    |

## LNURLp Extension (15 endpoints)

| Method | Path                                   | Auth    |
| ------ | -------------------------------------- | ------- |
| GET    | `/lnurlp/`                             | Bearer  |
| GET    | `/lnurlp/api/v1/links`                 | API Key |
| POST   | `/lnurlp/api/v1/links`                 | API Key |
| GET    | `/lnurlp/api/v1/links/{link_id}`       | API Key |
| PUT    | `/lnurlp/api/v1/links/{link_id}`       | API Key |
| DELETE | `/lnurlp/api/v1/links/{link_id}`       | API Key |
| GET    | `/lnurlp/api/v1/lnurl/{link_id}`       | None    |
| GET    | `/lnurlp/api/v1/lnurl/cb/{link_id}`    | None    |
| GET    | `/lnurlp/api/v1/well-known/{username}` | None    |
| GET    | `/lnurlp/api/v1/settings`              | Bearer  |
| PUT    | `/lnurlp/api/v1/settings`              | Bearer  |
| DELETE | `/lnurlp/api/v1/settings`              | Bearer  |
| GET    | `/lnurlp/link/{link_id}`               | None    |
| GET    | `/lnurlp/print/{link_id}`              | None    |
| GET    | `/lnurlp/{link_id}`                    | None    |

## NWC Service Provider (11 endpoints)

| Method | Path                                   | Auth    |
| ------ | -------------------------------------- | ------- |
| GET    | `/nwcprovider/`                        | Bearer  |
| GET    | `/nwcprovider/admin`                   | Bearer  |
| GET    | `/nwcprovider/api/v1/config`           | Bearer  |
| POST   | `/nwcprovider/api/v1/config`           | Bearer  |
| GET    | `/nwcprovider/api/v1/config/{key}`     | Bearer  |
| GET    | `/nwcprovider/api/v1/nwc`              | API Key |
| GET    | `/nwcprovider/api/v1/nwc/{pubkey}`     | API Key |
| PUT    | `/nwcprovider/api/v1/nwc/{pubkey}`     | API Key |
| DELETE | `/nwcprovider/api/v1/nwc/{pubkey}`     | API Key |
| GET    | `/nwcprovider/api/v1/pairing/{secret}` | None    |
| GET    | `/nwcprovider/api/v1/permissions`      | None    |

## Node Management (15 endpoints)

| Method | Path                                 | Auth   |
| ------ | ------------------------------------ | ------ |
| GET    | `/node/api/v1/info`                  | Bearer |
| GET    | `/node/api/v1/ok`                    | Bearer |
| GET    | `/node/api/v1/channels`              | Bearer |
| GET    | `/node/api/v1/channels/{channel_id}` | Bearer |
| POST   | `/node/api/v1/channels`              | Bearer |
| DELETE | `/node/api/v1/channels`              | Bearer |
| PUT    | `/node/api/v1/channels/{channel_id}` | Bearer |
| GET    | `/node/api/v1/peers`                 | Bearer |
| POST   | `/node/api/v1/peers`                 | Bearer |
| DELETE | `/node/api/v1/peers/{peer_id}`       | Bearer |
| GET    | `/node/api/v1/invoices`              | Bearer |
| GET    | `/node/api/v1/payments`              | Bearer |
| GET    | `/node/api/v1/rank`                  | Bearer |
| GET    | `/node/public/api/v1/info`           | None   |
| GET    | `/node/public/api/v1/rank`           | None   |

## Assets (7 endpoints)

| Method | Path                                  | Auth   | Summary                 |
| ------ | ------------------------------------- | ------ | ----------------------- |
| POST   | `/api/v1/assets`                      | Bearer | Upload asset            |
| GET    | `/api/v1/assets/paginated`            | Bearer | List assets (paginated) |
| GET    | `/api/v1/assets/{asset_id}`           | Bearer | Get asset info          |
| PUT    | `/api/v1/assets/{asset_id}`           | Bearer | Update asset            |
| DELETE | `/api/v1/assets/{asset_id}`           | Bearer | Delete asset            |
| GET    | `/api/v1/assets/{asset_id}/binary`    | Bearer | Download binary         |
| GET    | `/api/v1/assets/{asset_id}/thumbnail` | Bearer | Get thumbnail           |

## Audit Extension (2 endpoints)

| Method | Path                  | Auth   | Summary                 |
| ------ | --------------------- | ------ | ----------------------- |
| GET    | `/audit/api/v1`       | Bearer | Paginated audit entries |
| GET    | `/audit/api/v1/stats` | Bearer | Audit statistics        |

**Audit filter params:** `ip_address`, `user_id`, `path`, `request_method`, `response_code`, `component` (all support filtering and search)

## Fiat API (4 endpoints)

| Method | Path                                                     | Auth    | Summary              |
| ------ | -------------------------------------------------------- | ------- | -------------------- |
| PUT    | `/api/v1/fiat/check/{provider}`                          | Bearer  | Test fiat provider   |
| POST   | `/api/v1/fiat/{provider}/connection_token`               | Bearer  | Get connection token |
| POST   | `/api/v1/fiat/{provider}/subscription`                   | API Key | Create subscription  |
| DELETE | `/api/v1/fiat/{provider}/subscription/{subscription_id}` | API Key | Cancel subscription  |

## TinyURL (4 endpoints)

| Method | Path                           | Auth    | Summary                               |
| ------ | ------------------------------ | ------- | ------------------------------------- |
| POST   | `/api/v1/tinyurl`              | API Key | Create tinyurl (params: url, endless) |
| GET    | `/api/v1/tinyurl/{tinyurl_id}` | API Key | Get tinyurl info                      |
| DELETE | `/api/v1/tinyurl/{tinyurl_id}` | API Key | Delete tinyurl                        |
| GET    | `/t/{tinyurl_id}`              | None    | Redirect (public)                     |

## WebPush (2 endpoints)

| Method | Path              | Auth   | Summary                         |
| ------ | ----------------- | ------ | ------------------------------- |
| POST   | `/api/v1/webpush` | Bearer | Subscribe to push notifications |
| DELETE | `/api/v1/webpush` | Bearer | Unsubscribe                     |

## WebSocket (2 endpoints)

| Method | Path                          | Auth | Summary                 |
| ------ | ----------------------------- | ---- | ----------------------- |
| POST   | `/api/v1/ws/{item_id}`        | None | Push data to WS clients |
| GET    | `/api/v1/ws/{item_id}/{data}` | None | Push data via GET       |

## Callback (1 endpoint)

| Method | Path                               | Auth | Summary                 |
| ------ | ---------------------------------- | ---- | ----------------------- |
| POST   | `/api/v1/callback/{provider_name}` | None | Generic webhook handler |

## Auth Summary by Category

| Category       | Auth Method                 | Endpoint Count |
| -------------- | --------------------------- | -------------- |
| Wallet         | API Key                     | 12             |
| Payments       | API Key                     | 15             |
| LNURL          | API Key                     | 4              |
| Auth           | Mixed (None/Bearer)         | 19             |
| Core/Utilities | Mixed (None/Bearer)         | 10             |
| Admin          | Bearer                      | 10             |
| Users          | Bearer                      | 13             |
| Extensions     | Bearer                      | 22             |
| LNURLp         | Mixed (API Key/Bearer/None) | 15             |
| NWC Provider   | Mixed (API Key/Bearer/None) | 11             |
| Node           | Mixed (Bearer/None)         | 15             |
| Assets         | Bearer                      | 7              |
| Audit          | Bearer                      | 2              |
| Fiat           | Mixed (Bearer/API Key)      | 4              |
| TinyURL        | Mixed (API Key/None)        | 4              |
| WebPush        | Bearer                      | 2              |
| WebSocket      | None                        | 2              |
| Callback       | None                        | 1              |
| **Total**      |                             | **168**        |

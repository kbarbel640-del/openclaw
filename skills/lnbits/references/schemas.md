# LNbits API Schemas

Key request/response schemas for all endpoint categories.

## CreateInvoice (POST /api/v1/payments)

```json
{
  "out": false, // false=receive, true=pay
  "amount": 100, // Amount in `unit`
  "unit": "sat", // "sat", "msat", or fiat code
  "memo": "Test tip", // Max 640 chars
  "bolt11": "lnbc...", // Required when out=true
  "expiry": 3600, // Invoice expiry (seconds)
  "internal": false, // Internal LNbits transfer
  "webhook": "https://...", // Payment notification URL
  "labels": ["tip"], // Categorization labels
  "extra": {} // Arbitrary metadata
}
```

## Payment (Response)

```json
{
  "checking_id": "...",
  "payment_hash": "abc123...",
  "wallet_id": "75714...",
  "amount": 100000, // millisats
  "fee": 0, // millisats
  "bolt11": "lnbc...",
  "payment_request": "lnbc...",
  "status": "success", // "pending" | "success" | "failed"
  "memo": "Test tip",
  "preimage": "...",
  "tag": "lnurlp",
  "labels": ["tip"],
  "time": 1770661108,
  "created_at": "2026-02-09T..."
}
```

## CreateLnurlPayment (POST /api/v1/payments/lnurl)

```json
{
  "lnurl": "user@domain.com", // LNURL or Lightning Address
  "amount": 100, // Sats
  "comment": "Great work!",
  "unit": "sat"
}
```

## Wallet (GET /api/v1/wallet)

```json
{
  "id": "75714...",
  "user": "e491c...",
  "wallet_type": "lightning",
  "adminkey": "807e7...",
  "inkey": "194bf...",
  "name": "Main",
  "balance_msat": 912000,
  "currency": "USD",
  "deleted": false,
  "created_at": "2026-02-05T...",
  "extra": {
    "icon": "flash_on",
    "color": "primary",
    "pinned": false
  }
}
```

## CreatePayLink (POST /lnurlp/api/v1/links)

```json
{
  "description": "Tips for Joel", // Required
  "wallet": "75714...", // Wallet ID
  "min": 1, // Min sats
  "max": 100000, // Max sats
  "comment_chars": 255, // 0-799
  "username": "joel", // Lightning Address
  "zaps": true, // Nostr zap support
  "currency": null, // null=sats, or fiat code
  "webhook_url": "https://...",
  "success_text": "Thanks!",
  "success_url": "https://..."
}
```

## PayLink (Response)

```json
{
  "id": 1,
  "wallet": "75714...",
  "description": "Tips for Joel",
  "min": 1,
  "max": 100000,
  "comment_chars": 255,
  "username": "joel",
  "zaps": true,
  "served_meta": 42,
  "served_pr": 10,
  "created_at": "2026-02-05T...",
  "updated_at": "2026-02-09T..."
}
```

## NWCKey (GET /nwcprovider/api/v1/nwc)

```json
{
  "pubkey": "4e20fb...",
  "wallet": "75714...",
  "description": "Alby NWC",
  "expires_at": 0, // 0 = never
  "permissions": "pay invoice lookup history balance info",
  "created_at": 1770661108,
  "last_used": 1770661108
}
```

## NWCRegistrationRequest (PUT /nwcprovider/api/v1/nwc/{pubkey})

```json
{
  "permissions": ["pay_invoice", "get_balance", "make_invoice", "get_info"],
  "description": "My App",
  "expires_at": 0,
  "budgets": [
    {
      "budget_msats": 100000000,
      "refresh_window": 86400
    }
  ]
}
```

## NWCBudget (Response)

```json
{
  "id": 1,
  "pubkey": "4e20fb...",
  "budget_msats": 100000000,
  "refresh_window": 86400,
  "created_at": 1770661108,
  "used_budget_msats": 50000000
}
```

## NodeInfoResponse (GET /node/api/v1/info)

```json
{
  "id": "0276dc...",
  "backend_name": "LndRestWallet",
  "alias": "klabo.world",
  "color": "#f7931a",
  "num_peers": 3,
  "blockheight": 880000,
  "balance_msat": 912000,
  "onchain_balance_sat": 0,
  "channel_stats": {
    "counts": { "active": 2, "pending": 0, "closed": 0 },
    "avg_size": 250000,
    "total_capacity": 500000
  }
}
```

## NodeChannel (GET /node/api/v1/channels)

```json
{
  "peer_id": "038ab0...",
  "id": "880000x1x0",
  "short_id": "880000x1x0",
  "state": "active",
  "balance": {
    "local_msat": 196000000,
    "remote_msat": 4000000,
    "total_msat": 200000000
  },
  "fee_ppm": 100,
  "fee_base_msat": 1000,
  "name": "LightningNetworkLiquidity",
  "color": "#3399ff"
}
```

## OpenChannel (POST /node/api/v1/channels)

```json
{
  "peer_id": "038ab0...", // Required
  "funding_amount": 200000, // Required (sats)
  "push_amount": 0, // Optional (sats)
  "fee_rate": 10 // Optional (sat/vbyte)
}
```

## SetChannelFees (PUT /node/api/v1/channels/{channel_id})

```json
{
  "fee_ppm": 100,
  "fee_base_msat": 1000
}
```

## AssetInfo (POST/GET /api/v1/assets)

```json
{
  "id": "abc123...",
  "mime_type": "image/png",
  "name": "logo.png",
  "is_public": false,
  "size_bytes": 45000,
  "thumbnail_base64": "data:image/...",
  "created_at": "2026-02-09T..."
}
```

## AssetUpdate (PUT /api/v1/assets/{asset_id})

```json
{
  "name": "new-logo.png",
  "is_public": true
}
```

## AuditStats (GET /audit/api/v1/stats)

```json
{
  "request_method": [{ "field": "POST", "total": 42 }],
  "response_code": [{ "field": "200", "total": 100 }],
  "component": [{ "field": "payments", "total": 50 }],
  "long_duration": [{ "field": "/api/v1/payments", "total": 5 }]
}
```

## CreateFiatSubscription (POST /api/v1/fiat/{provider}/subscription)

```json
{
  "subscription_id": "sub_123",
  "quantity": 1,
  "payment_options": {
    "memo": "Monthly subscription",
    "wallet_id": "75714...",
    "subscription_request_id": "req_123",
    "tag": "subscription",
    "extra": {},
    "success_url": "https://..."
  }
}
```

## FiatSubscriptionResponse

```json
{
  "ok": true,
  "subscription_request_id": "req_123",
  "checkout_session_url": "https://...",
  "error_message": null
}
```

## WebPushSubscription (POST /api/v1/webpush)

```json
{
  "endpoint": "https://fcm.googleapis.com/...",
  "user": "e491c...",
  "data": "...",
  "host": "lnbits.klabo.world",
  "timestamp": "2026-02-09T..."
}
```

## Webhook Payload (POST to your endpoint)

When a payment is received for an invoice with a `webhook` URL set:

```json
{
  "payment_hash": "abc123...",
  "payment_request": "lnbc...",
  "amount": 100000, // millisats
  "fee": 100, // millisats
  "memo": "Payment",
  "time": 1770661108,
  "pending": false,
  "wallet_id": "75714..."
}
```

## Common Pagination Params

All paginated endpoints accept:

| Param       | Type   | Description      |
| ----------- | ------ | ---------------- |
| `limit`     | int    | Items per page   |
| `offset`    | int    | Skip N items     |
| `sortby`    | string | Field to sort by |
| `direction` | string | "asc" or "desc"  |
| `search`    | string | Text search      |

## Error Responses

```json
{
  "detail": "Wallet not found." // 404
}
```

```json
{
  "detail": "Bad request." // 400
}
```

```json
{
  "detail": [
    // 422 Validation
    {
      "loc": ["body", "amount"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

# OpenClaw Zulip Extension

This extension lets OpenClaw send/receive messages via the Zulip API.

## Configuration

### Single base URL (legacy)

Backwards-compatible options:

- `channels.zulip.realm` (preferred)
- `channels.zulip.site` (alias)
- env: `ZULIP_REALM` / `ZULIP_SITE`

### Multiple base URLs (LAN primary + fallback)

Use `apiBaseUrls` to provide multiple API endpoints. The plugin will:

- try the first URL first
- fail over to the next URL on **network errors**, **HTTP 5xx**, or **HTML proxy/auth pages** (Cloudflare, reverse-proxy error pages, etc.)
- remember the last-good URL for ~10 minutes (TTL) and start with it on subsequent requests

You can set this at the top-level Zulip config and/or per-account:

```yaml
channels:
  zulip:
    enabled: true

    # Auth
    email: bot@zulip.example.com
    apiKey: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

    # Prefer LAN, fall back to tunnel
    apiBaseUrls:
      - http://192.168.1.10:9991
      - https://zulip.example.com
```

Per-account example:

```yaml
channels:
  zulip:
    accounts:
      work:
        email: bot@zulip.example.com
        apiKey: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        apiBaseUrls:
          - http://192.168.1.10:9991
          - https://zulip.example.com
```

### Environment variables

For the default account (`default`), the extension also supports:

- `ZULIP_API_BASE_URLS` (comma-separated list)
- `ZULIP_REALM` / `ZULIP_SITE`
- `ZULIP_EMAIL`
- `ZULIP_API_KEY`

Example:

```bash
export ZULIP_API_BASE_URLS='http://192.168.1.10:9991,https://zulip.example.com'
export ZULIP_EMAIL='bot@zulip.example.com'
export ZULIP_API_KEY='xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
```

## Notes on long-polling and event queues

Zulip inbound messages use long-polling (`/api/v1/events`). The extension will **not** re-register a new event queue on generic 5xx/proxy errors; it retries the existing queue.

It only re-registers when Zulip returns `BAD_EVENT_QUEUE_ID` (queue expired/invalid).

## Cloudflare Access (optional)

If your Zulip is protected by Cloudflare Access, you can provide a Service Token via:

- `ZULIP_CF_ACCESS_CLIENT_ID`
- `ZULIP_CF_ACCESS_CLIENT_SECRET`

The extension will include these headers on API calls.

---
summary: "CLI reference for `openclaw devices` (device pairing + token rotation/revocation)"
read_when:
  - You are approving device pairing requests
  - You need to rotate or revoke device tokens
title: "devices"
---

# `openclaw devices`

Manage device pairing requests and device-scoped tokens.

## Commands

### `openclaw devices list`

List pending pairing requests and paired devices.

```
openclaw devices list
openclaw devices list --json
```

### `openclaw devices approve [requestId] [--latest]`

Approve a pending device pairing request. If `requestId` is omitted, OpenClaw
automatically approves the most recent pending request.

```
openclaw devices approve
openclaw devices approve <requestId>
openclaw devices approve --latest
```

### `openclaw devices reject <requestId>`

Reject a pending device pairing request.

```
openclaw devices reject <requestId>
```

### `openclaw devices rotate --device <id> --role <role> [--scope <scope...>]`

Rotate a device token for a specific role (optionally updating scopes).

```
openclaw devices rotate --device <deviceId> --role operator --scope operator.read --scope operator.write
```

### `openclaw devices revoke --device <id> --role <role>`

Revoke a device token for a specific role.

```
openclaw devices revoke --device <deviceId> --role node
```

## Common options

- `--url <url>`: Gateway WebSocket URL (defaults to `gateway.remote.url` when configured).
- `--token <token>`: Device token used by device auth flows.
- `--password <password>`: Gateway password (password auth).
- `--timeout <ms>`: RPC timeout.
- `--json`: JSON output (recommended for scripting).

Notes:

- For local gateway operations, run `openclaw devices ...` without `--token` unless you explicitly need device auth.
- Passing a gateway service token to `--token` can cause auth failures such as `device_token_mismatch`.
- When you set `--url`, the CLI does not fall back to config or environment credentials. Pass explicit credentials for that remote target.

## Notes

- Token rotation returns a new token (sensitive). Treat it like a secret.
- These commands require `operator.pairing` (or `operator.admin`) scope.

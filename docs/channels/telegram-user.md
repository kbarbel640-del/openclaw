---
summary: "Connect a Telegram user account via MTProto (DMs + groups)"
---
# Telegram User

Telegram User connects OpenClaw to a **personal Telegram account** using MTProto.
Use this when you need user-level DMs or want to message from your own account in groups.

## Requirements

- Telegram API ID + API hash from [my.telegram.org](https://my.telegram.org).
- The `telegram-user` plugin installed.

## Install the plugin

If the plugin is not bundled, install it:

```bash
openclaw plugins install @openclaw/telegram-user
```

## Configure

You can store credentials in config or use env vars.

Option A: env vars (default account only)
```bash
export TELEGRAM_USER_API_ID="123456"
export TELEGRAM_USER_API_HASH="your_api_hash"
openclaw channels add --channel telegram-user --use-env
```

Option B: config
```bash
openclaw channels add --channel telegram-user --api-id 123456 --api-hash your_api_hash
```

## Login (QR or phone code)

QR login (default):
```bash
openclaw channels login --channel telegram-user
```

Phone login:
```bash
export TELEGRAM_USER_PHONE="+15551234567"
openclaw channels login --channel telegram-user
```

Optional env helpers:
- `TELEGRAM_USER_CODE` (one-time code)
- `TELEGRAM_USER_PASSWORD` (2FA password)

## Security (DM policy)

By default, DMs are protected with pairing. Approve requests with:

```bash
openclaw pairing approve telegram-user <code>
```

See [Pairing](/start/pairing) for details.

## Limitations

- Broadcast channels are not supported.
- Calls are not supported.

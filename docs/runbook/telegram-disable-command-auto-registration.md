---
title: "Disable Telegram Command Auto Registration"
summary: "Stop Telegram setMyCommands attempts that can fail with BOT_COMMAND_INVALID."
---

If Telegram startup logs show `setMyCommands failed` or `BOT_COMMAND_INVALID`, disable native command menu registration in `~/.openclaw/openclaw.json`.

Use boolean `false` values (the config convention is `true`/`false` or `"auto"`):

```json5
{
  commands: {
    native: false,
    nativeSkills: false,
  },
}
```

This does **not** disable Telegram messaging. It only stops OpenClaw from attempting Telegram `setMyCommands` registration.

Verification:

```bash
docker compose --env-file .env.local restart openclaw-gateway
docker compose --env-file .env.local logs --since=5m openclaw-gateway | grep -i telegram
```

Expected result: logs no longer include `setMyCommands failed` or `BOT_COMMAND_INVALID`.

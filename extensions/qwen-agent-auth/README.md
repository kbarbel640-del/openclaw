# Qwen Agent OAuth (OpenClaw plugin)

OAuth provider plugin for **Qwen Agent**.

## Enable

Bundled plugins are disabled by default. Enable this one:

```bash
openclaw plugins enable qwen-agent-auth
```

Restart the Gateway after enabling.

## Authenticate

```bash
openclaw models auth login --provider qwen-agent --set-default
```

## Notes

- Qwen Agent OAuth uses a device-code login flow.
- Tokens auto-refresh; re-run login if refresh fails or access is revoked.

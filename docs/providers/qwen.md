---
summary: "Use Qwen OAuth providers in OpenClaw"
read_when:
  - You want to use Qwen with OpenClaw
  - You want OAuth access to Qwen Coder
title: "Qwen"
---

# Qwen

OpenClaw supports two Qwen OAuth provider plugins:

- `qwen-agent-auth` (provider id: `qwen-agent`)
- `qwen-portal-auth` (provider id: `qwen-portal`, legacy path)

## Enable the plugin

```bash
openclaw plugins enable qwen-agent-auth
# optional legacy provider:
# openclaw plugins enable qwen-portal-auth
```

Restart the Gateway after enabling.

## Authenticate

```bash
openclaw models auth login --provider qwen-agent --set-default
# legacy provider:
# openclaw models auth login --provider qwen-portal --set-default
```

This runs the Qwen device-code OAuth flow and writes a provider entry to your
`models.json` (plus a `qwen` alias for quick switching).

## Model IDs

- `qwen-agent/coder-model`
- `qwen-agent/vision-model`
- `qwen-portal/coder-model` (legacy)
- `qwen-portal/vision-model` (legacy)

Switch models with:

```bash
openclaw models set qwen-agent/coder-model
```

## Reuse Qwen Code CLI login

If you already logged in with the Qwen Code CLI, OpenClaw will sync credentials
from `~/.qwen/oauth_creds.json` when it loads the auth store. You still need a
provider entry (`models.providers.qwen-agent` or `models.providers.qwen-portal`)
created by the login command.

## Notes

- Tokens auto-refresh; re-run the login command if refresh fails or access is revoked.
- Default base URL: `https://portal.qwen.ai/v1` (override with
  `models.providers.qwen-agent.baseUrl` or `models.providers.qwen-portal.baseUrl`).
- See [Model providers](/concepts/model-providers) for provider-wide rules.

---
summary: "How OpenClaw imports secrets from Doppler"
read_when:
  - Configuring Doppler as a secrets manager for OpenClaw
  - Troubleshooting missing secrets when using Doppler
  - Understanding the env/secrets loading order
title: "Doppler Integration"
---

# Doppler integration

OpenClaw can automatically import secrets from [Doppler](https://doppler.com) so you don't need to wrap the gateway process with `doppler run --`.

## Quick start

1. Install the [Doppler CLI](https://docs.doppler.com/docs/install-cli).
2. Set `DOPPLER_TOKEN` in your environment (a service token or personal token).
3. Start the gateway — secrets are loaded automatically.

No config changes required. OpenClaw auto-detects `DOPPLER_TOKEN` and fetches secrets before config parsing.

## How it works

During startup, OpenClaw checks for `DOPPLER_TOKEN` in the environment. When present it runs:

```
doppler secrets download --json --no-file [--project X] [--config Y]
```

The returned key/value pairs are applied to `process.env` using the same **no-override** rule as `env.vars`: if a key already has a non-empty value in the environment, the Doppler value is skipped.

Doppler internal keys (`DOPPLER_PROJECT`, `DOPPLER_CONFIG`, `DOPPLER_ENVIRONMENT`) are never applied.

## Config options

Add an `env.doppler` block to `openclaw.json` for fine-grained control:

```json5
{
  "env": {
    "doppler": {
      "enabled": true,       // force enable without DOPPLER_TOKEN (or false to disable)
      "required": true,      // hard-fail: gateway refuses to start if Doppler fails
      "project": "my-app",   // --project flag
      "config": "prod",      // --config flag
      "timeoutMs": 15000     // CLI timeout (default: 10000)
    }
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `boolean` | auto | `true` forces Doppler on; `false` disables it even when `DOPPLER_TOKEN` is set |
| `required` | `boolean` | `false` | When `true`, the gateway throws and refuses to start if Doppler secrets cannot be loaded (missing token, CLI not installed, fetch failure) |
| `project` | `string` | — | Doppler project to target (passed as `--project`) |
| `config` | `string` | — | Doppler config/environment to target (passed as `--config`) |
| `timeoutMs` | `number` | `10000` | Timeout for the Doppler CLI call in milliseconds |

The timeout can also be set via `OPENCLAW_DOPPLER_TIMEOUT_MS` env var.

## Precedence order

Secrets are loaded in this order (earlier sources win):

1. **Process environment** — explicitly set env vars
2. **`.env` files** — loaded by dotenv
3. **Doppler** — fetched from Doppler CLI
4. **`env.vars`** — inline vars in `openclaw.json`
5. **Shell env fallback** — login shell environment (if enabled)

Because Doppler runs before config parsing, `${VAR}` references in `openclaw.json` can resolve against Doppler-provided secrets.

## Troubleshooting

**Secrets not loading?**
- Verify `DOPPLER_TOKEN` is set: `echo $DOPPLER_TOKEN`
- Verify the CLI works: `doppler secrets download --json --no-file`
- Check that the target project/config are correct

**Doppler CLI not found?**
- Install it: `brew install dopplerhq/cli/doppler` (macOS) or see [Doppler docs](https://docs.doppler.com/docs/install-cli)
- OpenClaw logs a warning when `env.doppler.enabled` is `true` but the CLI is missing

**Secrets not overriding?**
- By design, Doppler never overrides existing env values. Unset the conflicting key to let Doppler provide it.

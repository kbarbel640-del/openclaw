# @openclaw/opik

Export OpenClaw agent traces to [Opik](https://www.comet.com/docs/opik/) for
LLM observability — see prompts, completions, tool calls, token usage, and
costs in the Opik UI.

The Opik plugin runs **inside the Gateway process**. If you use a remote
Gateway, install and configure the plugin on that machine, then restart the
Gateway to load it.

## Setup

### Interactive wizard (recommended)

```bash
openclaw opik configure
```

The wizard validates your URL and API key, auto-detects local instances, and
writes the config for you. Restart the Gateway afterwards.

### CLI config commands

```bash
openclaw config set opik.enabled true
openclaw config set opik.apiKey "your-api-key"
openclaw config set opik.projectName "my-openclaw"
```

### Manual config

Add to your `~/.openclaw/config.json`:

```json
{
  "opik": {
    "enabled": true,
    "apiKey": "your-api-key",
    "projectName": "my-openclaw"
  }
}
```

### Self-hosted / local Opik

```json
{
  "opik": {
    "enabled": true,
    "apiUrl": "http://localhost:5173/api",
    "projectName": "openclaw-local"
  }
}
```

## CLI commands

| Command                   | Description                     |
| ------------------------- | ------------------------------- |
| `openclaw opik configure` | Interactive setup wizard        |
| `openclaw opik status`    | Show current Opik configuration |

## Check status

```bash
openclaw opik status
```

## Verify traces

1. Start the Gateway (`openclaw gateway run`).
2. Send a message: `openclaw message send "Hello, trace me"`.
3. Look for `opik: exporting traces to project "openclaw"` in the
   Gateway log.
4. Open the Opik UI — traces appear under your project within a few seconds.

## What Gets Traced

| Event       | Opik Entity      | Data                                                                   |
| ----------- | ---------------- | ---------------------------------------------------------------------- |
| LLM call    | Trace + LLM Span | Prompt, system prompt, history, response, model, provider, token usage |
| Tool call   | Tool Span        | Tool name, input params, output/result, errors, duration               |
| Agent run   | Trace            | Duration, success/error, cost                                          |
| Model usage | Trace metadata   | Cost (USD), context window utilization                                 |

## Environment Variables

| Variable            | Description            | Default                          |
| ------------------- | ---------------------- | -------------------------------- |
| `OPIK_API_KEY`      | API key for Opik Cloud | —                                |
| `OPIK_URL_OVERRIDE` | Opik API endpoint      | `https://www.comet.com/opik/api` |
| `OPIK_PROJECT_NAME` | Project name in Opik   | `openclaw`                       |
| `OPIK_WORKSPACE`    | Workspace name         | `default`                        |

## Config Options

| Key                  | Type       | Default                 | Description                  |
| -------------------- | ---------- | ----------------------- | ---------------------------- |
| `opik.enabled`       | `boolean`  | `false`                 | Enable/disable the extension |
| `opik.apiKey`        | `string`   | env `OPIK_API_KEY`      | API key                      |
| `opik.apiUrl`        | `string`   | env `OPIK_URL_OVERRIDE` | API endpoint                 |
| `opik.projectName`   | `string`   | `"openclaw"`            | Project name                 |
| `opik.workspaceName` | `string`   | `"default"`             | Workspace name               |
| `opik.tags`          | `string[]` | `["openclaw"]`          | Default tags on traces       |

## Troubleshooting

- **Traces not appearing** — Check `openclaw opik status` shows `Enabled: yes`
  and the Gateway log contains `opik: exporting traces to project "openclaw"`.
  If missing, verify `opik.enabled` is `true` and restart the Gateway.
- **API key rejected** — Re-run `openclaw opik configure` to re-validate. For
  self-hosted instances without auth, remove `opik.apiKey` from your config.
- **Self-hosted not reachable** — Verify with `curl <url>/api/health`. Local
  instances use `/api`, cloud/self-hosted use `/opik/api`. Check firewall rules
  if Gateway and Opik are on different hosts.

For the full setup guide, see
[docs.openclaw.ai/plugins/opik](https://docs.openclaw.ai/plugins/opik).

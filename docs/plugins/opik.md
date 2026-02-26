---
summary: "Opik plugin: export LLM traces, tool calls, and costs to Opik for observability"
read_when:
  - You want to export OpenClaw traces to Opik
  - You are setting up LLM observability with Opik
  - You want to see prompts, completions, tool calls and costs in the Opik UI
title: "Opik (LLM Tracing)"
---

# Opik (LLM Tracing)

Export OpenClaw agent traces to [Opik](https://www.comet.com/docs/opik/) for
LLM observability — see prompts, completions, tool calls, token usage, and
costs in the Opik UI.

## Where it runs

The Opik plugin runs **inside the Gateway process**. If you use a
remote Gateway, install and configure the plugin on the machine running the
Gateway, then restart the Gateway to load it.

## Prerequisites

- An [Opik Cloud](https://www.comet.com/docs/opik/) account (free tier
  available) **or** a self-hosted Opik instance
- An Opik API key (Cloud) or a reachable Opik API endpoint (self-hosted)

## Install

### Option A: install from npm (recommended)

```bash
openclaw plugins install @openclaw/opik
```

Restart the Gateway afterwards.

### Option B: install from a local folder (dev, no copying)

```bash
openclaw plugins install ./extensions/opik
cd ./extensions/opik && pnpm install
```

Restart the Gateway afterwards.

You can also enable the plugin with `openclaw plugins enable opik`.

## Quick start

### Option 1: Interactive wizard (recommended)

Run the guided setup — it validates your URL and API key, auto-detects local
instances, and writes the config for you:

```bash
openclaw opik configure
```

The wizard walks you through:

1. Deployment type — Opik Cloud, self-hosted, or local
2. API URL — auto-detected for local, prompted for self-hosted
3. API key — validated against your account (Cloud and self-hosted only)
4. Workspace name — pre-filled from your account
5. Project name — defaults to `openclaw`

After the wizard finishes, restart the Gateway to start exporting traces.

### Option 2: CLI config commands

Set individual keys from the command line:

```bash
openclaw config set opik.enabled true
openclaw config set opik.apiKey "your-api-key"
openclaw config set opik.projectName "my-openclaw"
```

### Option 3: Edit config JSON directly

Add to your `~/.openclaw/config.json`:

```json5
{
  opik: {
    enabled: true,
  },
}
```

Then set your API key via environment variable or config:

```bash
export OPIK_API_KEY="your-api-key"
```

Restart the Gateway. Traces will appear in the Opik UI under the `openclaw`
project.

## CLI commands

| Command                   | Description                     |
| ------------------------- | ------------------------------- |
| `openclaw opik configure` | Interactive setup wizard        |
| `openclaw opik status`    | Show current Opik configuration |

## Check status

View current Opik configuration:

```bash
openclaw opik status
```

Output:

```
Opik status:

  Enabled:    yes
  API URL:    https://www.comet.com/opik/api
  Workspace:  default
  Project:    openclaw
  API key:    ***
```

## Verify traces are exported

1. Start the Gateway:

   ```bash
   openclaw gateway run
   ```

2. Send a message to any connected channel, or use the CLI:

   ```bash
   openclaw message send "Hello, trace me"
   ```

3. Check the Gateway log for the startup confirmation:

   ```
   opik: exporting traces to project "openclaw"
   ```

4. Open the Opik UI — traces appear under your project within a few seconds.

## Configuration reference

Full config block with all available options:

```json5
{
  opik: {
    enabled: true,
    apiKey: "your-api-key",
    projectName: "my-openclaw",
    workspaceName: "default",
    tags: ["openclaw", "production"],
  },
}
```

| Key                  | Type       | Default                          | Description                     |
| -------------------- | ---------- | -------------------------------- | ------------------------------- |
| `opik.enabled`       | `boolean`  | `false`                          | Enable/disable the plugin       |
| `opik.apiKey`        | `string`   | env `OPIK_API_KEY`               | API key for Opik Cloud          |
| `opik.apiUrl`        | `string`   | `https://www.comet.com/opik/api` | Opik API endpoint               |
| `opik.projectName`   | `string`   | `"openclaw"`                     | Project name in Opik            |
| `opik.workspaceName` | `string`   | `"default"`                      | Workspace name                  |
| `opik.tags`          | `string[]` | `["openclaw"]`                   | Default tags attached to traces |

Notes:

- `opik.enabled` must be `true` for the plugin to export traces.

## Environment variables

| Variable            | Description            | Default                          |
| ------------------- | ---------------------- | -------------------------------- |
| `OPIK_API_KEY`      | API key for Opik Cloud | —                                |
| `OPIK_URL_OVERRIDE` | Opik API endpoint      | `https://www.comet.com/opik/api` |
| `OPIK_PROJECT_NAME` | Project name in Opik   | `openclaw`                       |
| `OPIK_WORKSPACE`    | Workspace name         | `default`                        |

Config values take precedence over environment variables.

## Self-hosted Opik

Point `apiUrl` to your local Opik instance. No API key is needed for
self-hosted deployments without authentication:

```json5
{
  opik: {
    enabled: true,
    apiUrl: "http://localhost:5173/api",
    projectName: "openclaw-local",
  },
}
```

## What gets traced

| Event       | Opik Entity      | Data                                                                   |
| ----------- | ---------------- | ---------------------------------------------------------------------- |
| LLM call    | Trace + LLM Span | Prompt, system prompt, history, response, model, provider, token usage |
| Tool call   | Tool Span        | Tool name, input params, output/result, errors, duration               |
| Agent run   | Trace            | Duration, success/error, cost                                          |
| Model usage | Trace metadata   | Cost (USD), context window utilization                                 |

## Stale trace cleanup

Traces that remain inactive for more than 5 minutes are automatically closed.
This prevents orphaned traces from accumulating when the Gateway shuts down
mid-run or a session is interrupted.

## Troubleshooting

**Traces not appearing in the Opik UI**

1. Confirm the plugin is enabled: `openclaw opik status` should show `Enabled: yes`.
2. Check the Gateway log for the startup line:
   `opik: exporting traces to project "openclaw"`. If missing, the plugin did
   not load — verify `opik.enabled` is `true` and restart the Gateway.
3. Send a test message and wait a few seconds. Traces are flushed after each
   agent run completes.

**API key rejected**

- Re-run `openclaw opik configure` — the wizard validates the key against your
  account before saving.
- For Opik Cloud, confirm the key at
  `https://www.comet.com/account-settings/apiKeys`.
- Self-hosted instances without authentication do not require an API key — remove
  `opik.apiKey` from your config.

**Self-hosted instance not reachable**

- Verify the instance is running: `curl <your-url>/api/health` should return a
  2xx response.
- Local instances use `/api` (e.g. `http://localhost:5173/api`), while
  cloud/self-hosted use `/opik/api`. The configure wizard handles this
  automatically.
- Check firewall rules if the Gateway runs on a different host than Opik.

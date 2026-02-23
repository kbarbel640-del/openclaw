# OpenClaw Bridge

Small HTTP bridge that keeps an OpenAI-style `POST /v1/chat/completions` contract and forwards requests to OpenClaw Gateway with agent routing.

## Run

1. Copy `.env.example` to `.env` and set values.
2. Start:

```bash
node server.mjs
```

## Coolify

- `base_directory`: `/apps/openclaw-bridge`
- start command: `node server.mjs`
- expose port: `3300` (or your `PORT`)

## Agent selection

- If request model is `openclaw:<agentId>` or `agent:<agentId>`, bridge sets `x-openclaw-agent-id` to that agent.
- Otherwise it uses `OPENCLAW_AGENT_ID` (default `main`).

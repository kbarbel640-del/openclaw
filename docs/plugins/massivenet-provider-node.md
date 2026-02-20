---
summary: "MassiveNet provider-node plugin: poll/execute/complete worker loop for OpenClaw runtimes"
read_when:
  - You want OpenClaw to run as a MassiveNet provider node
  - You need a thin MassiveNet worker with local stub/http execution
title: "MassiveNet Provider Node Plugin"
---

# MassiveNet Provider Node (plugin)

This plugin adds a provider-node worker capability to OpenClaw. It is a thin wrapper around MassiveNet node APIs, not a scheduler implementation.

What it does:

- Reads a pre-issued MassiveNet node token from environment.
- Polls `POST /v1/nodes/poll`.
- Fetches payload input from `payload_ref` when needed.
- Executes job input locally:
  - `stub` mode for deterministic test output.
  - `http` mode by forwarding input JSON to a local executor URL.
- Completes jobs via signed callback `POST /internal/jobs/complete`.
- Emits structured worker events (`poll`, `claim`, `execute_*`, `complete_*`).

What it does not do:

- No MassiveNet scheduler logic.
- No settlement/economic policy logic.
- No queue internals.

## Environment variables

Required:

- `MASSIVENET_BASE_URL`
- `MASSIVENET_NODE_TOKEN`

Optional with defaults:

- `MASSIVENET_POLL_INTERVAL_MS` (default `500`)
- `MASSIVENET_BACKOFF_MAX_MS` (default `5000`)
- `MASSIVENET_EXECUTOR` (`stub` or `http`, default `stub`)
- `MASSIVENET_LOCAL_EXECUTOR_URL` (required only when `MASSIVENET_EXECUTOR=http`)
- `MASSIVENET_LOG_JSON` (default `true`)

MassiveNet completion auth requirement:

- `MASSIVENET_INTERNAL_JOB_HMAC_SECRET` is required for `/internal/jobs/complete` because MassiveNet verifies `X-MassiveNet-Signature: sha256=<hmac(raw_body)>`.

## Stub vs HTTP executor

- `stub`:
  - chat jobs return `{ "result_text": "Stub response from OpenClaw MassiveNet node." }`
  - image jobs return `{ "output_urls": ["https://example.com/stub-output.png"] }`
- `http`:
  - forwards job input JSON to `MASSIVENET_LOCAL_EXECUTOR_URL` using `POST`
  - expects:
    - chat: `{ "result_text": "..." }`
    - image: `{ "output_urls": [...] }`

## Run locally

1. Enable the plugin:

```bash
openclaw plugins enable massivenet_provider_node
```

2. Set environment:

```bash
export MASSIVENET_BASE_URL="http://127.0.0.1:8081"
export MASSIVENET_NODE_TOKEN="<node-token>"
export MASSIVENET_INTERNAL_JOB_HMAC_SECRET="<internal-hmac-secret>"
export MASSIVENET_EXECUTOR="stub"
```

3. Restart the Gateway.

The worker starts as a plugin background service and keeps polling until gateway shutdown.

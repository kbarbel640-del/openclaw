---
summary: "Get a machine-readable Gateway config schema and UI hints over RPC"
read_when:
  - You need a source-of-truth config schema for tooling or docs generation
  - You want to validate config keys against the running Gateway
title: "Config Schema API"
---

# Config Schema API

OpenClaw Gateway exposes a protocol method for the canonical, machine-readable config schema:

- RPC method: `config.schema`
- Returns:
  - `schema`: JSON Schema for config
  - `uiHints`: labels/help/sensitive metadata keyed by config path
  - `version`: OpenClaw version
  - `generatedAt`: generation timestamp

Use this as the source of truth when building config UIs, linters, or generated documentation.

## Why use this

- Avoids drift between handwritten docs and runtime schema.
- Includes plugin/channel metadata when available at runtime.
- Keeps validation aligned with what Gateway actually accepts.

## Request

`config.schema` takes no params.

## Response shape

```json
{
  "ok": true,
  "payload": {
    "schema": { "type": "object" },
    "uiHints": {
      "gateway.auth.token": {
        "label": "Gateway Auth Token",
        "sensitive": true
      }
    },
    "version": "2026.2.23",
    "generatedAt": "2026-02-26T12:34:56.000Z"
  }
}
```

## Notes

- This is a Gateway protocol method, not an HTTP endpoint.
- For the human reference, see [Configuration Reference](/gateway/configuration-reference).
- For protocol transport details, see [Gateway Protocol](/gateway/protocol).

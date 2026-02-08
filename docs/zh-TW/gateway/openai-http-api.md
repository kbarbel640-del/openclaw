---
summary: 「從 Gateway 閘道器公開一個相容 OpenAI 的 /v1/chat/completions HTTP 端點」
read_when:
  - 「整合需要 OpenAI Chat Completions 的工具」
title: 「OpenAI Chat Completions」
x-i18n:
  source_path: gateway/openai-http-api.md
  source_hash: 6f935777f489bff9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:25Z
---

# OpenAI Chat Completions（HTTP）

OpenClaw 的 Gateway 閘道器可以提供一個小型、相容 OpenAI 的 Chat Completions 端點。

此端點**預設為停用**。請先在設定中啟用。

- `POST /v1/chat/completions`
- 與 Gateway 閘道器相同的連接埠（WS + HTTP 多工）：`http://<gateway-host>:<port>/v1/chat/completions`

在底層，請求會以一般的 Gateway 閘道器代理程式執行（與 `openclaw agent` 使用相同的程式路徑），因此路由／權限／設定會與你的 Gateway 閘道器一致。

## Authentication

使用 Gateway 閘道器的驗證設定。請傳送 Bearer token：

- `Authorization: Bearer <token>`

注意事項：

- 當 `gateway.auth.mode="token"` 時，請使用 `gateway.auth.token`（或 `OPENCLAW_GATEWAY_TOKEN`）。
- 當 `gateway.auth.mode="password"` 時，請使用 `gateway.auth.password`（或 `OPENCLAW_GATEWAY_PASSWORD`）。

## Choosing an agent

不需要自訂標頭：請在 OpenAI 的 `model` 欄位中編碼代理程式 ID：

- `model: "openclaw:<agentId>"`（例如：`"openclaw:main"`、`"openclaw:beta"`）
- `model: "agent:<agentId>"`（別名）

或是透過標頭指定特定的 OpenClaw 代理程式：

- `x-openclaw-agent-id: <agentId>`（預設：`main`）

進階：

- 使用 `x-openclaw-session-key: <sessionKey>` 以完整控制工作階段路由。

## Enabling the endpoint

將 `gateway.http.endpoints.chatCompletions.enabled` 設為 `true`：

```json5
{
  gateway: {
    http: {
      endpoints: {
        chatCompletions: { enabled: true },
      },
    },
  },
}
```

## Disabling the endpoint

將 `gateway.http.endpoints.chatCompletions.enabled` 設為 `false`：

```json5
{
  gateway: {
    http: {
      endpoints: {
        chatCompletions: { enabled: false },
      },
    },
  },
}
```

## Session behavior

預設情況下，此端點對每個請求皆為**無狀態**（每次呼叫都會產生新的工作階段金鑰）。

如果請求包含 OpenAI 的 `user` 字串，Gateway 閘道器會從中推導出穩定的工作階段金鑰，讓重複呼叫能共用同一個代理程式工作階段。

## Streaming（SSE）

設定 `stream: true` 以接收 Server-Sent Events（SSE）：

- `Content-Type: text/event-stream`
- 每一行事件為 `data: <json>`
- 串流以 `data: [DONE]` 結束

## Examples

非串流：

```bash
curl -sS http://127.0.0.1:18789/v1/chat/completions \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'x-openclaw-agent-id: main' \
  -d '{
    "model": "openclaw",
    "messages": [{"role":"user","content":"hi"}]
  }'
```

串流：

```bash
curl -N http://127.0.0.1:18789/v1/chat/completions \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'x-openclaw-agent-id: main' \
  -d '{
    "model": "openclaw",
    "stream": true,
    "messages": [{"role":"user","content":"hi"}]
  }'
```

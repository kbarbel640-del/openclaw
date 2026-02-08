---
summary: "Cung cap mot diem cuoi HTTP /v1/chat/completions tuong thich OpenAI tu Gateway"
read_when:
  - Tich hop cac cong cu mong doi OpenAI Chat Completions
title: "OpenAI Chat Completions"
x-i18n:
  source_path: gateway/openai-http-api.md
  source_hash: 6f935777f489bff9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:13Z
---

# OpenAI Chat Completions (HTTP)

Gateway cua OpenClaw co the phuc vu mot diem cuoi Chat Completions tuong thich OpenAI nho gon.

Diem cuoi nay **bi tat theo mac dinh**. Hay bat no trong cau hinh truoc.

- `POST /v1/chat/completions`
- Cung cong voi Gateway (WS + HTTP multiplex): `http://<gateway-host>:<port>/v1/chat/completions`

Ben trong, cac yeu cau duoc thuc thi nhu mot lan chay tac tu Gateway thong thuong (cung duong ma voi `openclaw agent`), vi vay dinh tuyen/quyen/cau hinh se phu hop voi Gateway cua ban.

## Authentication

Su dung cau hinh xac thuc cua Gateway. Gui bearer token:

- `Authorization: Bearer <token>`

Ghi chu:

- Khi `gateway.auth.mode="token"`, su dung `gateway.auth.token` (hoac `OPENCLAW_GATEWAY_TOKEN`).
- Khi `gateway.auth.mode="password"`, su dung `gateway.auth.password` (hoac `OPENCLAW_GATEWAY_PASSWORD`).

## Chon agent

Khong can header tuy chinh: ma hoa agent id trong truong OpenAI `model`:

- `model: "openclaw:<agentId>"` (vi du: `"openclaw:main"`, `"openclaw:beta"`)
- `model: "agent:<agentId>"` (alias)

Hoac nham toi mot agent OpenClaw cu the bang header:

- `x-openclaw-agent-id: <agentId>` (mac dinh: `main`)

Nang cao:

- `x-openclaw-session-key: <sessionKey>` de kiem soat hoan toan dinh tuyen phien.

## Bat diem cuoi

Dat `gateway.http.endpoints.chatCompletions.enabled` thanh `true`:

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

## Tat diem cuoi

Dat `gateway.http.endpoints.chatCompletions.enabled` thanh `false`:

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

## Hanh vi phien

Theo mac dinh, diem cuoi la **khong luu trang thai theo tung yeu cau** (moi lan goi se tao mot khoa phien moi).

Neu yeu cau bao gom chuoi OpenAI `user`, Gateway se suy ra mot khoa phien on dinh tu no, de cac lan goi lap lai co the chia se mot phien agent.

## Streaming (SSE)

Dat `stream: true` de nhan Server-Sent Events (SSE):

- `Content-Type: text/event-stream`
- Moi dong su kien la `data: <json>`
- Luong ket thuc bang `data: [DONE]`

## Vi du

Khong streaming:

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

Streaming:

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

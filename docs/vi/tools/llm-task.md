---
summary: "Tac vu LLM chi JSON cho workflow (cong cu plugin tuy chon)"
read_when:
  - Ban muon mot buoc LLM chi JSON ben trong workflow
  - Ban can dau ra LLM duoc xac thuc theo schema de tu dong hoa
title: "Tac vu LLM"
x-i18n:
  source_path: tools/llm-task.md
  source_hash: b7aa78f179cb0f63
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:43Z
---

# Tac vu LLM

`llm-task` la mot **cong cu plugin tuy chon** chay tac vu LLM chi JSON va
tra ve dau ra co cau truc (tuy chon xac thuc theo JSON Schema).

Dieu nay rat phu hop cho cac cong cu workflow nhu Lobster: ban co the them mot buoc LLM duy nhat
ma khong can viet ma OpenClaw tuy chinh cho moi workflow.

## Bat plugin

1. Bat plugin:

```json
{
  "plugins": {
    "entries": {
      "llm-task": { "enabled": true }
    }
  }
}
```

2. Them cong cu vao danh sach cho phep (no duoc dang ky voi `optional: true`):

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": { "allow": ["llm-task"] }
      }
    ]
  }
}
```

## Cau hinh (tuy chon)

```json
{
  "plugins": {
    "entries": {
      "llm-task": {
        "enabled": true,
        "config": {
          "defaultProvider": "openai-codex",
          "defaultModel": "gpt-5.2",
          "defaultAuthProfileId": "main",
          "allowedModels": ["openai-codex/gpt-5.3-codex"],
          "maxTokens": 800,
          "timeoutMs": 30000
        }
      }
    }
  }
}
```

`allowedModels` la danh sach cho phep cac chuoi `provider/model`. Neu duoc thiet lap, moi yeu cau
nam ngoai danh sach se bi tu choi.

## Tham so cong cu

- `prompt` (string, bat buoc)
- `input` (any, tuy chon)
- `schema` (object, JSON Schema tuy chon)
- `provider` (string, tuy chon)
- `model` (string, tuy chon)
- `authProfileId` (string, tuy chon)
- `temperature` (number, tuy chon)
- `maxTokens` (number, tuy chon)
- `timeoutMs` (number, tuy chon)

## Dau ra

Tra ve `details.json` chua JSON da duoc phan tich (va xac thuc theo
`schema` khi duoc cung cap).

## Vi du: Buoc workflow Lobster

```lobster
openclaw.invoke --tool llm-task --action json --args-json '{
  "prompt": "Given the input email, return intent and draft.",
  "input": {
    "subject": "Hello",
    "body": "Can you help?"
  },
  "schema": {
    "type": "object",
    "properties": {
      "intent": { "type": "string" },
      "draft": { "type": "string" }
    },
    "required": ["intent", "draft"],
    "additionalProperties": false
  }
}'
```

## Luu y ve an toan

- Cong cu la **chi JSON** va huong dan mo hinh chi xuat JSON (khong
  code fences, khong binh luan).
- Khong co cong cu nao duoc mo cho mo hinh trong lan chay nay.
- Xem dau ra la khong dang tin cay tru khi ban xac thuc bang `schema`.
- Dat cac buoc phe duyet truoc moi buoc gay tac dong (send, post, exec).

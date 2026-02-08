---
summary: "Referencia da CLI para `openclaw webhooks` (auxiliares de webhook + Gmail Pub/Sub)"
read_when:
  - Voce quer conectar eventos do Gmail Pub/Sub ao OpenClaw
  - Voce quer comandos auxiliares de webhook
title: "webhooks"
x-i18n:
  source_path: cli/webhooks.md
  source_hash: 785ec62afe6631b3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:47Z
---

# `openclaw webhooks`

Auxiliares de webhook e integracoes (Gmail Pub/Sub, auxiliares de webhook).

Relacionados:

- Webhooks: [Webhook](/automation/webhook)
- Gmail Pub/Sub: [Gmail Pub/Sub](/automation/gmail-pubsub)

## Gmail

```bash
openclaw webhooks gmail setup --account you@example.com
openclaw webhooks gmail run
```

Veja a [documentacao do Gmail Pub/Sub](/automation/gmail-pubsub) para mais detalhes.

---
summary: "`openclaw webhooks`에 대한 CLI 참조 (웹훅 헬퍼 + Gmail Pub/Sub)"
read_when:
  - Gmail Pub/Sub 이벤트를 OpenClaw에 연결하려는 경우
  - 웹훅 헬퍼 명령을 사용하려는 경우
title: "webhooks"
x-i18n:
  source_path: cli/webhooks.md
  source_hash: 785ec62afe6631b3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:37Z
---

# `openclaw webhooks`

웹훅 헬퍼 및 통합 (Gmail Pub/Sub, 웹훅 헬퍼).

관련 항목:

- Webhooks: [Webhook](/automation/webhook)
- Gmail Pub/Sub: [Gmail Pub/Sub](/automation/gmail-pubsub)

## Gmail

```bash
openclaw webhooks gmail setup --account you@example.com
openclaw webhooks gmail run
```

자세한 내용은 [Gmail Pub/Sub 문서](/automation/gmail-pubsub)를 참조하십시오.

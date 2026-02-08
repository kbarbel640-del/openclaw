---
summary: "`openclaw webhooks` の CLI リファレンス（webhook ヘルパー + Gmail Pub/Sub）"
read_when:
  - Gmail Pub/Sub イベントを OpenClaw に接続したい場合
  - webhook ヘルパーコマンドが必要な場合
title: "webhooks"
x-i18n:
  source_path: cli/webhooks.md
  source_hash: 785ec62afe6631b3
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:00:51Z
---

# `openclaw webhooks`

Webhook ヘルパーと統合（Gmail Pub/Sub、webhook ヘルパー）。

関連:

- Webhooks: [Webhook](/automation/webhook)
- Gmail Pub/Sub: [Gmail Pub/Sub](/automation/gmail-pubsub)

## Gmail

```bash
openclaw webhooks gmail setup --account you@example.com
openclaw webhooks gmail run
```

詳細は [Gmail Pub/Sub ドキュメント](/automation/gmail-pubsub) を参照してください。

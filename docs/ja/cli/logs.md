---
summary: "CLI リファレンス：`openclaw logs`（RPC 経由で Gateway（ゲートウェイ）のログを tail する）"
read_when:
  - SSH なしで Gateway（ゲートウェイ）のログをリモートで tail する必要がある場合
  - ツール用に JSON のログ行が欲しい場合
title: "logs"
x-i18n:
  source_path: cli/logs.md
  source_hash: 911a57f0f3b78412
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:00:20Z
---

# `openclaw logs`

RPC 経由で Gateway（ゲートウェイ）のファイルログを tail します（リモートモードで動作します）。

関連:

- ロギング概要: [Logging](/logging)

## 例

```bash
openclaw logs
openclaw logs --follow
openclaw logs --json
openclaw logs --limit 500
```

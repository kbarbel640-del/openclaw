---
summary: "Gateway（ゲートウェイ）経由で 1 回のエージェントターンを送信する `openclaw agent` の CLI リファレンス"
read_when:
  - スクリプトから 1 回のエージェントターンを実行したい（必要に応じて返信を配信）
title: "agent"
x-i18n:
  source_path: cli/agent.md
  source_hash: dcf12fb94e207c68
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:51:12Z
---

# `openclaw agent`

Gateway（ゲートウェイ）経由でエージェントターンを実行します（埋め込みの場合は `--local` を使用してください）。
設定済みのエージェントを直接ターゲットにするには `--agent <id>` を使用してください。

関連:

- エージェント送信ツール: [Agent send](/tools/agent-send)

## 例

```bash
openclaw agent --to +15555550123 --message "status update" --deliver
openclaw agent --agent ops --message "Summarize logs"
openclaw agent --session-id 1234 --message "Summarize inbox" --thinking medium
openclaw agent --agent ops --message "Generate report" --deliver --reply-channel slack --reply-to "#reports"
```

---
summary: "OpenClaw で多数のモデルにアクセスするために、OpenRouter の統合 API を使用します"
read_when:
  - "多数の LLM に対して単一の API キーを使いたい場合"
  - "OpenClaw で OpenRouter 経由のモデルを実行したい場合"
title: "OpenRouter"
x-i18n:
  source_path: providers/openrouter.md
  source_hash: b7e29fc9c456c64d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:37Z
---

# OpenRouter

OpenRouter は、単一のエンドポイントと API キーの背後で多数のモデルにリクエストをルーティングする **統合 API** を提供します。OpenAI 互換であるため、ベース URL を切り替えることで、ほとんどの OpenAI SDK が動作します。

## CLI セットアップ

```bash
openclaw onboard --auth-choice apiKey --token-provider openrouter --token "$OPENROUTER_API_KEY"
```

## 設定スニペット

```json5
{
  env: { OPENROUTER_API_KEY: "sk-or-..." },
  agents: {
    defaults: {
      model: { primary: "openrouter/anthropic/claude-sonnet-4-5" },
    },
  },
}
```

## 注意事項

- モデル参照は `openrouter/<provider>/<model>` です。
- 追加のモデル／プロバイダーのオプションについては、[/concepts/model-providers](/concepts/model-providers) を参照してください。
- OpenRouter は内部的に、API キーを Bearer トークンとして使用します。

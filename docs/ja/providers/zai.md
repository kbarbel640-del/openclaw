---
summary: "OpenClaw で Z.AI（GLM モデル）を使用します"
read_when:
  - OpenClaw で Z.AI / GLM モデルを使用したい場合
  - シンプルな ZAI_API_KEY の設定が必要な場合
title: "Z.AI"
x-i18n:
  source_path: providers/zai.md
  source_hash: 2c24bbad86cf86c3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:39Z
---

# Z.AI

Z.AI は **GLM** モデル向けの API プラットフォームです。GLM 向けの REST API を提供し、認証には API キーを使用します。Z.AI コンソールで API キーを作成してください。OpenClaw は、Z.AI の API キーとともに `zai` プロバイダーを使用します。

## CLI setup

```bash
openclaw onboard --auth-choice zai-api-key
# or non-interactive
openclaw onboard --zai-api-key "$ZAI_API_KEY"
```

## Config snippet

```json5
{
  env: { ZAI_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "zai/glm-4.7" } } },
}
```

## Notes

- GLM モデルは `zai/<model>` として利用できます（例: `zai/glm-4.7`）。
- モデルファミリーの概要については [/providers/glm](/providers/glm) を参照してください。
- Z.AI は API キーを使用した Bearer 認証を使用します。

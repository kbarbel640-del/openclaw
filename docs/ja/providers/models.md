---
summary: "OpenClaw でサポートされているモデルプロバイダー（LLM）"
read_when:
  - モデルプロバイダーを選択したい場合
  - LLM の認証とモデル選択のクイックセットアップ例を知りたい場合
title: "モデルプロバイダー クイックスタート"
x-i18n:
  source_path: providers/models.md
  source_hash: c897ca87805f1ec5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:37Z
---

# モデルプロバイダー

OpenClaw は多くの LLM プロバイダーを利用できます。1 つ選択して認証し、既定の
モデルを `provider/model` として設定します。

## ハイライト: Venice（Venice AI）

Venice は、プライバシー重視の推論を行うための推奨 Venice AI セットアップで、最も難しいタスクには Opus を使用するオプションがあります。

- デフォルト: `venice/llama-3.3-70b`
- 総合的に最良: `venice/claude-opus-45`（Opus は依然として最強です）

詳細は [Venice AI](/providers/venice) を参照してください。

## クイックスタート（2 ステップ）

1. プロバイダーで認証します（通常は `openclaw onboard` を使用）。
2. 既定のモデルを設定します:

```json5
{
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

## 対応プロバイダー（スターターセット）

- [OpenAI（API + Codex）](/providers/openai)
- [Anthropic（API + Claude Code CLI）](/providers/anthropic)
- [OpenRouter](/providers/openrouter)
- [Vercel AI Gateway](/providers/vercel-ai-gateway)
- [Cloudflare AI Gateway](/providers/cloudflare-ai-gateway)
- [Moonshot AI（Kimi + Kimi Coding）](/providers/moonshot)
- [Synthetic](/providers/synthetic)
- [OpenCode Zen](/providers/opencode)
- [Z.AI](/providers/zai)
- [GLM models](/providers/glm)
- [MiniMax](/providers/minimax)
- [Venice（Venice AI）](/providers/venice)
- [Amazon Bedrock](/bedrock)

xAI、Groq、Mistral などを含むすべてのプロバイダーカタログや高度な設定については、
[Model providers](/concepts/model-providers) を参照してください。

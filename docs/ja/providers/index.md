---
summary: "OpenClaw がサポートするモデルプロバイダー（LLM）"
read_when:
  - モデルプロバイダーを選択したいとき
  - サポートされている LLM バックエンドの概要をすばやく把握したいとき
title: "モデルプロバイダー"
x-i18n:
  source_path: providers/index.md
  source_hash: 84233de8ae3a39e0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:35Z
---

# モデルプロバイダー

OpenClaw は多くの LLM プロバイダーを利用できます。プロバイダーを選択して認証し、次に
デフォルトモデルを `provider/model` として設定します。

チャットチャンネルのドキュメント（WhatsApp/Telegram/Discord/Slack/Mattermost（プラグイン）/など）をお探しですか？ [Channels](/channels) を参照してください。

## ハイライト：Venice（Venice AI）

Venice は、プライバシー重視の推論に最適な、推奨の Venice AI 設定です。難易度の高いタスクでは Opus を使用するオプションがあります。

- デフォルト：`venice/llama-3.3-70b`
- 総合的に最良：`venice/claude-opus-45`（Opus は引き続き最も強力です）

[Venice AI](/providers/venice) を参照してください。

## クイックスタート

1. プロバイダーで認証します（通常は `openclaw onboard` を使用します）。
2. デフォルトモデルを設定します：

```json5
{
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

## プロバイダードキュメント

- [OpenAI（API + Codex）](/providers/openai)
- [Anthropic（API + Claude Code CLI）](/providers/anthropic)
- [Qwen（OAuth）](/providers/qwen)
- [OpenRouter](/providers/openrouter)
- [Vercel AI Gateway](/providers/vercel-ai-gateway)
- [Cloudflare AI Gateway](/providers/cloudflare-ai-gateway)
- [Moonshot AI（Kimi + Kimi Coding）](/providers/moonshot)
- [OpenCode Zen](/providers/opencode)
- [Amazon Bedrock](/bedrock)
- [Z.AI](/providers/zai)
- [Xiaomi](/providers/xiaomi)
- [GLM models](/providers/glm)
- [MiniMax](/providers/minimax)
- [Venice（Venice AI、プライバシー重視）](/providers/venice)
- [Ollama（ローカルモデル）](/providers/ollama)

## 文字起こしプロバイダー

- [Deepgram（音声文字起こし）](/providers/deepgram)

## コミュニティツール

- [Claude Max API Proxy](/providers/claude-max-api-proxy) - Claude Max/Pro のサブスクリプションを OpenAI 互換の API エンドポイントとして使用します

xAI、Groq、Mistral などを含む完全なプロバイダーカタログと高度な設定については、
[Model providers](/concepts/model-providers) を参照してください。

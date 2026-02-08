---
summary: "OpenClaw 支援的模型提供者（LLM）"
read_when:
  - 您想要選擇模型提供者
  - 您需要快速概覽支援的 LLM 後端
title: "模型提供者"
x-i18n:
  source_path: providers/index.md
  source_hash: 84233de8ae3a39e0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:14Z
---

# 模型提供者

OpenClaw 可以使用多種 LLM 提供者。選擇一個提供者、完成驗證，然後將預設模型設定為 `provider/model`。

在找聊天頻道文件（WhatsApp/Telegram/Discord/Slack/Mattermost（外掛）/等）嗎？請參閱 [Channels](/channels)。

## 重點：Venice（Venice AI）

Venice 是我們推薦的 Venice AI 設定，主打隱私優先的推論，並可選用 Opus 來處理高難度任務。

- 預設：`venice/llama-3.3-70b`
- 整體最佳：`venice/claude-opus-45`（Opus 仍然最強）

請參閱 [Venice AI](/providers/venice)。

## 快速開始

1. 使用提供者完成驗證（通常透過 `openclaw onboard`）。
2. 設定預設模型：

```json5
{
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

## 提供者文件

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
- [Venice（Venice AI，隱私導向）](/providers/venice)
- [Ollama（本地模型）](/providers/ollama)

## 轉錄提供者

- [Deepgram（音訊轉錄）](/providers/deepgram)

## 社群工具

- [Claude Max API Proxy](/providers/claude-max-api-proxy) - 將 Claude Max/Pro 訂閱作為 OpenAI 相容的 API 端點使用

如需完整的提供者目錄（xAI、Groq、Mistral 等）與進階設定，
請參閱 [Model providers](/concepts/model-providers)。

---
summary: "OpenClaw 支援的模型提供者（LLMs）"
read_when:
  - 你想要選擇一個模型提供者
  - 你想要快速設定 LLM 驗證與模型選擇的範例
title: "模型提供者快速開始"
x-i18n:
  source_path: providers/models.md
  source_hash: c897ca87805f1ec5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:17Z
---

# 模型提供者

OpenClaw 可以使用多種 LLM 提供者。選擇其中一個，完成驗證，然後將預設模型設定為 `provider/model`。

## 重點：Venice（Venice AI）

Venice 是我們推薦的 Venice AI 設定，提供以隱私為優先的推論，並可選擇使用 Opus 來處理最困難的任務。

- 預設：`venice/llama-3.3-70b`
- 整體最佳：`venice/claude-opus-45`（Opus 仍然是最強）

請參閱 [Venice AI](/providers/venice)。

## 快速開始（兩個步驟）

1. 使用提供者完成驗證（通常透過 `openclaw onboard`）。
2. 設定預設模型：

```json5
{
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

## 支援的提供者（入門組合）

- [OpenAI（API + Codex）](/providers/openai)
- [Anthropic（API + Claude Code CLI）](/providers/anthropic)
- [OpenRouter](/providers/openrouter)
- [Vercel AI Gateway](/providers/vercel-ai-gateway)
- [Cloudflare AI Gateway](/providers/cloudflare-ai-gateway)
- [Moonshot AI（Kimi + Kimi Coding）](/providers/moonshot)
- [Synthetic](/providers/synthetic)
- [OpenCode Zen](/providers/opencode)
- [Z.AI](/providers/zai)
- [GLM 模型](/providers/glm)
- [MiniMax](/providers/minimax)
- [Venice（Venice AI）](/providers/venice)
- [Amazon Bedrock](/bedrock)

如需完整的提供者目錄（xAI、Groq、Mistral 等）與進階設定，請參閱 [模型提供者](/concepts/model-providers)。

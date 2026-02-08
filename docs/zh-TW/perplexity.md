---
summary: "用於 web_search 的 Perplexity Sonar 設定"
read_when:
  - 你想要使用 Perplexity Sonar 進行網頁搜尋
  - 你需要 PERPLEXITY_API_KEY 或 OpenRouter 設定
title: "Perplexity Sonar"
x-i18n:
  source_path: perplexity.md
  source_hash: 264d08e62e3bec85
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:54Z
---

# Perplexity Sonar

OpenClaw 可使用 Perplexity Sonar 作為 `web_search` 工具。你可以
透過 Perplexity 的直接 API 連線，或經由 OpenRouter。

## API 選項

### Perplexity（直接）

- Base URL: https://api.perplexity.ai
- 環境變數: `PERPLEXITY_API_KEY`

### OpenRouter（替代方案）

- Base URL: https://openrouter.ai/api/v1
- 環境變數: `OPENROUTER_API_KEY`
- 支援預付／加密貨幣點數。

## 設定範例

```json5
{
  tools: {
    web: {
      search: {
        provider: "perplexity",
        perplexity: {
          apiKey: "pplx-...",
          baseUrl: "https://api.perplexity.ai",
          model: "perplexity/sonar-pro",
        },
      },
    },
  },
}
```

## 從 Brave 切換

```json5
{
  tools: {
    web: {
      search: {
        provider: "perplexity",
        perplexity: {
          apiKey: "pplx-...",
          baseUrl: "https://api.perplexity.ai",
        },
      },
    },
  },
}
```

如果同時設定了 `PERPLEXITY_API_KEY` 與 `OPENROUTER_API_KEY`，請設定
`tools.web.search.perplexity.baseUrl`（或 `tools.web.search.perplexity.apiKey`）
以進行區分。

如果未設定 Base URL，OpenClaw 會依 API 金鑰來源選擇預設值：

- `PERPLEXITY_API_KEY` 或 `pplx-...` → 直接 Perplexity（`https://api.perplexity.ai`）
- `OPENROUTER_API_KEY` 或 `sk-or-...` → OpenRouter（`https://openrouter.ai/api/v1`）
- 不明的金鑰格式 → OpenRouter（安全後備）

## 模型

- `perplexity/sonar` — 快速 Q&A 與網頁搜尋
- `perplexity/sonar-pro`（預設）— 多步推理 + 網頁搜尋
- `perplexity/sonar-reasoning-pro` — 深度研究

完整的 web_search 設定請參閱 [Web tools](/tools/web)。

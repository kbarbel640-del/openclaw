---
summary: "在本機 LLM（LM Studio、vLLM、LiteLLM、自訂 OpenAI 端點）上執行 OpenClaw"
read_when:
  - 你想要從自己的 GPU 主機提供模型服務
  - 你正在串接 LM Studio 或 OpenAI 相容的代理
  - 你需要最安全的本機模型使用指南
title: "本機模型"
x-i18n:
  source_path: gateway/local-models.md
  source_hash: 63a7cc8b114355c6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:27Z
---

# 本機模型

本機是可行的，但 OpenClaw 期望「大型上下文」+「強力的提示注入防護」。小型顯卡會截斷上下文並洩漏安全性。目標要高：**≥2 台滿配的 Mac Studio 或等級相當的 GPU 主機（約 ~$30k+）**。單張 **24 GB** GPU 僅適合較輕量的提示，且延遲較高。請使用**你能運行的最大／完整尺寸模型變體**；高度量化或「小型」檢查點會提高提示注入風險（見 [Security](/gateway/security)）。

## 建議：LM Studio + MiniMax M2.1（Responses API，完整尺寸）

目前最佳的本機堆疊。在 LM Studio 中載入 MiniMax M2.1，啟用本機伺服器（預設 `http://127.0.0.1:1234`），並使用 Responses API 將推理與最終文字分離。

```json5
{
  agents: {
    defaults: {
      model: { primary: "lmstudio/minimax-m2.1-gs32" },
      models: {
        "anthropic/claude-opus-4-6": { alias: "Opus" },
        "lmstudio/minimax-m2.1-gs32": { alias: "Minimax" },
      },
    },
  },
  models: {
    mode: "merge",
    providers: {
      lmstudio: {
        baseUrl: "http://127.0.0.1:1234/v1",
        apiKey: "lmstudio",
        api: "openai-responses",
        models: [
          {
            id: "minimax-m2.1-gs32",
            name: "MiniMax M2.1 GS32",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 196608,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

**設定檢查清單**

- 安裝 LM Studio：https://lmstudio.ai
- 在 LM Studio 中下載**可用的最大 MiniMax M2.1 版本**（避免「small」／高度量化的變體），啟動伺服器，確認 `http://127.0.0.1:1234/v1/models` 能列出它。
- 保持模型載入；冷啟動會增加啟動延遲。
- 若你的 LM Studio 版本不同，請調整 `contextWindow`/`maxTokens`。
- 針對 WhatsApp，請堅持使用 Responses API，確保只傳送最終文字。

即使在本機運行，也要保持代管模型的設定；使用 `models.mode: "merge"` 以確保後備仍可用。

### 混合設定：代管為主，本機後備

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "anthropic/claude-sonnet-4-5",
        fallbacks: ["lmstudio/minimax-m2.1-gs32", "anthropic/claude-opus-4-6"],
      },
      models: {
        "anthropic/claude-sonnet-4-5": { alias: "Sonnet" },
        "lmstudio/minimax-m2.1-gs32": { alias: "MiniMax Local" },
        "anthropic/claude-opus-4-6": { alias: "Opus" },
      },
    },
  },
  models: {
    mode: "merge",
    providers: {
      lmstudio: {
        baseUrl: "http://127.0.0.1:1234/v1",
        apiKey: "lmstudio",
        api: "openai-responses",
        models: [
          {
            id: "minimax-m2.1-gs32",
            name: "MiniMax M2.1 GS32",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 196608,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

### 本機優先，代管安全網

對調主要與後備的順序；保留相同的 providers 區塊與 `models.mode: "merge"`，以便當本機主機停機時可回退到 Sonnet 或 Opus。

### 區域代管／資料路由

- 代管的 MiniMax／Kimi／GLM 變體也存在於 OpenRouter，並提供區域鎖定的端點（例如美國代管）。在那裡選擇區域版本，即可在仍使用 `models.mode: "merge"` 作為 Anthropic／OpenAI 後備的同時，將流量留在你選定的司法管轄區。
- 純本機仍是最強的隱私路徑；當你需要供應商功能但又想掌控資料流向時，代管的區域路由是折衷方案。

## 其他 OpenAI 相容的本機代理

只要 vLLM、LiteLLM、OAI-proxy，或自訂閘道器能暴露 OpenAI 風格的 `/v1` 端點即可。將上方的 provider 區塊替換為你的端點與模型 ID：

```json5
{
  models: {
    mode: "merge",
    providers: {
      local: {
        baseUrl: "http://127.0.0.1:8000/v1",
        apiKey: "sk-local",
        api: "openai-responses",
        models: [
          {
            id: "my-local-model",
            name: "Local Model",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 120000,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

保留 `models.mode: "merge"`，讓代管模型持續可作為後備。

## 疑難排解

- Gateway 閘道器 能連到代理嗎？`curl http://127.0.0.1:1234/v1/models`。
- LM Studio 模型被卸載？重新載入；冷啟動是常見的「卡住」原因。
- 上下文錯誤？降低 `contextWindow` 或提高你的伺服器上限。
- 安全性：本機模型會跳過供應商端的過濾；請保持代理程式職責精簡並啟用壓縮，以限制提示注入的影響範圍。

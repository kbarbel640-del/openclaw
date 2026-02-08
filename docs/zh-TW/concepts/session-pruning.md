---
summary: "工作階段修剪：修剪工具結果以減少內容脹大"
read_when:
  - 您想要減少來自工具輸出的 LLM 內容成長
  - 您正在調整 agents.defaults.contextPruning
x-i18n:
  source_path: concepts/session-pruning.md
  source_hash: 9b0aa2d1abea7050
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:05Z
---

# 工作階段修剪

工作階段修剪會在每次 LLM 呼叫之前，從記憶體內的內容中修剪 **較舊的工具結果**。它 **不會** 重寫磁碟上的工作階段歷史記錄（`*.jsonl`）。

## 何時執行

- 當啟用 `mode: "cache-ttl"`，且該工作階段最後一次 Anthropic 呼叫早於 `ttl`。
- 只影響該次請求送往模型的訊息。
- 僅對 Anthropic API 呼叫（以及 OpenRouter Anthropic 模型）生效。
- 為了最佳效果，請將 `ttl` 與您的模型 `cacheControlTtl` 相符。
- 修剪之後，TTL 視窗會重置，因此後續請求會保留快取，直到 `ttl` 再次到期。

## 智慧預設值（Anthropic）

- **OAuth 或 setup-token** 設定檔：啟用 `cache-ttl` 修剪，並將心跳設為 `1h`。
- **API key** 設定檔：啟用 `cache-ttl` 修剪，將心跳設為 `30m`，並在 Anthropic 模型上將 `cacheControlTtl` 的預設值設為 `1h`。
- 若您明確設定其中任何值，OpenClaw **不會** 覆寫它們。

## 這能改善什麼（成本 + 快取行為）

- **為何要修剪：** Anthropic 的提示快取僅在 TTL 內生效。若工作階段在超過 TTL 後閒置，下一次請求會重新快取完整提示，除非您先行修剪。
- **哪些成本會降低：** 修剪可降低 TTL 到期後第一次請求的 **cacheWrite** 大小。
- **為何 TTL 重置很重要：** 一旦執行修剪，快取視窗會重置，後續請求即可重用新快取的提示，而不必再次快取完整歷史。
- **它不會做什麼：** 修剪不會增加權杖或「加倍」成本；它只會改變 TTL 到期後第一次請求所被快取的內容。

## 可被修剪的內容

- 僅限 `toolResult` 訊息。
- 使用者與助理訊息 **永遠不會** 被修改。
- 最後的 `keepLastAssistants` 則助理訊息受到保護；在該切點之後的工具結果不會被修剪。
- 若助理訊息不足以建立切點，則會跳過修剪。
- 包含 **影像區塊** 的工具結果會被跳過（永不修剪或清除）。

## 內容視窗估算

修剪會使用估算的內容視窗（字元 ≈ 權杖 × 4）。基礎視窗會依下列順序解析：

1. `models.providers.*.models[].contextWindow` 覆寫。
2. 模型定義 `contextWindow`（來自模型登錄）。
3. 預設 `200000` 權杖。

若設定 `agents.defaults.contextTokens`，則其會被視為解析後視窗的上限（最小值）。

## 模式

### cache-ttl

- 僅當最後一次 Anthropic 呼叫早於 `ttl`（預設 `5m`）時才會執行修剪。
- 執行時：與先前相同的軟性修剪 + 硬性清除行為。

## 軟性 vs 硬性修剪

- **軟性修剪（Soft-trim）：** 僅用於過大的工具結果。
  - 保留開頭 + 結尾，插入 `...`，並附加原始大小的註記。
  - 會跳過含有影像區塊的結果。
- **硬性清除（Hard-clear）：** 以 `hardClear.placeholder` 取代整個工具結果。

## 工具選擇

- `tools.allow` / `tools.deny` 支援 `*` 萬用字元。
- 拒絕優先。
- 比對不區分大小寫。
- 允許清單為空 => 允許所有工具。

## 與其他限制的互動

- 內建工具已會自行截斷輸出；工作階段修剪是額外一層，可避免長時間聊天在模型內容中累積過多工具輸出。
- 壓縮（Compaction）是獨立機制：壓縮會摘要並持久化，而修剪是每次請求的暫時性行為。請參閱 [/concepts/compaction](/concepts/compaction)。

## 預設值（啟用時）

- `ttl`: `"5m"`
- `keepLastAssistants`: `3`
- `softTrimRatio`: `0.3`
- `hardClearRatio`: `0.5`
- `minPrunableToolChars`: `50000`
- `softTrim`: `{ maxChars: 4000, headChars: 1500, tailChars: 1500 }`
- `hardClear`: `{ enabled: true, placeholder: "[Old tool result content cleared]" }`

## 範例

預設（關閉）：

```json5
{
  agent: {
    contextPruning: { mode: "off" },
  },
}
```

啟用具 TTL 感知的修剪：

```json5
{
  agent: {
    contextPruning: { mode: "cache-ttl", ttl: "5m" },
  },
}
```

限制僅修剪特定工具：

```json5
{
  agent: {
    contextPruning: {
      mode: "cache-ttl",
      tools: { allow: ["exec", "read"], deny: ["*image*"] },
    },
  },
}
```

請參閱設定參考：[Gateway Configuration](/gateway/configuration)

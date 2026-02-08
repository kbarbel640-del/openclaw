---
summary: 「內容視窗 + 壓縮：OpenClaw 如何讓工作階段維持在模型限制內」
read_when:
  - 「你想了解自動壓縮與 /compact」
  - 「你正在除錯因工作階段過長而觸及內容限制的情況」
title: 「壓縮」
x-i18n:
  source_path: concepts/compaction.md
  source_hash: e1d6791f2902044b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:50Z
---

# 內容視窗與壓縮

每個模型都有一個 **內容視窗**（它能看到的最大權杖數）。長時間運行的聊天會累積訊息與工具結果；當視窗變得吃緊時，OpenClaw 會 **壓縮** 較舊的歷史內容以維持在限制內。

## 什麼是壓縮

壓縮會將 **較舊的對話摘要化** 成一筆精簡的摘要項目，並保留最近的訊息不變。摘要會儲存在工作階段歷史中，因此後續請求會使用：

- 壓縮後的摘要
- 壓縮點之後的最近訊息

壓縮結果會 **持久化** 到工作階段的 JSONL 歷史中。

## 設定

請參閱 [Compaction config & modes](/concepts/compaction) 以了解 `agents.defaults.compaction` 的設定。

## 自動壓縮（預設啟用）

當工作階段接近或超過模型的內容視窗時，OpenClaw 會觸發自動壓縮，並可能在使用壓縮後的內容情境下重試原始請求。

你會看到：

- 在詳細模式中出現 `🧹 Auto-compaction complete`
- 顯示 `🧹 Compactions: <count>` 的 `/status`

在壓縮之前，OpenClaw 可以執行一次 **靜默記憶體清空** 的回合，將可持久化的備註寫入磁碟。設定與細節請見 [Memory](/concepts/memory)。

## 手動壓縮

使用 `/compact`（可選擇附加指示）來強制執行一次壓縮流程：

```
/compact Focus on decisions and open questions
```

## 內容視窗來源

內容視窗是模型特定的。OpenClaw 會使用已設定的提供者目錄中的模型定義來判定限制。

## 壓縮 vs 修剪

- **壓縮**：進行摘要並 **持久化** 至 JSONL。
- **工作階段修剪**：僅修剪較舊的 **工具結果**，屬於 **記憶體內**、逐請求處理。

修剪的詳細資訊請見 [/concepts/session-pruning](/concepts/session-pruning)。

## 小技巧

- 當工作階段感覺變得遲鈍或內容情境臃腫時，使用 `/compact`。
- 大型工具輸出已會被截斷；修剪可進一步降低工具結果的累積。
- 若需要全新的狀態，`/new` 或 `/reset` 會啟動新的工作階段 id。

---
summary: "訊息流程、工作階段、佇列，以及推理可見性"
read_when:
  - 說明入站訊息如何轉換為回覆
  - 釐清工作階段、佇列模式或串流行為
  - 記錄推理可見性與使用上的影響
title: "訊息"
x-i18n:
  source_path: concepts/messages.md
  source_hash: 32a1b0c50616c550
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:01Z
---

# 訊息

本頁整合說明 OpenClaw 如何處理入站訊息、工作階段、佇列、
串流，以及推理可見性。

## 訊息流程（高層）

```
Inbound message
  -> routing/bindings -> session key
  -> queue (if a run is active)
  -> agent run (streaming + tools)
  -> outbound replies (channel limits + chunking)
```

關鍵調整項目位於設定中：

- `messages.*`：前綴、佇列，以及群組行為。
- `agents.defaults.*`：區塊串流與分塊的預設值。
- 頻道覆寫（`channels.whatsapp.*`、`channels.telegram.*` 等）：上限與串流開關。

完整結構請參閱 [Configuration](/gateway/configuration)。

## 入站去重

頻道在重新連線後可能會重新投遞相同的訊息。OpenClaw 會維持一個
短期快取，鍵值包含頻道／帳號／對象／工作階段／訊息 ID，以確保重複投遞
不會再次觸發代理程式執行。

## 入站防彈跳（Debouncing）

來自**同一位傳送者**的快速連續訊息可透過 `messages.inbound` 合併為單一
代理程式回合。防彈跳以每個頻道 + 對話為範圍，並使用最新訊息來進行回覆串接／ID。

設定（全域預設 + 各頻道覆寫）：

```json5
{
  messages: {
    inbound: {
      debounceMs: 2000,
      byChannel: {
        whatsapp: 5000,
        slack: 1500,
        discord: 1500,
      },
    },
  },
}
```

注意事項：

- 防彈跳僅適用於**純文字**訊息；媒體／附件會立即送出。
- 控制指令會略過防彈跳，以保持其獨立性。

## 工作階段與裝置

工作階段由 Gateway 閘道器 擁有，而非由用戶端擁有。

- 私聊會合併到代理程式的主要工作階段鍵。
- 群組／頻道會各自取得獨立的工作階段鍵。
- 工作階段儲存與逐字稿位於 Gateway 閘道器 主機上。

多個裝置／頻道可以對應到同一個工作階段，但歷史不會完整回同步到每個用戶端。
建議：長時間對話請使用一個主要裝置，以避免情境分歧。Control UI 與 TUI
始終顯示由 Gateway 閘道器 支援的工作階段逐字稿，因此它們是事實來源。

詳情：[Session management](/concepts/session)。

## 入站本文與歷史情境

OpenClaw 將**提示本文**與**指令本文**分離：

- `Body`：送往代理程式的提示文字。可能包含頻道封裝與
  可選的歷史包裝。
- `CommandBody`：用於指令／命令解析的原始使用者文字。
- `RawBody`：`CommandBody` 的舊別名（為相容性保留）。

當頻道提供歷史時，會使用共用的包裝：

- `[Chat messages since your last reply - for context]`
- `[Current message - respond to this]`

對於**非私聊**（群組／頻道／房間），**目前訊息本文**會加上
傳送者標籤（樣式與歷史項目一致）。這可讓即時與佇列／歷史訊息在代理程式提示中保持一致。

歷史緩衝為**僅待處理**：它們包含未觸發執行的群組訊息（例如，需提及才觸發的訊息），並**排除**已存在於工作階段逐字稿中的訊息。

指令剝離僅套用於**目前訊息**區段，因此歷史會保持完整。包裝歷史的頻道
應將 `CommandBody`（或 `RawBody`）設為原始訊息文字，並保留
`Body` 作為合併後的提示。歷史緩衝可透過 `messages.groupChat.historyLimit`（全域
預設）以及各頻道覆寫（如 `channels.slack.historyLimit` 或
`channels.telegram.accounts.<id>.historyLimit`）進行設定（將 `0` 設為停用）。

## 佇列與後續回合

若已有執行中的回合，入站訊息可以被佇列、導入目前回合，或收集為後續回合。

- 透過 `messages.queue`（以及 `messages.queue.byChannel`）設定。
- 模式：`interrupt`、`steer`、`followup`、`collect`，以及包含積壓的變體。

詳情：[Queueing](/concepts/queue)。

## 串流、分塊與批次

區塊串流會在模型產生文字區塊時送出部分回覆。
分塊會遵守頻道文字上限，並避免切割圍欄程式碼。

關鍵設定：

- `agents.defaults.blockStreamingDefault`（`on|off`，預設關閉）
- `agents.defaults.blockStreamingBreak`（`text_end|message_end`）
- `agents.defaults.blockStreamingChunk`（`minChars|maxChars|breakPreference`）
- `agents.defaults.blockStreamingCoalesce`（以閒置為基礎的批次）
- `agents.defaults.humanDelay`（區塊回覆之間的擬人化停頓）
- 頻道覆寫：`*.blockStreaming` 與 `*.blockStreamingCoalesce`（非 Telegram 頻道需要明確設定 `*.blockStreaming: true`）

詳情：[Streaming + chunking](/concepts/streaming)。

## 推理可見性與權杖

OpenClaw 可公開或隱藏模型推理：

- `/reasoning on|off|stream` 控制可見性。
- 推理內容在模型產生時仍會計入權杖使用量。
- Telegram 支援將推理串流至草稿泡泡。

詳情：[Thinking + reasoning directives](/tools/thinking) 與 [Token use](/token-use)。

## 前綴、串接與回覆

出站訊息格式集中於 `messages`：

- `messages.responsePrefix`、`channels.<channel>.responsePrefix` 與 `channels.<channel>.accounts.<id>.responsePrefix`（出站前綴串階），以及 `channels.whatsapp.messagePrefix`（WhatsApp 入站前綴）
- 透過 `replyToMode` 與各頻道預設值進行回覆串接

詳情：[Configuration](/gateway/configuration#messages) 與各頻道文件。

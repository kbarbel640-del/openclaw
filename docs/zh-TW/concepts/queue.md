---
summary: "將入站自動回覆執行序列化的命令佇列設計"
read_when:
  - 變更自動回覆的執行方式或並行度時
title: "命令佇列"
x-i18n:
  source_path: concepts/queue.md
  source_hash: 2104c24d200fb4f9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:03Z
---

# 命令佇列 (2026-01-16)

我們透過一個小型的行程內佇列，將所有頻道的入站自動回覆執行序列化，以避免多個代理程式執行互相衝突，同時仍允許跨工作階段的安全並行。

## 為什麼

- 自動回覆的執行可能成本高昂（LLM 呼叫），且當多個入站訊息在短時間內到達時，可能會互相衝突。
- 序列化可避免爭用共享資源（工作階段檔案、日誌、CLI stdin），並降低觸發上游速率限制的風險。

## 運作方式

- 具備車道感知的 FIFO 佇列會依車道逐一清空，並有可設定的並行上限（未設定的車道預設為 1；main 預設為 4，subagent 為 8）。
- `runEmbeddedPiAgent` 依 **工作階段金鑰**（車道為 `session:<key>`）入佇列，以確保每個工作階段同時只有一個有效執行。
- 每個工作階段的執行接著會被佇列到 **全域車道**（預設為 `main`），因此整體並行度會受 `agents.defaults.maxConcurrent` 限制。
- 啟用詳細日誌時，若佇列中的執行在開始前等待超過約 2 秒，會輸出一則簡短提示。
- 打字指示器仍會在入佇列時立即觸發（若頻道支援），因此在輪到我們之前，使用者體驗不會改變。

## 佇列模式（每個頻道）

入站訊息可以引導目前的執行、等待下一個回合，或同時進行：

- `steer`：立即注入至目前的執行（在下一個工具邊界後取消待處理的工具呼叫）。若非串流，則回退為 followup。
- `followup`：在目前執行結束後，佇列至下一個代理程式回合。
- `collect`：將所有佇列中的訊息合併為 **單一** 的 followup 回合（預設）。若訊息目標為不同的頻道／執行緒，則會個別清空以保留路由。
- `steer-backlog`（亦稱 `steer+backlog`）：立即引導，**同時** 保留訊息作為 followup 回合。
- `interrupt`（舊版）：中止該工作階段的活動執行，然後執行最新的訊息。
- `queue`（舊版別名）：同 `steer`。

Steer-backlog 表示在被引導的執行之後，仍可能收到一個 followup 回覆，因此
在串流介面上看起來可能像是重複。若希望每個入站訊息只有一個回覆，請偏好使用 `collect`/`steer`。
可將 `/queue collect` 作為獨立指令（每個工作階段）傳送，或設定 `messages.queue.byChannel.discord: "collect"`。

預設值（設定中未指定時）：

- 所有介面 → `collect`

可透過 `messages.queue` 進行全域或每個頻道的設定：

```json5
{
  messages: {
    queue: {
      mode: "collect",
      debounceMs: 1000,
      cap: 20,
      drop: "summarize",
      byChannel: { discord: "collect" },
    },
  },
}
```

## 佇列選項

選項適用於 `followup`、`collect` 與 `steer-backlog`（以及在回退為 followup 時的 `steer`）：

- `debounceMs`：在開始 followup 回合前等待安靜期（防止「continue, continue」）。
- `cap`：每個工作階段允許佇列的最大訊息數。
- `drop`：溢位策略（`old`、`new`、`summarize`）。

Summarize 會保留一份被丟棄訊息的簡短項目清單，並將其作為合成的 followup 提示注入。
預設值：`debounceMs: 1000`、`cap: 20`、`drop: summarize`。

## 每個工作階段的覆寫

- 將 `/queue <mode>` 作為獨立指令傳送，以儲存目前工作階段的模式。
- 選項可以組合使用：`/queue collect debounce:2s cap:25 drop:summarize`
- `/queue default` 或 `/queue reset` 會清除工作階段的覆寫設定。

## 範圍與保證

- 適用於所有使用 Gateway 回覆管線的入站頻道之自動回覆代理程式執行（WhatsApp web、Telegram、Slack、Discord、Signal、iMessage、webchat 等）。
- 預設車道（`main`）為行程層級，涵蓋入站與 main 心跳；設定 `agents.defaults.maxConcurrent` 以允許多個工作階段並行。
- 可能存在其他車道（例如 `cron`、`subagent`），讓背景工作能並行執行而不阻塞入站回覆。
- 每個工作階段的車道可保證同一時間只有一個代理程式執行會接觸到該工作階段。
- 無外部相依性或背景工作執行緒；純 TypeScript + promises。

## 疑難排解

- 若指令看似卡住，請啟用詳細日誌，並尋找「queued for …ms」的行，以確認佇列正在清空。
- 若需要查看佇列深度，請啟用詳細日誌並觀察佇列計時相關的行。

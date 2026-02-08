---
summary: "用於 /think + /verbose 的指令語法，以及它們如何影響模型推理"
read_when:
  - 調整 thinking 或 verbose 指令的解析或預設值時
title: "Thinking 等級"
x-i18n:
  source_path: tools/thinking.md
  source_hash: 0ae614147675be32
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:04Z
---

# Thinking 等級（/think 指令）

## 功能說明

- 可在任何入站訊息本文中使用的行內指令：`/t <level>`、`/think:<level>` 或 `/thinking <level>`。
- 等級（別名）：`off | minimal | low | medium | high | xhigh`（僅 GPT-5.2 + Codex 模型）
  - minimal → 「think」
  - low → 「think hard」
  - medium → 「think harder」
  - high → 「ultrathink」（最大預算）
  - xhigh → 「ultrathink+」（僅 GPT-5.2 + Codex 模型）
  - `x-high`、`x_high`、`extra-high`、`extra high` 以及 `extra_high` 會對應到 `xhigh`。
  - `highest`、`max` 會對應到 `high`。
- 提供者注意事項：
  - Z.AI（`zai/*`）僅支援二元 thinking（`on`/`off`）。任何非 `off` 的等級都會被視為 `on`（對應到 `low`）。

## 解析順序

1. 訊息上的行內指令（僅套用於該訊息）。
2. 工作階段覆寫（透過傳送僅含指令的訊息設定）。
3. 全域預設值（設定中的 `agents.defaults.thinkingDefault`）。
4. 後備：對於具推理能力的模型為 low；否則為 off。

## 設定工作階段預設值

- 傳送一則**只包含**指令的訊息（可含空白），例如 `/think:medium` 或 `/t high`。
- 該設定會套用於目前的工作階段（預設為每位傳送者）；可由 `/think:off` 或工作階段閒置重置清除。
- 會送出確認回覆（`Thinking level set to high.` / `Thinking disabled.`）。若等級無效（例如 `/thinking big`），指令會被拒絕並附提示，且工作階段狀態保持不變。
- 傳送 `/think`（或 `/think:`）且不帶參數，可查看目前的 thinking 等級。

## 由代理程式套用

- **嵌入式 Pi**：解析後的等級會傳遞給行程內的 Pi 代理程式執行環境。

## Verbose 指令（/verbose 或 /v）

- 等級：`on`（minimal） | `full` | `off`（預設）。
- 僅指令的訊息會切換工作階段的 verbose，並回覆 `Verbose logging enabled.` / `Verbose logging disabled.`；無效等級會回傳提示且不改變狀態。
- `/verbose off` 會儲存明確的工作階段覆寫；可在 Sessions UI 中選擇 `inherit` 以清除。
- 行內指令只影響該訊息；否則套用工作階段／全域預設值。
- 傳送 `/verbose`（或 `/verbose:`）且不帶參數，可查看目前的 verbose 等級。
- 當 verbose 開啟時，會輸出結構化工具結果的代理程式（Pi、其他 JSON 代理程式）會將每一次工具呼叫以各自的僅中繼資料訊息回傳，若可用則加上 `<emoji> <tool-name>: <arg>` 前綴（路徑／命令）。這些工具摘要會在每個工具啟動時立即送出（獨立氣泡），而非以串流增量方式。
- 當 verbose 為 `full` 時，工具完成後也會轉送輸出（獨立氣泡，截斷至安全長度）。若在執行進行中切換 `/verbose on|full|off`，後續的工具氣泡會遵循新的設定。

## 推理可見性（/reasoning）

- 等級：`on|off|stream`。
- 僅指令的訊息會切換是否在回覆中顯示 thinking 區塊。
- 啟用時，推理會以**獨立訊息**傳送，並加上 `Reasoning:` 前綴。
- `stream`（僅 Telegram）：在回覆生成期間，將推理串流到 Telegram 的草稿氣泡中，之後送出不含推理的最終答案。
- 別名：`/reason`。
- 傳送 `/reasoning`（或 `/reasoning:`）且不帶參數，可查看目前的推理等級。

## 相關

- Elevated mode 文件位於 [Elevated mode](/tools/elevated)。

## Heartbeats

- Heartbeat 探測本文是已設定的 heartbeat 提示（預設：`Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`）。Heartbeat 訊息中的行內指令會照常套用（但請避免透過 heartbeats 變更工作階段預設值）。
- Heartbeat 傳送預設僅包含最終負載。若要同時送出獨立的 `Reasoning:` 訊息（若可用），請設定 `agents.defaults.heartbeat.includeReasoning: true` 或每個代理程式的 `agents.list[].heartbeat.includeReasoning: true`。

## Web 聊天 UI

- Web 聊天的 thinking 選擇器在頁面載入時，會反映來自入站工作階段儲存／設定中的工作階段已儲存等級。
- 選擇其他等級只會套用到下一則訊息（`thinkingOnce`）；送出後，選擇器會回復到已儲存的工作階段等級。
- 若要變更工作階段預設值，請傳送一個 `/think:<level>` 指令（同前述）；下次重新載入後，選擇器會反映該設定。

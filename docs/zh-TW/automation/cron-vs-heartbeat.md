---
summary: 「選擇 heartbeat 與 cron 工作以進行自動化的指引」
read_when:
  - 決定如何排程重複性任務
  - 設定背景監控或通知
  - 最佳化週期性檢查的 token 使用量
title: 「Cron vs Heartbeat」
x-i18n:
  source_path: automation/cron-vs-heartbeat.md
  source_hash: fca1006df9d2e842
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:37Z
---

# Cron vs Heartbeat：何時該使用哪一種

Heartbeat 與 cron 工作都能讓你依照排程執行任務。本指南協助你為使用情境選擇正確的機制。

## 快速決策指南

| 使用情境                       | 建議使用                   | 原因                               |
| ------------------------------ | -------------------------- | ---------------------------------- |
| 每 30 分鐘檢查收件匣           | Heartbeat                  | 可與其他檢查批次處理，具備情境感知 |
| 每天準時早上 9 點寄送報告      | Cron（隔離）               | 需要精準時機                       |
| 監控行事曆是否有即將到來的活動 | Heartbeat                  | 適合週期性覺察                     |
| 每週執行一次深度分析           | Cron（隔離）               | 獨立任務，可使用不同模型           |
| 20 分鐘後提醒我                | Cron（主工作階段，`--at`） | 一次性且需要精準時機               |
| 背景專案健康檢查               | Heartbeat                  | 搭便車利用既有循環                 |

## Heartbeat：週期性覺察

Heartbeat 會在**主工作階段**中以固定間隔執行（預設：30 分鐘）。它們的設計目的是讓代理程式檢查狀態，並呈現任何重要事項。

### 何時使用 heartbeat

- **多個週期性檢查**：與其設定 5 個獨立的 cron 工作檢查收件匣、行事曆、天氣、通知與專案狀態，不如用單一 heartbeat 批次處理。
- **具情境感知的決策**：代理程式擁有完整的主工作階段情境，因此能聰明判斷哪些事情緊急、哪些可以稍後處理。
- **對話連續性**：Heartbeat 執行共用同一個工作階段，代理程式會記住近期對話並自然地跟進。
- **低負擔監控**：一個 heartbeat 取代多個小型輪詢任務。

### Heartbeat 的優點

- **批次處理多項檢查**：一次代理程式回合即可同時檢視收件匣、行事曆與通知。
- **降低 API 呼叫次數**：單一 heartbeat 比 5 個獨立的 cron 工作更省成本。
- **情境感知**：代理程式知道你最近在做什麼，能依此排序優先順序。
- **智慧抑制**：若沒有需要注意的事項，代理程式會回覆 `HEARTBEAT_OK`，且不會傳送任何訊息。
- **自然的時間漂移**：會依佇列負載略有漂移，對多數監控情境而言可接受。

### Heartbeat 範例：HEARTBEAT.md 檢查清單

```md
# Heartbeat checklist

- Check email for urgent messages
- Review calendar for events in next 2 hours
- If a background task finished, summarize results
- If idle for 8+ hours, send a brief check-in
```

代理程式會在每次 heartbeat 時讀取此檔案，並在一次回合中處理所有項目。

### 設定 heartbeat

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m", // interval
        target: "last", // where to deliver alerts
        activeHours: { start: "08:00", end: "22:00" }, // optional
      },
    },
  },
}
```

完整設定請參閱 [Heartbeat](/gateway/heartbeat)。

## Cron：精準排程

Cron 工作會在**精確時間**執行，且可在隔離的工作階段中執行，不影響主情境。

### 何時使用 cron

- **需要精準時機**：「每週一早上 9:00 準時傳送」（而不是「大約 9 點左右」）。
- **獨立任務**：不需要對話情境的任務。
- **不同模型／思考方式**：需要更強模型的重度分析。
- **一次性提醒**：使用 `--at` 的「20 分鐘後提醒我」。
- **吵雜／高頻任務**：可能會讓主工作階段歷史變得雜亂的任務。
- **外部觸發**：應該獨立於代理程式是否活躍而執行的任務。

### Cron 的優點

- **精準時機**：支援含時區的 5 欄位 cron 表達式。
- **工作階段隔離**：在 `cron:<jobId>` 中執行，不污染主歷史。
- **模型覆寫**：每個工作可選用較便宜或更強大的模型。
- **傳遞控制**：隔離工作預設為 `announce`（摘要）；需要時可選擇 `none`。
- **即時傳遞**：公告模式會直接發佈，無需等待 heartbeat。
- **不需要代理程式情境**：即使主工作階段閒置或被壓縮也能執行。
- **一次性支援**：使用 `--at` 指定精準的未來時間戳。

### Cron 範例：每日早晨簡報

```bash
openclaw cron add \
  --name "Morning briefing" \
  --cron "0 7 * * *" \
  --tz "America/New_York" \
  --session isolated \
  --message "Generate today's briefing: weather, calendar, top emails, news summary." \
  --model opus \
  --announce \
  --channel whatsapp \
  --to "+15551234567"
```

此工作會在紐約時間早上 7:00 準時執行，使用 Opus 以確保品質，並將摘要直接公告到 WhatsApp。

### Cron 範例：一次性提醒

```bash
openclaw cron add \
  --name "Meeting reminder" \
  --at "20m" \
  --session main \
  --system-event "Reminder: standup meeting starts in 10 minutes." \
  --wake now \
  --delete-after-run
```

完整 CLI 參考請參閱 [Cron jobs](/automation/cron-jobs)。

## 決策流程圖

```
Does the task need to run at an EXACT time?
  YES -> Use cron
  NO  -> Continue...

Does the task need isolation from main session?
  YES -> Use cron (isolated)
  NO  -> Continue...

Can this task be batched with other periodic checks?
  YES -> Use heartbeat (add to HEARTBEAT.md)
  NO  -> Use cron

Is this a one-shot reminder?
  YES -> Use cron with --at
  NO  -> Continue...

Does it need a different model or thinking level?
  YES -> Use cron (isolated) with --model/--thinking
  NO  -> Use heartbeat
```

## 同時結合兩者

最有效率的設定是**同時使用**：

1. **Heartbeat**：每 30 分鐘以一次批次回合處理例行監控（收件匣、行事曆、通知）。
2. **Cron**：處理精準排程（每日報告、每週檢視）與一次性提醒。

### 範例：高效率的自動化設定

**HEARTBEAT.md**（每 30 分鐘檢查一次）：

```md
# Heartbeat checklist

- Scan inbox for urgent emails
- Check calendar for events in next 2h
- Review any pending tasks
- Light check-in if quiet for 8+ hours
```

**Cron 工作**（精準時機）：

```bash
# Daily morning briefing at 7am
openclaw cron add --name "Morning brief" --cron "0 7 * * *" --session isolated --message "..." --announce

# Weekly project review on Mondays at 9am
openclaw cron add --name "Weekly review" --cron "0 9 * * 1" --session isolated --message "..." --model opus

# One-shot reminder
openclaw cron add --name "Call back" --at "2h" --session main --system-event "Call back the client" --wake now
```

## Lobster：具審批的決定性工作流程

Lobster 是用於**多步驟工具管線**的工作流程執行環境，適合需要決定性執行與明確審批的情境。
當任務不只是一個代理程式回合，且你希望有可續跑、包含人工檢查點的工作流程時，請使用它。

### 何時適合使用 Lobster

- **多步驟自動化**：你需要固定的工具呼叫管線，而非一次性提示。
- **審批關卡**：有副作用的動作應在你核准後暫停並再繼續。
- **可續跑的執行**：無需重跑先前步驟即可繼續已暫停的流程。

### 與 heartbeat 與 cron 的搭配方式

- **Heartbeat／cron** 決定「何時」執行。
- **Lobster** 定義執行開始後「要做哪些步驟」。

對於排程式工作流程，使用 cron 或 heartbeat 觸發一個代理程式回合，該回合再呼叫 Lobster。
對於臨時工作流程，直接呼叫 Lobster。

### 營運備註（來自程式碼）

- Lobster 以**本機子行程**（`lobster` CLI）在工具模式中執行，並回傳 **JSON 封裝**。
- 若工具回傳 `needs_approval`，請使用 `resumeToken` 與 `approve` 旗標繼續。
- 此工具是**可選外掛**；建議透過 `tools.alsoAllow: ["lobster"]` 以附加方式啟用。
- 若你傳入 `lobsterPath`，它必須是**絕對路徑**。

完整用法與範例請參閱 [Lobster](/tools/lobster)。

## 主工作階段 vs 隔離工作階段

Heartbeat 與 cron 都能與主工作階段互動，但方式不同：

|          | Heartbeat                    | Cron（主）            | Cron（隔離）     |
| -------- | ---------------------------- | --------------------- | ---------------- |
| 工作階段 | 主                           | 主（透過系統事件）    | `cron:<jobId>`   |
| 歷史記錄 | 共用                         | 共用                  | 每次皆為全新     |
| 情境     | 完整                         | 完整                  | 無（乾淨開始）   |
| 模型     | 主工作階段模型               | 主工作階段模型        | 可覆寫           |
| 輸出     | 若非 `HEARTBEAT_OK` 則會傳遞 | Heartbeat 提示 + 事件 | 公告摘要（預設） |

### 何時使用主工作階段 cron

當你希望以下行為時，使用 `--session main` 搭配 `--system-event`：

- 提醒／事件出現在主工作階段情境中
- 代理程式在下一次 heartbeat 以完整情境處理
- 不需要獨立的隔離執行

```bash
openclaw cron add \
  --name "Check project" \
  --every "4h" \
  --session main \
  --system-event "Time for a project health check" \
  --wake now
```

### 何時使用隔離 cron

當你希望以下行為時，使用 `--session isolated`：

- 不受先前情境影響的乾淨起點
- 不同的模型或思考設定
- 直接將摘要公告到頻道
- 不會讓主工作階段歷史變得雜亂

```bash
openclaw cron add \
  --name "Deep analysis" \
  --cron "0 6 * * 0" \
  --session isolated \
  --message "Weekly codebase analysis..." \
  --model opus \
  --thinking high \
  --announce
```

## 成本考量

| 機制         | 成本特性                                         |
| ------------ | ------------------------------------------------ |
| Heartbeat    | 每 N 分鐘一次回合；隨 HEARTBEAT.md 大小擴增      |
| Cron（主）   | 將事件加入下一次 heartbeat（無隔離回合）         |
| Cron（隔離） | 每個工作一次完整代理程式回合；可使用較便宜的模型 |

**建議**：

- 保持 `HEARTBEAT.md` 精簡，以降低 token 負擔。
- 將相似檢查批次放入 heartbeat，而非建立多個 cron 工作。
- 若只需要內部處理，請在 heartbeat 上使用 `target: "none"`。
- 例行任務可使用較便宜模型的隔離 cron。

## 相關

- [Heartbeat](/gateway/heartbeat) - 完整 heartbeat 設定
- [Cron jobs](/automation/cron-jobs) - 完整 cron CLI 與 API 參考
- [System](/cli/system) - 系統事件 + heartbeat 控制

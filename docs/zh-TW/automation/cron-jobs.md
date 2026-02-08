---
summary: "Gateway 排程器的 Cron 工作 + 喚醒"
read_when:
  - 排程背景工作或喚醒
  - 連接應與心跳一起或並行執行的自動化
  - 在排程任務中決定使用心跳或 Cron
title: "Cron 工作"
x-i18n:
  source_path: automation/cron-jobs.md
  source_hash: 523721a7da2c4e27
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:46Z
---

# Cron 工作（Gateway 排程器）

> **Cron vs Heartbeat？** 何時使用各自的指引，請參閱 [Cron vs Heartbeat](/automation/cron-vs-heartbeat)。

Cron 是 Gateway 內建的排程器。它會持久化工作、在正確的時間喚醒代理程式，並可選擇將輸出回傳到聊天。

如果你想要「每天早上執行一次」或「20 分鐘後戳一下代理程式」，Cron 就是這個機制。

## TL;DR

- Cron 在 **Gateway 內** 執行（不在模型內）。
- 工作會在 `~/.openclaw/cron/` 下持久化，因此重新啟動不會遺失排程。
- 兩種執行樣式：
  - **主工作階段**：排入系統事件，然後在下一次心跳時執行。
  - **隔離**：在 `cron:<jobId>` 中執行專用的代理程式回合，並可設定傳遞（預設公告或無）。
- 喚醒是一等公民：工作可以要求「立即喚醒」或「下一次心跳」。

## 快速開始（可執行）

建立一次性提醒、驗證其存在，並立即執行：

```bash
openclaw cron add \
  --name "Reminder" \
  --at "2026-02-01T16:00:00Z" \
  --session main \
  --system-event "Reminder: check the cron docs draft" \
  --wake now \
  --delete-after-run

openclaw cron list
openclaw cron run <job-id> --force
openclaw cron runs --id <job-id>
```

排程一個具傳遞的週期性隔離工作：

```bash
openclaw cron add \
  --name "Morning brief" \
  --cron "0 7 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Summarize overnight updates." \
  --announce \
  --channel slack \
  --to "channel:C1234567890"
```

## 工具呼叫等價（Gateway cron 工具）

關於標準的 JSON 形狀與範例，請參閱 [工具呼叫的 JSON 結構](/automation/cron-jobs#json-schema-for-tool-calls)。

## Cron 工作的儲存位置

Cron 工作預設會持久化在 Gateway 主機的 `~/.openclaw/cron/jobs.json`。
Gateway 會將檔案載入記憶體，並在變更時寫回，因此只有在 Gateway 停止時才適合手動編輯。
建議使用 `openclaw cron add/edit` 或 cron 工具呼叫 API 進行變更。

## 新手友善總覽

將 cron 工作想成：**何時** 執行 + **要做什麼**。

1. **選擇排程**
   - 一次性提醒 → `schedule.kind = "at"`（CLI：`--at`）
   - 週期性工作 → `schedule.kind = "every"` 或 `schedule.kind = "cron"`
   - 若你的 ISO 時間戳未包含時區，將視為 **UTC**。

2. **選擇執行位置**
   - `sessionTarget: "main"` → 在下一次心跳時以主脈絡執行。
   - `sessionTarget: "isolated"` → 在 `cron:<jobId>` 中執行專用的代理程式回合。

3. **選擇負載**
   - 主工作階段 → `payload.kind = "systemEvent"`
   - 隔離工作階段 → `payload.kind = "agentTurn"`

選用：一次性工作（`schedule.kind = "at"`）預設在成功後刪除。設定
`deleteAfterRun: false` 以保留它們（成功後會停用）。

## 概念

### 工作

一個 cron 工作是包含下列項目的儲存記錄：

- **排程**（何時執行），
- **負載**（要做什麼），
- 可選的 **傳遞模式**（公告或無）。
- 可選的 **代理程式綁定**（`agentId`）：在特定代理程式下執行；若缺失或未知，Gateway 會回退到預設代理程式。

工作以穩定的 `jobId` 識別（供 CLI/Gateway API 使用）。
在代理程式工具呼叫中，`jobId` 是標準；為相容性仍接受舊的 `id`。
一次性工作預設在成功後自動刪除；設定 `deleteAfterRun: false` 以保留。

### 排程

Cron 支援三種排程類型：

- `at`：透過 `schedule.at`（ISO 8601）的一次性時間戳。
- `every`：固定間隔（毫秒）。
- `cron`：5 欄位的 cron 表達式，支援選用 IANA 時區。

Cron 表達式使用 `croner`。若省略時區，將使用 Gateway 主機的
本地時區。

### 主工作階段 vs 隔離執行

#### 主工作階段工作（系統事件）

主工作會排入系統事件，並可選擇喚醒心跳執行器。
它們必須使用 `payload.kind = "systemEvent"`。

- `wakeMode: "next-heartbeat"`（預設）：事件等待下一次排定的心跳。
- `wakeMode: "now"`：事件觸發立即的心跳執行。

當你想要使用一般的心跳提示 + 主工作階段脈絡時，這是最佳選擇。
請參閱 [Heartbeat](/gateway/heartbeat)。

#### 隔離工作（專用 cron 工作階段）

隔離工作會在工作階段 `cron:<jobId>` 中執行專用的代理程式回合。

關鍵行為：

- 提示會加上 `[cron:<jobId> <job name>]` 前綴以利追蹤。
- 每次執行都會啟動 **全新的工作階段 id**（不保留先前對話）。
- 預設行為：若省略 `delivery`，隔離工作會公告摘要（`delivery.mode = "announce"`）。
- `delivery.mode`（僅限隔離）決定行為：
  - `announce`：將摘要傳遞到目標頻道，並在主工作階段張貼簡短摘要。
  - `none`：僅內部（不傳遞、不產生主工作階段摘要）。
- `wakeMode` 控制主工作階段摘要張貼時機：
  - `now`：立即心跳。
  - `next-heartbeat`：等待下一次排定的心跳。

對於嘈雜、頻繁或「背景雜務」，使用隔離工作可避免刷屏主聊天紀錄。

### 負載形狀（執行內容）

支援兩種負載類型：

- `systemEvent`：僅主工作階段，經由心跳提示路由。
- `agentTurn`：僅隔離工作階段，執行專用代理程式回合。

常見的 `agentTurn` 欄位：

- `message`：必要的文字提示。
- `model` / `thinking`：可選覆寫（見下文）。
- `timeoutSeconds`：可選的逾時覆寫。

傳遞設定（僅隔離工作）：

- `delivery.mode`：`none` | `announce`。
- `delivery.channel`：`last` 或特定頻道。
- `delivery.to`：頻道特定的目標（電話/聊天/頻道 id）。
- `delivery.bestEffort`：避免在公告傳遞失敗時使工作失敗。

公告傳遞會抑制本次執行的訊息工具傳送；請使用 `delivery.channel`/`delivery.to`
以改為傳遞到聊天。當 `delivery.mode = "none"` 時，不會在主工作階段張貼摘要。

若隔離工作省略 `delivery`，OpenClaw 會預設為 `announce`。

#### 公告傳遞流程

當 `delivery.mode = "announce"` 時，cron 會透過外送頻道配接器直接傳遞。
主代理程式不會被啟動來撰寫或轉送訊息。

行為細節：

- 內容：傳遞使用隔離執行的外送負載（文字/媒體），並套用一般的分段與
  頻道格式。
- 僅心跳回應（`HEARTBEAT_OK` 且沒有實際內容）不會被傳遞。
- 若隔離執行已透過訊息工具向相同目標送出訊息，為避免重複，將略過傳遞。
- 缺失或無效的傳遞目標會使工作失敗，除非設定 `delivery.bestEffort = true`。
- 僅在 `delivery.mode = "announce"` 時，才會在主工作階段張貼簡短摘要。
- 主工作階段摘要會遵循 `wakeMode`：`now` 會觸發立即心跳，而
  `next-heartbeat` 會等待下一次排定的心跳。

### 模型與思考層級覆寫

隔離工作（`agentTurn`）可覆寫模型與思考層級：

- `model`：提供者/模型字串（例如 `anthropic/claude-sonnet-4-20250514`）或別名（例如 `opus`）
- `thinking`：思考層級（`off`、`minimal`、`low`、`medium`、`high`、`xhigh`；僅限 GPT-5.2 + Codex 模型）

注意：你也可以在主工作階段工作上設定 `model`，但這會改變共享的主
工作階段模型。我們建議僅對隔離工作使用模型覆寫，以避免
非預期的脈絡變化。

解析優先順序：

1. 工作負載覆寫（最高）
2. Hook 特定預設（例如 `hooks.gmail.model`）
3. 代理程式設定預設

### 傳遞（頻道 + 目標）

隔離工作可透過頂層的 `delivery` 設定將輸出傳遞到頻道：

- `delivery.mode`：`announce`（傳遞摘要）或 `none`。
- `delivery.channel`：`whatsapp` / `telegram` / `discord` / `slack` / `mattermost`（外掛） / `signal` / `imessage` / `last`。
- `delivery.to`：頻道特定的收件者目標。

傳遞設定僅適用於隔離工作（`sessionTarget: "isolated"`）。

若省略 `delivery.channel` 或 `delivery.to`，cron 可回退到主工作階段的
「最後路由」（代理程式最後回覆的位置）。

目標格式提醒：

- Slack/Discord/Mattermost（外掛）目標應使用明確的前綴（例如 `channel:<id>`、`user:<id>`）以避免歧義。
- Telegram 主題應使用 `:topic:` 形式（見下文）。

#### Telegram 傳遞目標（主題 / 討論串）

Telegram 透過 `message_thread_id` 支援論壇主題。對於 cron 傳遞，你可以將
主題/討論串編碼到 `to` 欄位：

- `-1001234567890`（僅 chat id）
- `-1001234567890:topic:123`（建議：明確的主題標記）
- `-1001234567890:123`（簡寫：數字後綴）

也接受像 `telegram:...` / `telegram:group:...` 這樣的前綴目標：

- `telegram:group:-1001234567890:topic:123`

## 工具呼叫的 JSON 結構

在直接呼叫 Gateway `cron.*` 工具（代理程式工具呼叫或 RPC）時使用這些形狀。
CLI 旗標接受像 `20m` 這樣的人類可讀時間，但工具呼叫應使用 ISO 8601 字串
作為 `schedule.at`，並以毫秒指定 `schedule.everyMs`。

### cron.add 參數

一次性、主工作階段工作（系統事件）：

```json
{
  "name": "Reminder",
  "schedule": { "kind": "at", "at": "2026-02-01T16:00:00Z" },
  "sessionTarget": "main",
  "wakeMode": "now",
  "payload": { "kind": "systemEvent", "text": "Reminder text" },
  "deleteAfterRun": true
}
```

週期性、具傳遞的隔離工作：

```json
{
  "name": "Morning brief",
  "schedule": { "kind": "cron", "expr": "0 7 * * *", "tz": "America/Los_Angeles" },
  "sessionTarget": "isolated",
  "wakeMode": "next-heartbeat",
  "payload": {
    "kind": "agentTurn",
    "message": "Summarize overnight updates."
  },
  "delivery": {
    "mode": "announce",
    "channel": "slack",
    "to": "channel:C1234567890",
    "bestEffort": true
  }
}
```

注意事項：

- `schedule.kind`：`at`（`at`）、`every`（`everyMs`），或 `cron`（`expr`，選用 `tz`）。
- `schedule.at` 接受 ISO 8601（時區選用；省略時視為 UTC）。
- `everyMs` 為毫秒。
- `sessionTarget` 必須是 `"main"` 或 `"isolated"`，且必須符合 `payload.kind`。
- 選用欄位：`agentId`、`description`、`enabled`、`deleteAfterRun`（對 `at` 預設為 true），
  `delivery`。
- 省略時，`wakeMode` 預設為 `"next-heartbeat"`。

### cron.update 參數

```json
{
  "jobId": "job-123",
  "patch": {
    "enabled": false,
    "schedule": { "kind": "every", "everyMs": 3600000 }
  }
}
```

注意事項：

- `jobId` 為標準；為相容性仍接受 `id`。
- 在 patch 中使用 `agentId: null` 以清除代理程式綁定。

### cron.run 與 cron.remove 參數

```json
{ "jobId": "job-123", "mode": "force" }
```

```json
{ "jobId": "job-123" }
```

## 儲存與歷史

- 工作儲存：`~/.openclaw/cron/jobs.json`（Gateway 管理的 JSON）。
- 執行歷史：`~/.openclaw/cron/runs/<jobId>.jsonl`（JSONL，自動修剪）。
- 覆寫儲存路徑：設定中的 `cron.store`。

## 設定

```json5
{
  cron: {
    enabled: true, // default true
    store: "~/.openclaw/cron/jobs.json",
    maxConcurrentRuns: 1, // default 1
  },
}
```

完全停用 cron：

- `cron.enabled: false`（設定）
- `OPENCLAW_SKIP_CRON=1`（環境變數）

## CLI 快速開始

一次性提醒（UTC ISO，成功後自動刪除）：

```bash
openclaw cron add \
  --name "Send reminder" \
  --at "2026-01-12T18:00:00Z" \
  --session main \
  --system-event "Reminder: submit expense report." \
  --wake now \
  --delete-after-run
```

一次性提醒（主工作階段，立即喚醒）：

```bash
openclaw cron add \
  --name "Calendar check" \
  --at "20m" \
  --session main \
  --system-event "Next heartbeat: check calendar." \
  --wake now
```

週期性隔離工作（公告到 WhatsApp）：

```bash
openclaw cron add \
  --name "Morning status" \
  --cron "0 7 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Summarize inbox + calendar for today." \
  --announce \
  --channel whatsapp \
  --to "+15551234567"
```

週期性隔離工作（傳遞到 Telegram 主題）：

```bash
openclaw cron add \
  --name "Nightly summary (topic)" \
  --cron "0 22 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Summarize today; send to the nightly topic." \
  --announce \
  --channel telegram \
  --to "-1001234567890:topic:123"
```

具模型與思考覆寫的隔離工作：

```bash
openclaw cron add \
  --name "Deep analysis" \
  --cron "0 6 * * 1" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Weekly deep analysis of project progress." \
  --model "opus" \
  --thinking high \
  --announce \
  --channel whatsapp \
  --to "+15551234567"
```

代理程式選擇（多代理程式設定）：

```bash
# Pin a job to agent "ops" (falls back to default if that agent is missing)
openclaw cron add --name "Ops sweep" --cron "0 6 * * *" --session isolated --message "Check ops queue" --agent ops

# Switch or clear the agent on an existing job
openclaw cron edit <jobId> --agent ops
openclaw cron edit <jobId> --clear-agent
```

手動執行（除錯）：

```bash
openclaw cron run <jobId> --force
```

編輯既有工作（修補欄位）：

```bash
openclaw cron edit <jobId> \
  --message "Updated prompt" \
  --model "opus" \
  --thinking low
```

執行歷史：

```bash
openclaw cron runs --id <jobId> --limit 50
```

不建立工作即可觸發的即時系統事件：

```bash
openclaw system event --mode now --text "Next heartbeat: check battery."
```

## Gateway API 介面

- `cron.list`、`cron.status`、`cron.add`、`cron.update`、`cron.remove`
- `cron.run`（強制或到期）、`cron.runs`
  若需要不建立工作的即時系統事件，請使用 [`openclaw system event`](/cli/system)。

## 疑難排解

### 「沒有任何東西執行」

- 確認 cron 已啟用：`cron.enabled` 與 `OPENCLAW_SKIP_CRON`。
- 確認 Gateway 持續運行（cron 在 Gateway 行程內執行）。
- 對於 `cron` 排程：確認時區（`--tz`）與主機時區是否一致。

### Telegram 傳遞到錯誤的位置

- 對於論壇主題，請使用 `-100…:topic:<id>` 以確保明確且不含歧義。
- 若你在記錄或儲存的「最後路由」目標中看到 `telegram:...` 前綴，這是正常的；
  cron 傳遞接受它們，且仍會正確解析主題 ID。

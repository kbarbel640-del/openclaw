---
summary: 「心跳輪詢訊息與通知規則」
read_when:
  - 調整心跳頻率或訊息內容時
  - 決定排程任務要使用心跳還是 Cron 時
title: 「Heartbeat」
x-i18n:
  source_path: gateway/heartbeat.md
  source_hash: 27db9803263a5f2d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:48Z
---

# Heartbeat（Gateway 閘道器）

> **Heartbeat 與 Cron？** 何時使用各自方式，請參閱 [Cron vs Heartbeat](/automation/cron-vs-heartbeat)。

Heartbeat 會在主要工作階段中執行**週期性的代理程式回合**，讓模型能在不造成垃圾訊息的情況下，主動提出任何需要注意的事項。

## 快速開始（初學者）

1. 保持心跳啟用（預設為 `30m`，若使用 Anthropic OAuth/setup-token 則為 `1h`），或設定你自己的頻率。
2. 在代理程式工作區建立一個精簡的 `HEARTBEAT.md` 檢查清單（非必要但建議）。
3. 決定心跳訊息的傳送位置（預設為 `target: "last"`）。
4. 選用：啟用心跳推理內容的傳送以提升透明度。
5. 選用：將心跳限制在活動時段（本地時間）。

設定範例：

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        target: "last",
        // activeHours: { start: "08:00", end: "24:00" },
        // includeReasoning: true, // optional: send separate `Reasoning:` message too
      },
    },
  },
}
```

## 預設值

- 間隔：`30m`（若偵測到 Anthropic OAuth/setup-token 驗證模式，則為 `1h`）。設定 `agents.defaults.heartbeat.every` 或每個代理程式的 `agents.list[].heartbeat.every`；使用 `0m` 可停用。
- 提示本文（可透過 `agents.defaults.heartbeat.prompt` 設定）：
  `Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`
- 心跳提示會**逐字**以使用者訊息傳送。系統提示包含「Heartbeat」區段，且此執行會在內部被標記。
- 活動時段（`heartbeat.activeHours`）會以設定的時區檢查。
  在時段外，心跳會被略過，直到下一次落在時段內的觸發。

## 心跳提示的用途

預設提示刻意設計得相當寬鬆：

- **背景任務**：「Consider outstanding tasks」會引導代理程式檢視
  待辦事項（收件匣、行事曆、提醒、佇列中的工作），並提出任何緊急事項。
- **人類關懷檢查**：「Checkup sometimes on your human during day time」會引導
  偶爾發送輕量的「需要我幫忙嗎？」訊息，同時透過你設定的本地時區避免夜間打擾（見 [/concepts/timezone](/concepts/timezone)）。

如果你希望心跳執行非常具體的任務（例如「check Gmail PubSub stats」或「verify gateway health」），請將 `agents.defaults.heartbeat.prompt`（或 `agents.list[].heartbeat.prompt`）設定為自訂本文（逐字傳送）。

## 回應契約

- 若沒有需要注意的事項，請回覆 **`HEARTBEAT_OK`**。
- 在心跳執行期間，OpenClaw 會在回覆的**開頭或結尾**出現 `HEARTBEAT_OK` 時，將其視為確認（ack）。該標記會被移除，且若剩餘內容 **≤ `ackMaxChars`**（預設：300），回覆會被丟棄。
- 若 `HEARTBEAT_OK` 出現在回覆的**中間**，則不具任何特殊意義。
- 若為警示內容，**不要**包含 `HEARTBEAT_OK`；僅回傳警示文字。

在非心跳情境下，訊息開頭或結尾出現的 `HEARTBEAT_OK` 會被移除並記錄；僅包含 `HEARTBEAT_OK` 的訊息會被丟棄。

## 設定

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m", // default: 30m (0m disables)
        model: "anthropic/claude-opus-4-6",
        includeReasoning: false, // default: false (deliver separate Reasoning: message when available)
        target: "last", // last | none | <channel id> (core or plugin, e.g. "bluebubbles")
        to: "+15551234567", // optional channel-specific override
        accountId: "ops-bot", // optional multi-account channel id
        prompt: "Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.",
        ackMaxChars: 300, // max chars allowed after HEARTBEAT_OK
      },
    },
  },
}
```

### 範圍與優先順序

- `agents.defaults.heartbeat` 設定全域的心跳行為。
- `agents.list[].heartbeat` 會疊加其上；若任一代理程式具有 `heartbeat` 區塊，則**只有那些代理程式**會執行心跳。
- `channels.defaults.heartbeat` 設定所有頻道的可見度預設值。
- `channels.<channel>.heartbeat` 覆寫頻道預設值。
- `channels.<channel>.accounts.<id>.heartbeat`（多帳號頻道）覆寫每個頻道的設定。

### 每個代理程式的心跳

若任何 `agents.list[]` 項目包含 `heartbeat` 區塊，則**只有那些代理程式**
會執行心跳。每個代理程式的區塊會疊加在 `agents.defaults.heartbeat` 之上
（因此你可以一次設定共用預設，再逐一覆寫）。

範例：兩個代理程式，只有第二個代理程式執行心跳。

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        target: "last",
      },
    },
    list: [
      { id: "main", default: true },
      {
        id: "ops",
        heartbeat: {
          every: "1h",
          target: "whatsapp",
          to: "+15551234567",
          prompt: "Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.",
        },
      },
    ],
  },
}
```

### 活動時段範例

將心跳限制在特定時區的上班時段：

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        target: "last",
        activeHours: {
          start: "09:00",
          end: "22:00",
          timezone: "America/New_York", // optional; uses your userTimezone if set, otherwise host tz
        },
      },
    },
  },
}
```

在此時段之外（東部時間早上 9 點前或晚上 10 點後），心跳會被略過。下一次落在時段內的排程觸發將正常執行。

### 多帳號範例

使用 `accountId`，在像 Telegram 這樣的多帳號頻道中指定特定帳號：

```json5
{
  agents: {
    list: [
      {
        id: "ops",
        heartbeat: {
          every: "1h",
          target: "telegram",
          to: "12345678",
          accountId: "ops-bot",
        },
      },
    ],
  },
  channels: {
    telegram: {
      accounts: {
        "ops-bot": { botToken: "YOUR_TELEGRAM_BOT_TOKEN" },
      },
    },
  },
}
```

### 欄位說明

- `every`：心跳間隔（時間長度字串；預設單位 = 分鐘）。
- `model`：心跳執行時的選用模型覆寫（`provider/model`）。
- `includeReasoning`：啟用時，若可用，會一併傳送獨立的 `Reasoning:` 訊息（結構與 `/reasoning on` 相同）。
- `session`：心跳執行時的選用工作階段鍵。
  - `main`（預設）：代理程式主工作階段。
  - 明確的工作階段鍵（可從 `openclaw sessions --json` 或 [sessions CLI](/cli/sessions) 複製）。
  - 工作階段鍵格式：請參閱 [Sessions](/concepts/session) 與 [Groups](/concepts/groups)。
- `target`：
  - `last`（預設）：傳送至最後使用的外部頻道。
  - 明確指定頻道：`whatsapp` / `telegram` / `discord` / `googlechat` / `slack` / `msteams` / `signal` / `imessage`。
  - `none`：執行心跳但**不進行**外部傳送。
- `to`：選用的收件者覆寫（依頻道而定的 id，例如 WhatsApp 的 E.164 或 Telegram 的 chat id）。
- `accountId`：多帳號頻道的選用帳號 id。當 `target: "last"` 時，帳號 id 會套用至解析後的最後頻道（若該頻道支援帳號）；否則會被忽略。若帳號 id 與解析後頻道中設定的帳號不相符，則會略過傳送。
- `prompt`：覆寫預設提示本文（不進行合併）。
- `ackMaxChars`：在 `HEARTBEAT_OK` 之後允許傳送的最大字元數。
- `activeHours`：將心跳執行限制在時間視窗內。物件包含 `start`（HH:MM，含）、`end`（HH:MM，不含；允許使用 `24:00` 表示一天結束），以及選用的 `timezone`。
  - 省略或 `"user"`：若有設定，使用你的 `agents.defaults.userTimezone`，否則回退至主機系統時區。
  - `"local"`：一律使用主機系統時區。
  - 任一 IANA 識別碼（例如 `America/New_York`）：直接使用；若無效，則回退至上述 `"user"` 行為。
  - 在活動時段之外，心跳會被略過，直到下一次落在時段內的觸發。

## 傳送行為

- 心跳預設在代理程式的主工作階段中執行（`agent:<id>:<mainKey>`），
  或在 `global` 當 `session.scope = "global"` 時。設定 `session` 可覆寫為
  特定頻道的工作階段（Discord／WhatsApp／等）。
- `session` 僅影響執行的上下文；實際傳送由 `target` 與 `to` 控制。
- 若要傳送至特定頻道／收件者，請設定 `target` + `to`。搭配
  `target: "last"` 時，傳送會使用該工作階段最後的外部頻道。
- 若主佇列忙碌，心跳會被略過並於稍後重試。
- 若 `target` 解析後沒有外部目的地，仍會執行，但不會送出任何外部訊息。
- 僅屬心跳的回覆**不會**維持工作階段存活；會還原最後的 `updatedAt`，
  使閒置過期行為維持正常。

## 可見度控制

預設情況下，`HEARTBEAT_OK` 確認訊息會被隱藏，而警示內容仍會傳送。
你可以依頻道或依帳號調整：

```yaml
channels:
  defaults:
    heartbeat:
      showOk: false # Hide HEARTBEAT_OK (default)
      showAlerts: true # Show alert messages (default)
      useIndicator: true # Emit indicator events (default)
  telegram:
    heartbeat:
      showOk: true # Show OK acknowledgments on Telegram
  whatsapp:
    accounts:
      work:
        heartbeat:
          showAlerts: false # Suppress alert delivery for this account
```

優先順序：每帳號 → 每頻道 → 頻道預設 → 內建預設。

### 各旗標的作用

- `showOk`：當模型僅回傳 OK 回覆時，傳送一則 `HEARTBEAT_OK` 確認訊息。
- `showAlerts`：當模型回傳非 OK 回覆時，傳送警示內容。
- `useIndicator`：為 UI 狀態介面發出指示事件。

若**三者皆為 false**，OpenClaw 會完全略過心跳執行（不進行模型呼叫）。

### 每頻道與每帳號範例

```yaml
channels:
  defaults:
    heartbeat:
      showOk: false
      showAlerts: true
      useIndicator: true
  slack:
    heartbeat:
      showOk: true # all Slack accounts
    accounts:
      ops:
        heartbeat:
          showAlerts: false # suppress alerts for the ops account only
  telegram:
    heartbeat:
      showOk: true
```

### 常見模式

| 目標                          | 設定                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| 預設行為（靜默 OK、啟用警示） | _(不需要設定)_                                                                           |
| 完全靜默（無訊息、無指示）    | `channels.defaults.heartbeat: { showOk: false, showAlerts: false, useIndicator: false }` |
| 僅指示器（不傳送訊息）        | `channels.defaults.heartbeat: { showOk: false, showAlerts: false, useIndicator: true }`  |
| 僅在單一頻道傳送 OK           | `channels.telegram.heartbeat: { showOk: true }`                                          |

## HEARTBEAT.md（選用）

若工作區中存在 `HEARTBEAT.md` 檔案，預設提示會要求代理程式讀取它。
可將其視為你的「心跳檢查清單」：小巧、穩定，且適合每 30 分鐘納入一次。

若存在 `HEARTBEAT.md` 但實際上是空的（只有空白行與像 `# Heading` 這樣的 Markdown 標題），OpenClaw 會略過心跳執行以節省 API 呼叫。
若檔案不存在，心跳仍會執行，並由模型自行決定行為。

請保持內容精簡（短清單或提醒），以避免提示膨脹。

`HEARTBEAT.md` 範例：

```md
# Heartbeat checklist

- Quick scan: anything urgent in inboxes?
- If it’s daytime, do a lightweight check-in if nothing else is pending.
- If a task is blocked, write down _what is missing_ and ask Peter next time.
```

### 代理程式可以更新 HEARTBEAT.md 嗎？

可以——只要你要求它這麼做。

`HEARTBEAT.md` 只是代理程式工作區中的一般檔案，因此你可以在一般聊天中告訴代理程式，例如：

- 「更新 `HEARTBEAT.md`，加入每日行事曆檢查。」
- 「重寫 `HEARTBEAT.md`，讓它更精簡並專注於收件匣後續事項。」

若你希望主動進行，也可以在心跳提示中加入明確的一行，例如：「If the checklist becomes stale, update HEARTBEAT.md with a better one。」

安全提醒：請勿在 `HEARTBEAT.md` 中放入祕密資訊（API 金鑰、電話號碼、私人權杖）——它會成為提示上下文的一部分。

## 手動喚醒（隨需）

你可以佇列一個系統事件並立即觸發心跳：

```bash
openclaw system event --text "Check for urgent follow-ups" --mode now
```

若多個代理程式設定了 `heartbeat`，手動喚醒會立即執行每一個代理程式的心跳。

使用 `--mode next-heartbeat` 可等待下一次排程觸發。

## 推理內容傳送（選用）

預設情況下，心跳只會傳送最終的「答案」內容。

若你需要透明度，請啟用：

- `agents.defaults.heartbeat.includeReasoning: true`

啟用後，心跳也會另外傳送一則以 `Reasoning:` 為前綴的訊息
（結構與 `/reasoning on` 相同）。當代理程式管理多個工作階段／codex，且你想了解它為何決定提醒你時，這會很有幫助——但也可能洩漏比你期望更多的內部細節。建議在群組聊天中保持關閉。

## 成本考量

心跳會執行完整的代理程式回合。間隔越短，消耗的權杖越多。
請保持 `HEARTBEAT.md` 精簡，並考慮使用較便宜的 `model` 或 `target: "none"`，
如果你只需要內部狀態更新。

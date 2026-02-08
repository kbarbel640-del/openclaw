---
summary: "斜線指令：文字與原生、設定與支援的指令"
read_when:
  - 使用或設定聊天指令時
  - 除錯指令路由或權限時
title: "斜線指令"
x-i18n:
  source_path: tools/slash-commands.md
  source_hash: ca0deebf89518e8c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:27Z
---

# 斜線指令

指令由 Gateway 閘道器 處理。大多數指令必須以 **獨立** 訊息傳送，且以 `/` 開頭。
僅限主機的 bash 聊天指令使用 `! <cmd>`（`/bash <cmd>` 為別名）。

這裡有兩個相關系統：

- **Commands**：獨立的 `/...` 訊息。
- **Directives**：`/think`、`/verbose`、`/reasoning`、`/elevated`、`/exec`、`/model`、`/queue`。
  - Directives 會在模型看到訊息前被移除。
  - 在一般聊天訊息（非僅含 directive）中，它們被視為「行內提示」，且**不會**持續變更工作階段設定。
  - 在僅含 directive 的訊息中（訊息只包含 directives），它們會持續套用到工作階段，並回覆一則確認訊息。
  - Directives 僅套用於 **已授權的傳送者**（頻道允許清單／配對，加上 `commands.useAccessGroups`）。
    未授權的傳送者會看到 directives 被當作純文字處理。

另有一些 **行內捷徑**（僅限允許清單／已授權的傳送者）：`/help`、`/commands`、`/status`、`/whoami`（`/id`）。
它們會立即執行，並在模型看到訊息前被移除，其餘文字會照正常流程繼續處理。

## 設定

```json5
{
  commands: {
    native: "auto",
    nativeSkills: "auto",
    text: true,
    bash: false,
    bashForegroundMs: 2000,
    config: false,
    debug: false,
    restart: false,
    useAccessGroups: true,
  },
}
```

- `commands.text`（預設 `true`）啟用在聊天訊息中解析 `/...`。
  - 在沒有原生指令的介面（WhatsApp/WebChat/Signal/iMessage/Google Chat/MS Teams）上，即使將此項設為 `false`，文字指令仍可運作。
- `commands.native`（預設 `"auto"`）註冊原生指令。
  - Auto：Discord/Telegram 為開啟；Slack 為關閉（直到你新增斜線指令）；對不支援原生的提供者會被忽略。
  - 設定 `channels.discord.commands.native`、`channels.telegram.commands.native` 或 `channels.slack.commands.native` 以針對各提供者覆寫（bool 或 `"auto"`）。
  - `false` 會在啟動時清除 Discord/Telegram 先前註冊的指令。Slack 指令由 Slack 應用程式管理，且不會自動移除。
- `commands.nativeSkills`（預設 `"auto"`）在支援時以原生方式註冊 **skill** 指令。
  - Auto：Discord/Telegram 為開啟；Slack 為關閉（Slack 需要為每個 skill 建立一個斜線指令）。
  - 設定 `channels.discord.commands.nativeSkills`、`channels.telegram.commands.nativeSkills` 或 `channels.slack.commands.nativeSkills` 以針對各提供者覆寫（bool 或 `"auto"`）。
- `commands.bash`（預設 `false`）啟用 `! <cmd>` 以執行主機 shell 指令（`/bash <cmd>` 為別名；需要 `tools.elevated` 允許清單）。
- `commands.bashForegroundMs`（預設 `2000`）控制 bash 在切換到背景模式前等待多久（`0` 會立即轉為背景）。
- `commands.config`（預設 `false`）啟用 `/config`（讀寫 `openclaw.json`）。
- `commands.debug`（預設 `false`）啟用 `/debug`（僅限執行期的覆寫）。
- `commands.useAccessGroups`（預設 `true`）強制套用指令的允許清單／政策。

## 指令清單

文字 + 原生（啟用時）：

- `/help`
- `/commands`
- `/skill <name> [input]`（依名稱執行一個 skill）
- `/status`（顯示目前狀態；可用時包含目前模型提供者的使用量／配額）
- `/allowlist`（列出／新增／移除允許清單項目）
- `/approve <id> allow-once|allow-always|deny`（處理 exec 核准提示）
- `/context [list|detail|json]`（解釋「context」；`detail` 會顯示每個檔案 + 每個工具 + 每個 skill + 系統提示的大小）
- `/whoami`（顯示你的傳送者 id；別名：`/id`）
- `/subagents list|stop|log|info|send`（檢視、停止、記錄或向目前工作階段的子代理程式執行傳訊）
- `/config show|get|set|unset`（將設定寫入磁碟，僅限擁有者；需要 `commands.config: true`）
- `/debug show|set|unset|reset`（執行期覆寫，僅限擁有者；需要 `commands.debug: true`）
- `/usage off|tokens|full|cost`（每次回應的使用量頁尾或本地成本摘要）
- `/tts off|always|inbound|tagged|status|provider|limit|summary|audio`（控制 TTS；見 [/tts](/tts)）
  - Discord：原生指令為 `/voice`（Discord 保留 `/tts`）；文字 `/tts` 仍可使用。
- `/stop`
- `/restart`
- `/dock-telegram`（別名：`/dock_telegram`）（將回覆切換到 Telegram）
- `/dock-discord`（別名：`/dock_discord`）（將回覆切換到 Discord）
- `/dock-slack`（別名：`/dock_slack`）（將回覆切換到 Slack）
- `/activation mention|always`（僅限群組）
- `/send on|off|inherit`（僅限擁有者）
- `/reset` 或 `/new [model]`（可選模型提示；其餘內容會原樣傳遞）
- `/think <off|minimal|low|medium|high|xhigh>`（依模型／提供者動態選項；別名：`/thinking`、`/t`）
- `/verbose on|full|off`（別名：`/v`）
- `/reasoning on|off|stream`（別名：`/reason`；開啟時，會傳送一則以 `Reasoning:` 開頭的獨立訊息；`stream` = 僅 Telegram 草稿）
- `/elevated on|off|ask|full`（別名：`/elev`；`full` 會略過 exec 核准）
- `/exec host=<sandbox|gateway|node> security=<deny|allowlist|full> ask=<off|on-miss|always> node=<id>`（傳送 `/exec` 以顯示目前狀態）
- `/model <name>`（別名：`/models`；或來自 `agents.defaults.models.*.alias` 的 `/<alias>`）
- `/queue <mode>`（以及如 `debounce:2s cap:25 drop:summarize` 等選項；傳送 `/queue` 以查看目前設定）
- `/bash <command>`（僅限主機；為 `! <command>` 的別名；需要 `commands.bash: true` + `tools.elevated` 允許清單）

僅限文字：

- `/compact [instructions]`（見 [/concepts/compaction](/concepts/compaction)）
- `! <command>`（僅限主機；一次一個；長時間工作請使用 `!poll` + `!stop`）
- `!poll`（檢查輸出／狀態；可接受可選的 `sessionId`；`/bash poll` 亦可）
- `!stop`（停止正在執行的 bash 工作；可接受可選的 `sessionId`；`/bash stop` 亦可）

備註：

- 指令可在指令與參數之間接受可選的 `:`（例如 `/think: high`、`/send: on`、`/help:`）。
- `/new <model>` 接受模型別名、`provider/model`，或提供者名稱（模糊比對）；若無符合，文字會被視為訊息內容。
- 若需完整的提供者使用量明細，請使用 `openclaw status --usage`。
- `/allowlist add|remove` 需要 `commands.config=true`，並遵循頻道的 `configWrites`。
- `/usage` 控制每次回應的使用量頁尾；`/usage cost` 會從 OpenClaw 工作階段記錄列印本地成本摘要。
- `/restart` 預設為停用；設定 `commands.restart: true` 以啟用。
- `/verbose` 用於除錯與額外可視性；一般使用請保持 **關閉**。
- `/reasoning`（以及 `/verbose`）在群組設定中具有風險：可能揭露你未打算公開的內部推理或工具輸出。建議保持關閉，特別是在群組聊天中。
- **快速路徑：** 來自允許清單傳送者的僅指令訊息會立即處理（略過佇列 + 模型）。
- **群組提及管控：** 來自允許清單傳送者的僅指令訊息會略過提及需求。
- **行內捷徑（僅限允許清單傳送者）：** 某些指令也可嵌入一般訊息中使用，並在模型看到其餘文字前被移除。
  - 範例：`hey /status` 會觸發狀態回覆，其餘文字照正常流程繼續。
- 目前包含：`/help`、`/commands`、`/status`、`/whoami`（`/id`）。
- 未授權的僅指令訊息會被靜默忽略，而行內的 `/...` 標記會被視為純文字。
- **Skill 指令：** `user-invocable` Skills 會以斜線指令公開。名稱會被清理為 `a-z0-9_`（最長 32 個字元）；衝突時會加上數字後綴（例如 `_2`）。
  - `/skill <name> [input]` 依名稱執行一個 skill（當原生指令限制無法為每個 skill 建立指令時很有用）。
  - 預設情況下，skill 指令會作為一般請求轉送給模型。
  - Skills 可選擇宣告 `command-dispatch: tool`，將指令直接路由至工具（確定性，無模型）。
  - 範例：`/prose`（OpenProse 外掛）— 見 [OpenProse](/prose)。
- **原生指令參數：** Discord 對動態選項使用自動完成（省略必要參數時會顯示按鈕選單）。Telegram 與 Slack 在指令支援選項且你省略參數時，會顯示按鈕選單。

## 使用介面（顯示位置）

- **提供者使用量／配額**（例如：「Claude 剩餘 80%」）會在啟用使用量追蹤時，顯示於 `/status`，適用於目前的模型提供者。
- **每次回應的 token／成本** 由 `/usage off|tokens|full` 控制（附加在一般回覆後）。
- `/model status` 與 **模型／驗證／端點** 有關，而非使用量。

## 模型選擇（`/model`）

`/model` 是以 directive 方式實作。

範例：

```
/model
/model list
/model 3
/model openai/gpt-5.2
/model opus@anthropic:default
/model status
```

備註：

- `/model` 與 `/model list` 會顯示精簡、編號的選擇器（模型家族 + 可用提供者）。
- `/model <#>` 會從該選擇器中選取（並在可能時偏好目前的提供者）。
- `/model status` 會顯示詳細檢視，包括已設定的提供者端點（`baseUrl`）與 API 模式（`api`）（若可用）。

## 除錯覆寫

`/debug` 讓你設定 **僅限執行期** 的設定覆寫（記憶體中，不寫入磁碟）。僅限擁有者。預設停用；以 `commands.debug: true` 啟用。

範例：

```
/debug show
/debug set messages.responsePrefix="[openclaw]"
/debug set channels.whatsapp.allowFrom=["+1555","+4477"]
/debug unset messages.responsePrefix
/debug reset
```

備註：

- 覆寫會立即套用到新的設定讀取，但**不會**寫入 `openclaw.json`。
- 使用 `/debug reset` 清除所有覆寫並回復到磁碟上的設定。

## 設定更新

`/config` 會寫入磁碟上的設定（`openclaw.json`）。僅限擁有者。預設停用；以 `commands.config: true` 啟用。

範例：

```
/config show
/config show messages.responsePrefix
/config get messages.responsePrefix
/config set messages.responsePrefix="[openclaw]"
/config unset messages.responsePrefix
```

備註：

- 寫入前會驗證設定；無效的變更會被拒絕。
- `/config` 的更新會在重新啟動後持續生效。

## 介面備註

- **文字指令** 在一般聊天工作階段中執行（私訊共用 `main`，群組各自有獨立工作階段）。
- **原生指令** 使用隔離的工作階段：
  - Discord：`agent:<agentId>:discord:slash:<userId>`
  - Slack：`agent:<agentId>:slack:slash:<userId>`（前綴可由 `channels.slack.slashCommand.sessionPrefix` 設定）
  - Telegram：`telegram:slash:<userId>`（透過 `CommandTargetSessionKey` 指向聊天工作階段）
- **`/stop`** 會指向目前作用中的聊天工作階段，以便中止當前執行。
- **Slack：** 仍支援單一 `/openclaw` 風格的 `channels.slack.slashCommand` 指令。若你啟用 `commands.native`，則必須為每個內建指令建立一個 Slack 斜線指令（名稱與 `/help` 相同）。Slack 的指令參數選單會以臨時的 Block Kit 按鈕提供。

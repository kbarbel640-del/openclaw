---
summary: "Slack 的 Socket 或 HTTP Webhook 模式設定"
read_when: "設定 Slack 或除錯 Slack Socket / HTTP 模式"
title: "Slack"
x-i18n:
  source_path: channels/slack.md
  source_hash: 703b4b4333bebfef
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:57Z
---

# Slack

## Socket 模式（預設）

### 快速設定（初學者）

1. 建立一個 Slack 應用程式並啟用 **Socket Mode**。
2. 建立 **App Token**（`xapp-...`）與 **Bot Token**（`xoxb-...`）。
3. 為 OpenClaw 設定權杖並啟動 Gateway 閘道器。

最小設定：

```json5
{
  channels: {
    slack: {
      enabled: true,
      appToken: "xapp-...",
      botToken: "xoxb-...",
    },
  },
}
```

### 設定

1. 在 https://api.slack.com/apps 建立一個 Slack 應用程式（From scratch）。
2. **Socket Mode** → 開啟切換。接著前往 **Basic Information** → **App-Level Tokens** → **Generate Token and Scopes**，加入範圍 `connections:write`。複製 **App Token**（`xapp-...`）。
3. **OAuth & Permissions** → 新增 bot token scopes（使用下方的 manifest）。點擊 **Install to Workspace**。複製 **Bot User OAuth Token**（`xoxb-...`）。
4. 選用：**OAuth & Permissions** → 新增 **User Token Scopes**（見下方唯讀清單）。重新安裝應用程式並複製 **User OAuth Token**（`xoxp-...`）。
5. **Event Subscriptions** → 啟用事件並訂閱：
   - `message.*`（包含編輯 / 刪除 / 執行緒廣播）
   - `app_mention`
   - `reaction_added`, `reaction_removed`
   - `member_joined_channel`, `member_left_channel`
   - `channel_rename`
   - `pin_added`, `pin_removed`
6. 邀請機器人加入你希望它能讀取的頻道。
7. Slash Commands → 若你使用 `channels.slack.slashCommand`，請建立 `/openclaw`。如果啟用原生命令，需為每個內建命令新增一個 slash command（名稱需與 `/help` 相同）。Slack 的原生命令預設為關閉，除非你設定 `channels.slack.commands.native: true`（全域 `commands.native` 預設為 `"auto"`，會讓 Slack 保持關閉）。
8. App Home → 啟用 **Messages Tab**，讓使用者可以私訊機器人。

請使用下方的 manifest，以確保 scopes 與事件保持同步。

多帳號支援：使用 `channels.slack.accounts` 搭配各帳號的權杖，以及選用的 `name`。共享模式請參閱 [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts)。

### OpenClaw 設定（最小）

透過環境變數設定權杖（建議）：

- `SLACK_APP_TOKEN=xapp-...`
- `SLACK_BOT_TOKEN=xoxb-...`

或透過設定檔：

```json5
{
  channels: {
    slack: {
      enabled: true,
      appToken: "xapp-...",
      botToken: "xoxb-...",
    },
  },
}
```

### 使用者權杖（選用）

OpenClaw 可以使用 Slack 使用者權杖（`xoxp-...`）進行讀取操作（歷史紀錄、
釘選、表情符號、成員資訊）。預設情況下它保持唯讀：當存在時，讀取會優先使用使用者權杖，而寫入仍使用 bot 權杖，除非你明確選擇加入。即使設定 `userTokenReadOnly: false`，只要 bot 權杖可用，寫入仍會優先使用 bot 權杖。

使用者權杖需在設定檔中設定（不支援環境變數）。多帳號時，請設定 `channels.slack.accounts.<id>.userToken`。

同時使用 bot + app + user 權杖的範例：

```json5
{
  channels: {
    slack: {
      enabled: true,
      appToken: "xapp-...",
      botToken: "xoxb-...",
      userToken: "xoxp-...",
    },
  },
}
```

明確設定 userTokenReadOnly（允許使用者權杖寫入）的範例：

```json5
{
  channels: {
    slack: {
      enabled: true,
      appToken: "xapp-...",
      botToken: "xoxb-...",
      userToken: "xoxp-...",
      userTokenReadOnly: false,
    },
  },
}
```

#### 權杖使用方式

- 讀取操作（歷史紀錄、反應清單、釘選清單、表情符號清單、成員資訊、
  搜尋）在設定時會優先使用使用者權杖，否則使用 bot 權杖。
- 寫入操作（傳送 / 編輯 / 刪除訊息、加入 / 移除反應、釘選 / 取消釘選、
  檔案上傳）預設使用 bot 權杖。若設定 `userTokenReadOnly: false` 且
  沒有可用的 bot 權杖，OpenClaw 會回退使用使用者權杖。

### 歷史內容上下文

- `channels.slack.historyLimit`（或 `channels.slack.accounts.*.historyLimit`）控制要包入提示中的最近頻道 / 群組訊息數量。
- 若未設定則回退至 `messages.groupChat.historyLimit`。設定 `0` 可停用（預設 50）。

## HTTP 模式（Events API）

當你的 Gateway 閘道器可透過 HTTPS 被 Slack 存取時（典型伺服器部署），請使用 HTTP webhook 模式。
HTTP 模式使用 Events API + Interactivity + Slash Commands，並共用同一個請求 URL。

### 設定

1. 建立一個 Slack 應用程式並 **停用 Socket Mode**（若只使用 HTTP 可選）。
2. **Basic Information** → 複製 **Signing Secret**。
3. **OAuth & Permissions** → 安裝應用程式並複製 **Bot User OAuth Token**（`xoxb-...`）。
4. **Event Subscriptions** → 啟用事件，並將 **Request URL** 設為你的 Gateway webhook 路徑（預設 `/slack/events`）。
5. **Interactivity & Shortcuts** → 啟用並設定相同的 **Request URL**。
6. **Slash Commands** → 為你的命令設定相同的 **Request URL**。

請求 URL 範例：
`https://gateway-host/slack/events`

### OpenClaw 設定（最小）

```json5
{
  channels: {
    slack: {
      enabled: true,
      mode: "http",
      botToken: "xoxb-...",
      signingSecret: "your-signing-secret",
      webhookPath: "/slack/events",
    },
  },
}
```

多帳號 HTTP 模式：設定 `channels.slack.accounts.<id>.mode = "http"`，並為每個帳號提供唯一的
`webhookPath`，讓每個 Slack 應用程式都能指向自己的 URL。

### Manifest（選用）

使用此 Slack 應用程式 manifest 可快速建立應用程式（可自行調整名稱 / 命令）。
若你計畫設定使用者權杖，請包含使用者 scopes。

```json
{
  "display_information": {
    "name": "OpenClaw",
    "description": "Slack connector for OpenClaw"
  },
  "features": {
    "bot_user": {
      "display_name": "OpenClaw",
      "always_online": false
    },
    "app_home": {
      "messages_tab_enabled": true,
      "messages_tab_read_only_enabled": false
    },
    "slash_commands": [
      {
        "command": "/openclaw",
        "description": "Send a message to OpenClaw",
        "should_escape": false
      }
    ]
  },
  "oauth_config": {
    "scopes": {
      "bot": [
        "chat:write",
        "channels:history",
        "channels:read",
        "groups:history",
        "groups:read",
        "groups:write",
        "im:history",
        "im:read",
        "im:write",
        "mpim:history",
        "mpim:read",
        "mpim:write",
        "users:read",
        "app_mentions:read",
        "reactions:read",
        "reactions:write",
        "pins:read",
        "pins:write",
        "emoji:read",
        "commands",
        "files:read",
        "files:write"
      ],
      "user": [
        "channels:history",
        "channels:read",
        "groups:history",
        "groups:read",
        "im:history",
        "im:read",
        "mpim:history",
        "mpim:read",
        "users:read",
        "reactions:read",
        "pins:read",
        "emoji:read",
        "search:read"
      ]
    }
  },
  "settings": {
    "socket_mode_enabled": true,
    "event_subscriptions": {
      "bot_events": [
        "app_mention",
        "message.channels",
        "message.groups",
        "message.im",
        "message.mpim",
        "reaction_added",
        "reaction_removed",
        "member_joined_channel",
        "member_left_channel",
        "channel_rename",
        "pin_added",
        "pin_removed"
      ]
    }
  }
}
```

若你啟用原生命令，請為每個要公開的命令新增一個 `slash_commands` 項目（需符合 `/help` 清單）。可使用 `channels.slack.commands.native` 覆寫。

## Scopes（目前 vs 選用）

Slack 的 Conversations API 採用型別範圍：你只需要實際會使用到的
對話型別（channels、groups、im、mpim）所需的 scopes。概覽請見
https://docs.slack.dev/apis/web-api/using-the-conversations-api/ 。

### Bot 權杖 scopes（必要）

- `chat:write`（透過 `chat.postMessage` 傳送 / 更新 / 刪除訊息）
  https://docs.slack.dev/reference/methods/chat.postMessage
- `im:write`（透過 `conversations.open` 開啟私訊）
  https://docs.slack.dev/reference/methods/conversations.open
- `channels:history`, `groups:history`, `im:history`, `mpim:history`
  https://docs.slack.dev/reference/methods/conversations.history
- `channels:read`, `groups:read`, `im:read`, `mpim:read`
  https://docs.slack.dev/reference/methods/conversations.info
- `users:read`（使用者查詢）
  https://docs.slack.dev/reference/methods/users.info
- `reactions:read`, `reactions:write`（`reactions.get` / `reactions.add`）
  https://docs.slack.dev/reference/methods/reactions.get
  https://docs.slack.dev/reference/methods/reactions.add
- `pins:read`, `pins:write`（`pins.list` / `pins.add` / `pins.remove`）
  https://docs.slack.dev/reference/scopes/pins.read
  https://docs.slack.dev/reference/scopes/pins.write
- `emoji:read`（`emoji.list`）
  https://docs.slack.dev/reference/scopes/emoji.read
- `files:write`（透過 `files.uploadV2` 上傳）
  https://docs.slack.dev/messaging/working-with-files/#upload

### 使用者權杖 scopes（選用，預設唯讀）

若你設定 `channels.slack.userToken`，請在 **User Token Scopes** 下新增以下項目。

- `channels:history`, `groups:history`, `im:history`, `mpim:history`
- `channels:read`, `groups:read`, `im:read`, `mpim:read`
- `users:read`
- `reactions:read`
- `pins:read`
- `emoji:read`
- `search:read`

### 目前不需要（但可能未來會用）

- `mpim:write`（僅在新增透過 `conversations.open` 開啟群組私訊 / 啟動私訊時需要）
- `groups:write`（僅在新增私人頻道管理：建立 / 重新命名 / 邀請 / 封存）
- `chat:write.public`（僅在需要發佈到機器人未加入的頻道時）
  https://docs.slack.dev/reference/scopes/chat.write.public
- `users:read.email`（僅在需要從 `users.info` 取得電子郵件欄位時）
  https://docs.slack.dev/changelog/2017-04-narrowing-email-access
- `files:read`（僅在開始列出 / 讀取檔案中繼資料時）

## 設定

Slack 僅使用 Socket 模式（沒有 HTTP webhook 伺服器）。請提供兩個權杖：

```json
{
  "slack": {
    "enabled": true,
    "botToken": "xoxb-...",
    "appToken": "xapp-...",
    "groupPolicy": "allowlist",
    "dm": {
      "enabled": true,
      "policy": "pairing",
      "allowFrom": ["U123", "U456", "*"],
      "groupEnabled": false,
      "groupChannels": ["G123"],
      "replyToMode": "all"
    },
    "channels": {
      "C123": { "allow": true, "requireMention": true },
      "#general": {
        "allow": true,
        "requireMention": true,
        "users": ["U123"],
        "skills": ["search", "docs"],
        "systemPrompt": "Keep answers short."
      }
    },
    "reactionNotifications": "own",
    "reactionAllowlist": ["U123"],
    "replyToMode": "off",
    "actions": {
      "reactions": true,
      "messages": true,
      "pins": true,
      "memberInfo": true,
      "emojiList": true
    },
    "slashCommand": {
      "enabled": true,
      "name": "openclaw",
      "sessionPrefix": "slack:slash",
      "ephemeral": true
    },
    "textChunkLimit": 4000,
    "mediaMaxMb": 20
  }
}
```

權杖也可透過環境變數提供：

- `SLACK_BOT_TOKEN`
- `SLACK_APP_TOKEN`

確認反應（Ack reactions）由全域的 `messages.ackReaction` +
`messages.ackReactionScope` 控制。使用 `messages.removeAckAfterReply` 可在機器人回覆後清除
確認反應。

## 限制

- 輸出文字會被分段至 `channels.slack.textChunkLimit`（預設 4000）。
- 選用的換行分段：設定 `channels.slack.chunkMode="newline"`，在長度分段前先依空白行（段落邊界）分割。
- 媒體上傳受限於 `channels.slack.mediaMaxMb`（預設 20）。

## 回覆串接（Threading）

預設情況下，OpenClaw 會在主頻道回覆。使用 `channels.slack.replyToMode` 來控制自動串接：

| 模式    | 行為                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------ |
| `off`   | **預設。** 在主頻道回覆。僅當觸發訊息本來就在執行緒中時才會回覆到執行緒。                              |
| `first` | 第一則回覆發送到執行緒（在觸發訊息下），後續回覆回到主頻道。適合在避免執行緒雜亂的同時保持上下文可見。 |
| `all`   | 所有回覆都發送到執行緒。可讓對話集中，但可能降低可見度。                                               |

此模式同時套用於自動回覆與代理程式工具呼叫（`slack sendMessage`）。

### 依聊天型別的串接設定

你可以透過設定 `channels.slack.replyToModeByChatType`，為不同聊天型別設定不同的串接行為：

```json5
{
  channels: {
    slack: {
      replyToMode: "off", // default for channels
      replyToModeByChatType: {
        direct: "all", // DMs always thread
        group: "first", // group DMs/MPIM thread first reply
      },
    },
  },
}
```

支援的聊天型別：

- `direct`：1:1 私訊（Slack `im`）
- `group`：群組私訊 / MPIM（Slack `mpim`）
- `channel`：一般頻道（公開 / 私人）

優先順序：

1. `replyToModeByChatType.<chatType>`
2. `replyToMode`
3. 提供者預設（`off`）

舊版 `channels.slack.dm.replyToMode` 仍可作為 `direct` 的備援（當未設定聊天型別覆寫時）。

範例：

只在私訊中串接：

```json5
{
  channels: {
    slack: {
      replyToMode: "off",
      replyToModeByChatType: { direct: "all" },
    },
  },
}
```

群組私訊串接，但頻道維持在主層：

```json5
{
  channels: {
    slack: {
      replyToMode: "off",
      replyToModeByChatType: { group: "first" },
    },
  },
}
```

讓頻道使用串接，私訊維持在主層：

```json5
{
  channels: {
    slack: {
      replyToMode: "first",
      replyToModeByChatType: { direct: "off", group: "off" },
    },
  },
}
```

### 手動串接標籤

若需要更細緻的控制，可在代理程式回應中使用以下標籤：

- `[[reply_to_current]]` — 回覆至觸發訊息（開始 / 繼續執行緒）。
- `[[reply_to:<id>]]` — 回覆至指定的訊息 id。

## 工作階段 + 路由

- 私訊共用 `main` 工作階段（如 WhatsApp / Telegram）。
- 頻道對應到 `agent:<agentId>:slack:channel:<channelId>` 工作階段。
- Slash commands 使用 `agent:<agentId>:slack:slash:<userId>` 工作階段（前綴可透過 `channels.slack.slashCommand.sessionPrefix` 設定）。
- 若 Slack 未提供 `channel_type`，OpenClaw 會根據頻道 ID 前綴（`D`, `C`, `G`）推斷，並預設使用 `channel` 以保持工作階段鍵穩定。
- 原生命令註冊使用 `commands.native`（全域預設 `"auto"` → Slack 關閉），並可透過 `channels.slack.commands.native` 針對各工作區覆寫。文字命令需要獨立的 `/...` 訊息，且可透過 `commands.text: false` 停用。Slack slash commands 由 Slack 應用程式管理，不會自動移除。使用 `commands.useAccessGroups: false` 可略過命令的存取群組檢查。
- 完整命令清單 + 設定請見：[Slash commands](/tools/slash-commands)

## 私訊安全（配對）

- 預設：`channels.slack.dm.policy="pairing"` — 未知的私訊傳送者會收到一組配對碼（1 小時後到期）。
- 核准方式：`openclaw pairing approve slack <code>`。
- 若要允許任何人：設定 `channels.slack.dm.policy="open"` 與 `channels.slack.dm.allowFrom=["*"]`。
- `channels.slack.dm.allowFrom` 接受使用者 ID、@handle 或電子郵件（在權杖允許時於啟動時解析）。精靈在設定期間接受使用者名稱，並在權杖允許時解析為 id。

## 群組政策

- `channels.slack.groupPolicy` 控制頻道處理方式（`open|disabled|allowlist`）。
- `allowlist` 要求頻道必須列在 `channels.slack.channels` 中。
- 若你只設定 `SLACK_BOT_TOKEN` / `SLACK_APP_TOKEN`，且從未建立 `channels.slack` 區段，
  執行期會將 `groupPolicy` 預設為 `open`。請加入 `channels.slack.groupPolicy`、
  `channels.defaults.groupPolicy` 或頻道允許清單以鎖定行為。
- 設定精靈接受 `#channel` 名稱，並在可能時解析為 ID
  （公開 + 私人）；若存在多個匹配，會優先選擇仍在使用中的頻道。
- 啟動時，OpenClaw 會在權杖允許時將允許清單中的頻道 / 使用者名稱解析為 ID，
  並記錄對應關係；無法解析的項目會保留原始輸入。
- 若要 **不允許任何頻道**，請設定 `channels.slack.groupPolicy: "disabled"`（或保留空的允許清單）。

頻道選項（`channels.slack.channels.<id>` 或 `channels.slack.channels.<name>`）：

- `allow`：在 `groupPolicy="allowlist"` 時允許 / 拒絕該頻道。
- `requireMention`：該頻道的提及門檻控制。
- `tools`：選用的各頻道工具政策覆寫（`allow` / `deny` / `alsoAllow`）。
- `toolsBySender`：在該頻道內，選用的各傳送者工具政策覆寫（鍵為傳送者 id / @handle / 電子郵件；支援 `"*"` 萬用字元）。
- `allowBots`：允許機器人撰寫的訊息出現在此頻道（預設：false）。
- `users`：選用的各頻道使用者允許清單。
- `skills`：技能篩選（省略 = 所有技能，空值 = 無）。
- `systemPrompt`：該頻道的額外系統提示（與主題 / 目的合併）。
- `enabled`：設定 `false` 以停用該頻道。

## 傳送目標

搭配 cron / CLI 傳送時使用：

- 私訊使用 `user:<id>`
- 頻道使用 `channel:<id>`

## 工具動作

Slack 工具動作可透過 `channels.slack.actions.*` 進行門檻控制：

| 動作群組   | 預設 | 備註                      |
| ---------- | ---- | ------------------------- |
| reactions  | 啟用 | 加入 + 列出反應           |
| messages   | 啟用 | 讀取 / 傳送 / 編輯 / 刪除 |
| pins       | 啟用 | 釘選 / 取消釘選 / 列出    |
| memberInfo | 啟用 | 成員資訊                  |
| emojiList  | 啟用 | 自訂表情符號清單          |

## 安全注意事項

- 寫入操作預設使用 bot 權杖，確保狀態變更行為仍受
  應用程式的 bot 權限與身分所限制。
- 設定 `userTokenReadOnly: false` 允許在沒有 bot 權杖時使用使用者權杖進行寫入，
  這表示動作會以安裝該應用程式的使用者權限執行。請將使用者權杖視為高權限，
  並嚴格設定動作門檻與允許清單。
- 若你啟用使用者權杖寫入，請確保使用者權杖包含你期望的寫入
  scopes（`chat:write`, `reactions:write`, `pins:write`,
  `files:write`），否則相關操作會失敗。

## 備註

- 提及門檻由 `channels.slack.channels` 控制（將 `requireMention` 設為 `true`）；`agents.list[].groupChat.mentionPatterns`（或 `messages.groupChat.mentionPatterns`）也會被視為提及。
- 多代理程式覆寫：在 `agents.list[].groupChat.mentionPatterns` 上設定各代理程式的比對模式。
- 反應通知遵循 `channels.slack.reactionNotifications`（搭配模式 `allowlist` 使用 `reactionAllowlist`）。
- 機器人撰寫的訊息預設會被忽略；可透過 `channels.slack.allowBots` 或 `channels.slack.channels.<id>.allowBots` 啟用。
- 警告：若你允許回覆其他機器人（`channels.slack.allowBots=true` 或 `channels.slack.channels.<id>.allowBots=true`），請使用 `requireMention`、`channels.slack.channels.<id>.users` 允許清單，及 / 或在 `AGENTS.md` 與 `SOUL.md` 中設定明確的防護，以避免機器人彼此回覆形成迴圈。
- 對於 Slack 工具，反應移除的語意請參閱 [/tools/reactions](/tools/reactions)。
- 在允許且未超過大小限制時，附件會下載至媒體儲存區。

---
summary: 「Discord 機器人支援狀態、功能與設定」
read_when:
  - 「處理 Discord 頻道功能時」
title: 「Discord」
x-i18n:
  source_path: channels/discord.md
  source_hash: 9bebfe8027ff1972
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:24Z
---

# Discord（Bot API）

狀態：已就緒，可透過官方 Discord 機器人 Gateway 閘道器 支援私訊（DM）與伺服器文字頻道。

## 快速開始（新手）

1. 建立一個 Discord 機器人並複製機器人權杖。
2. 在 Discord 應用程式設定中，啟用 **Message Content Intent**（若你打算使用允許清單或名稱查詢，亦請啟用 **Server Members Intent**）。
3. 為 OpenClaw 設定權杖：
   - 環境變數：`DISCORD_BOT_TOKEN=...`
   - 或設定檔：`channels.discord.token: "..."`。
   - 若同時設定，設定檔優先（環境變數僅作為預設帳號的後備）。
4. 以可傳送訊息的權限邀請機器人加入你的伺服器（若只想使用私訊，可建立私人伺服器）。
5. 啟動 Gateway 閘道器。
6. 私訊預設為配對模式；首次聯絡時核准配對碼。

最小設定：

```json5
{
  channels: {
    discord: {
      enabled: true,
      token: "YOUR_BOT_TOKEN",
    },
  },
}
```

## 目標

- 透過 Discord 私訊或伺服器頻道與 OpenClaw 對話。
- 直接聊天會合併到代理程式的主要工作階段（預設為 `agent:main:main`）；伺服器頻道則以 `agent:<agentId>:discord:channel:<channelId>` 保持隔離（顯示名稱使用 `discord:<guildSlug>#<channelSlug>`）。
- 群組私訊預設會被忽略；可透過 `channels.discord.dm.groupEnabled` 啟用，並可選擇以 `channels.discord.dm.groupChannels` 限制。
- 保持路由具決定性：回覆一律回到原始進來的頻道。

## 運作方式

1. 建立 Discord 應用程式 → Bot，啟用所需的 intents（私訊 + 伺服器訊息 + 訊息內容），並取得機器人權杖。
2. 以你希望使用的位置所需的讀取／傳送訊息權限，邀請機器人加入伺服器。
3. 使用 `channels.discord.token`（或 `DISCORD_BOT_TOKEN` 作為後備）設定 OpenClaw。
4. 執行 Gateway 閘道器；當權杖可用（設定檔優先、環境變數後備）且 `channels.discord.enabled` 非 `false` 時，會自動啟動 Discord 頻道。
   - 若偏好使用環境變數，請設定 `DISCORD_BOT_TOKEN`（設定區塊為選用）。
5. 直接聊天：投遞時使用 `user:<id>`（或 `<@id>` 提及）；所有回合都會進入共享的 `main` 工作階段。純數字 ID 具歧義，將被拒絕。
6. 伺服器頻道：投遞時使用 `channel:<channelId>`。預設需要提及，且可按伺服器或頻道設定。
7. 直接聊天：預設以 `channels.discord.dm.policy` 保障安全（預設：`"pairing"`）。未知的傳送者會取得配對碼（1 小時後過期）；可透過 `openclaw pairing approve discord <code>` 核准。
   - 若要維持舊的「對任何人開放」行為：設定 `channels.discord.dm.policy="open"` 與 `channels.discord.dm.allowFrom=["*"]`。
   - 若要強制允許清單：設定 `channels.discord.dm.policy="allowlist"`，並在 `channels.discord.dm.allowFrom` 列出傳送者。
   - 若要忽略所有私訊：設定 `channels.discord.dm.enabled=false` 或 `channels.discord.dm.policy="disabled"`。
8. 群組私訊預設會被忽略；可透過 `channels.discord.dm.groupEnabled` 啟用，並可選擇以 `channels.discord.dm.groupChannels` 限制。
9. 選用的伺服器規則：以伺服器 ID（建議）或 slug 作為鍵設定 `channels.discord.guilds`，並可設定每頻道規則。
10. 選用的原生命令：`commands.native` 預設為 `"auto"`（Discord／Telegram 為開、Slack 為關）。可用 `channels.discord.commands.native: true|false|"auto"` 覆寫；`false` 會清除先前註冊的命令。文字命令由 `commands.text` 控制，且必須以獨立的 `/...` 訊息送出。使用 `commands.useAccessGroups: false` 可略過命令的存取群組檢查。
    - 完整命令清單與設定：[Slash commands](/tools/slash-commands)
11. 選用的伺服器情境歷史：設定 `channels.discord.historyLimit`（預設 20，後備為 `messages.groupChat.historyLimit`），在回覆提及時加入最近 N 則伺服器訊息作為情境。設定 `0` 以停用。
12. 表情回應：代理程式可透過 `discord` 工具觸發回應（受 `channels.discord.actions.*` 控制）。
    - 表情移除語義：請見 [/tools/reactions](/tools/reactions)。
    - `discord` 工具僅在目前頻道為 Discord 時才會暴露。
13. 原生命令使用隔離的工作階段鍵（`agent:<agentId>:discord:slash:<userId>`），而非共享的 `main` 工作階段。

注意：名稱 → ID 的解析會使用伺服器成員搜尋，並需要 Server Members Intent；若機器人無法搜尋成員，請使用 ID 或 `<@id>` 提及。
注意：slug 為小寫，空白以 `-` 取代。頻道名稱的 slug 不包含前導的 `#`。
注意：伺服器情境的 `[from:]` 行會包含 `author.tag` + `id`，以方便產生可直接提及的回覆。

## 設定寫入

預設允許 Discord 寫入由 `/config set|unset` 觸發的設定更新（需要 `commands.config: true`）。

停用方式：

```json5
{
  channels: { discord: { configWrites: false } },
}
```

## 如何建立你自己的機器人

以下為在伺服器（guild）頻道（例如 `#help`）中執行 OpenClaw 的「Discord Developer Portal」設定流程。

### 1）建立 Discord 應用程式 + 機器人使用者

1. Discord Developer Portal → **Applications** → **New Application**
2. 在你的應用程式中：
   - **Bot** → **Add Bot**
   - 複製 **Bot Token**（這就是你要放入 `DISCORD_BOT_TOKEN` 的值）

### 2）啟用 OpenClaw 需要的 Gateway intents

Discord 會封鎖「特權 intents」，除非你明確啟用。

在 **Bot** → **Privileged Gateway Intents** 中啟用：

- **Message Content Intent**（在多數伺服器中讀取訊息文字所必需；未啟用會看到「Used disallowed intents」，或機器人能連線但不會對訊息做出反應）
- **Server Members Intent**（建議；在伺服器中進行部分成員／使用者查詢與允許清單比對時必需）

通常 **不需要** **Presence Intent**。設定機器人自己的狀態（`setPresence` 動作）使用 Gateway OP3，無需此 intent；只有在你想接收其他伺服器成員的狀態更新時才需要。

### 3）產生邀請 URL（OAuth2 URL Generator）

在你的應用程式中：**OAuth2** → **URL Generator**

**Scopes**

- ✅ `bot`
- ✅ `applications.commands`（原生命令所需）

**Bot Permissions**（最低基準）

- ✅ View Channels
- ✅ Send Messages
- ✅ Read Message History
- ✅ Embed Links
- ✅ Attach Files
- ✅ Add Reactions（選用但建議）
- ✅ Use External Emojis / Stickers（選用；僅在需要時）

除非你在除錯且完全信任機器人，否則避免 **Administrator**。

複製產生的 URL，開啟它，選擇你的伺服器並安裝機器人。

### 4）取得 ID（伺服器／使用者／頻道）

Discord 到處都使用數字 ID；OpenClaw 設定偏好使用 ID。

1. Discord（桌面／網頁）→ **User Settings** → **Advanced** → 啟用 **Developer Mode**
2. 右鍵：
   - 伺服器名稱 → **Copy Server ID**（guild id）
   - 頻道（例如 `#help`）→ **Copy Channel ID**
   - 你的使用者 → **Copy User ID**

### 5）設定 OpenClaw

#### 權杖

透過環境變數設定機器人權杖（伺服器上建議）：

- `DISCORD_BOT_TOKEN=...`

或透過設定檔：

```json5
{
  channels: {
    discord: {
      enabled: true,
      token: "YOUR_BOT_TOKEN",
    },
  },
}
```

多帳號支援：使用 `channels.discord.accounts`，為每個帳號設定權杖，並可選用 `name`。共享模式請見 [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts)。

#### 允許清單 + 頻道路由

範例：「單一伺服器、只允許我、只允許 #help」：

```json5
{
  channels: {
    discord: {
      enabled: true,
      dm: { enabled: false },
      guilds: {
        YOUR_GUILD_ID: {
          users: ["YOUR_USER_ID"],
          requireMention: true,
          channels: {
            help: { allow: true, requireMention: true },
          },
        },
      },
      retry: {
        attempts: 3,
        minDelayMs: 500,
        maxDelayMs: 30000,
        jitter: 0.1,
      },
    },
  },
}
```

備註：

- `requireMention: true` 表示機器人僅在被提及時才回覆（共享頻道建議）。
- `agents.list[].groupChat.mentionPatterns`（或 `messages.groupChat.mentionPatterns`）也會被視為伺服器訊息中的提及。
- 多代理程式覆寫：在 `agents.list[].groupChat.mentionPatterns` 上設定每代理程式的模式。
- 若存在 `channels`，未列出的任何頻道預設都會被拒絕。
- 使用 `"*"` 的頻道項目可套用所有頻道的預設；明確的頻道項目會覆寫萬用規則。
- 討論串會繼承父頻道的設定（允許清單、`requireMention`、skills、提示等），除非你明確加入討論串的頻道 ID。
- 擁有者提示：當每伺服器或每頻道的 `users` 允許清單命中傳送者時，OpenClaw 會在系統提示中將該傳送者視為擁有者。若要跨頻道的全域擁有者，設定 `commands.ownerAllowFrom`。
- 機器人自己撰寫的訊息預設會被忽略；設定 `channels.discord.allowBots=true` 以允許（自身訊息仍會被過濾）。
- 警告：若你允許回覆其他機器人（`channels.discord.allowBots=true`），請使用 `requireMention`、`channels.discord.guilds.*.channels.<id>.users` 允許清單，和／或在 `AGENTS.md` 與 `SOUL.md` 中清除護欄，以防止機器人互相回覆形成循環。

### 6）驗證是否正常運作

1. 啟動 Gateway 閘道器。
2. 在你的伺服器頻道中傳送：`@Krill hello`（或你的機器人名稱）。
3. 若沒有反應：請檢查下方的 **疑難排解**。

### 疑難排解

- 首先：執行 `openclaw doctor` 與 `openclaw channels status --probe`（可採取行動的警告 + 快速稽核）。
- **「Used disallowed intents」**：在 Developer Portal 中啟用 **Message Content Intent**（很可能也需要 **Server Members Intent**），然後重新啟動 Gateway 閘道器。
- **機器人可連線但在伺服器頻道中從不回覆**：
  - 缺少 **Message Content Intent**，或
  - 機器人缺少頻道權限（View／Send／Read History），或
  - 你的設定需要提及但你未提及它，或
  - 你的伺服器／頻道允許清單拒絕了該頻道／使用者。
- **`requireMention: false` 但仍沒有回覆**：
- `channels.discord.groupPolicy` 預設為 **allowlist**；將其設為 `"open"`，或在 `channels.discord.guilds` 下新增伺服器項目（可選擇在 `channels.discord.guilds.<id>.channels` 下列出頻道以限制）。
  - 若你只設定了 `DISCORD_BOT_TOKEN`，卻從未建立 `channels.discord` 區段，執行階段會將
    `groupPolicy` 預設為 `open`。請新增 `channels.discord.groupPolicy`、
    `channels.defaults.groupPolicy`，或伺服器／頻道允許清單以鎖定。
- `requireMention` 必須位於 `channels.discord.guilds` 之下（或特定頻道）。最上層的 `channels.discord.requireMention` 會被忽略。
- **權限稽核**（`channels status --probe`）只檢查數字頻道 ID。若你使用 slug／名稱作為 `channels.discord.guilds.*.channels` 鍵，稽核將無法驗證權限。
- **私訊無法運作**：`channels.discord.dm.enabled=false`、`channels.discord.dm.policy="disabled"`，或你尚未被核准（`channels.discord.dm.policy="pairing"`）。
- **Discord 中的 Exec 核准**：Discord 在私訊中支援 **按鈕 UI** 進行 Exec 核准（Allow once／Always allow／Deny）。`/approve <id> ...` 僅用於轉送的核准，無法解決 Discord 的按鈕提示。若你看到 `❌ Failed to submit approval: Error: unknown approval id` 或 UI 從未顯示，請檢查：
  - 你的設定中的 `channels.discord.execApprovals.enabled: true`。
  - 你的 Discord 使用者 ID 是否列在 `channels.discord.execApprovals.approvers` 中（UI 僅會傳送給核准者）。
  - 請使用私訊提示中的按鈕（**Allow once**、**Always allow**、**Deny**）。
  - 更完整的核准與命令流程請見 [Exec approvals](/tools/exec-approvals) 與 [Slash commands](/tools/slash-commands)。

## 功能與限制

- 私訊與伺服器文字頻道（討論串視為獨立頻道；不支援語音）。
- 輸入中指示器為盡力而為；訊息分段使用 `channels.discord.textChunkLimit`（預設 2000），並依行數拆分較長回覆（`channels.discord.maxLinesPerMessage`，預設 17）。
- 選用的換行分段：設定 `channels.discord.chunkMode="newline"`，在長度分段前先依空白行（段落邊界）拆分。
- 支援檔案上傳，大小上限為設定的 `channels.discord.mediaMaxMb`（預設 8 MB）。
- 預設以提及作為伺服器回覆的門檻，避免吵雜的機器人。
- 當訊息引用另一則訊息時，會注入回覆情境（引文內容 + ID）。
- 原生回覆串接 **預設關閉**；可透過 `channels.discord.replyToMode` 與回覆標籤啟用。

## 重試策略

對外的 Discord API 呼叫在遇到速率限制（429）時，會在可用時使用 Discord 的 `retry_after`，並搭配指數退避與抖動進行重試。可透過 `channels.discord.retry` 設定。請見 [Retry policy](/concepts/retry)。

## 設定

```json5
{
  channels: {
    discord: {
      enabled: true,
      token: "abc.123",
      groupPolicy: "allowlist",
      guilds: {
        "*": {
          channels: {
            general: { allow: true },
          },
        },
      },
      mediaMaxMb: 8,
      actions: {
        reactions: true,
        stickers: true,
        emojiUploads: true,
        stickerUploads: true,
        polls: true,
        permissions: true,
        messages: true,
        threads: true,
        pins: true,
        search: true,
        memberInfo: true,
        roleInfo: true,
        roles: false,
        channelInfo: true,
        channels: true,
        voiceStatus: true,
        events: true,
        moderation: false,
        presence: false,
      },
      replyToMode: "off",
      dm: {
        enabled: true,
        policy: "pairing", // pairing | allowlist | open | disabled
        allowFrom: ["123456789012345678", "steipete"],
        groupEnabled: false,
        groupChannels: ["openclaw-dm"],
      },
      guilds: {
        "*": { requireMention: true },
        "123456789012345678": {
          slug: "friends-of-openclaw",
          requireMention: false,
          reactionNotifications: "own",
          users: ["987654321098765432", "steipete"],
          channels: {
            general: { allow: true },
            help: {
              allow: true,
              requireMention: true,
              users: ["987654321098765432"],
              skills: ["search", "docs"],
              systemPrompt: "Keep answers short.",
            },
          },
        },
      },
    },
  },
}
```

Ack 表情回應由 `messages.ackReaction` +
`messages.ackReactionScope` 全域控制。使用 `messages.removeAckAfterReply` 可在機器人回覆後清除
ack 表情。

- `dm.enabled`：設定 `false` 以忽略所有私訊（預設 `true`）。
- `dm.policy`：私訊存取控制（建議 `pairing`）。`"open"` 需要 `dm.allowFrom=["*"]`。
- `dm.allowFrom`：私訊允許清單（使用者 ID 或名稱）。供 `dm.policy="allowlist"` 使用，並用於 `dm.policy="open"` 驗證。精靈可接受使用者名稱，且在機器人可搜尋成員時解析為 ID。
- `dm.groupEnabled`：啟用群組私訊（預設 `false`）。
- `dm.groupChannels`：群組私訊頻道 ID 或 slug 的選用允許清單。
- `groupPolicy`：控制伺服器頻道處理（`open|disabled|allowlist`）；`allowlist` 需要頻道允許清單。
- `guilds`：以伺服器 ID（建議）或 slug 為鍵的每伺服器規則。
- `guilds."*"`：當沒有明確項目時套用的每伺服器預設設定。
- `guilds.<id>.slug`：選用的友善 slug，用於顯示名稱。
- `guilds.<id>.users`：選用的每伺服器使用者允許清單（ID 或名稱）。
- `guilds.<id>.tools`：選用的每伺服器工具政策覆寫（`allow`/`deny`/`alsoAllow`），在缺少頻道覆寫時使用。
- `guilds.<id>.toolsBySender`：選用的每傳送者工具政策覆寫（伺服器層級；在缺少頻道覆寫時套用；支援 `"*"` 萬用字元）。
- `guilds.<id>.channels.<channel>.allow`：在 `groupPolicy="allowlist"` 時允許／拒絕該頻道。
- `guilds.<id>.channels.<channel>.requireMention`：該頻道的提及門檻。
- `guilds.<id>.channels.<channel>.tools`：選用的每頻道工具政策覆寫（`allow`/`deny`/`alsoAllow`）。
- `guilds.<id>.channels.<channel>.toolsBySender`：頻道內的選用每傳送者工具政策覆寫（支援 `"*"` 萬用字元）。
- `guilds.<id>.channels.<channel>.users`：選用的每頻道使用者允許清單。
- `guilds.<id>.channels.<channel>.skills`：技能篩選（省略＝全部技能，空集合＝無）。
- `guilds.<id>.channels.<channel>.systemPrompt`：頻道的額外系統提示。Discord 頻道主題會以 **不受信任** 的情境注入（非系統提示）。
- `guilds.<id>.channels.<channel>.enabled`：設定 `false` 以停用該頻道。
- `guilds.<id>.channels`：頻道規則（鍵為頻道 slug 或 ID）。
- `guilds.<id>.requireMention`：每伺服器的提及需求（可由每頻道覆寫）。
- `guilds.<id>.reactionNotifications`：表情反應系統事件模式（`off`、`own`、`all`、`allowlist`）。
- `textChunkLimit`：對外文字分段大小（字元）。預設：2000。
- `chunkMode`：`length`（預設）僅在超過 `textChunkLimit` 時分段；`newline` 會在長度分段前先依空白行（段落邊界）分段。
- `maxLinesPerMessage`：每則訊息的軟性最大行數。預設：17。
- `mediaMaxMb`：限制儲存到磁碟的入站媒體。
- `historyLimit`：回覆提及時納入的最近伺服器訊息數（預設 20；後備為 `messages.groupChat.historyLimit`；`0` 會停用）。
- `dmHistoryLimit`：私訊歷史上限（以使用者回合數計）。每使用者覆寫：`dms["<user_id>"].historyLimit`。
- `retry`：對外 Discord API 呼叫的重試策略（嘗試次數、minDelayMs、maxDelayMs、jitter）。
- `pluralkit`：解析 PluralKit 代理訊息，讓系統成員以不同傳送者呈現。
- `actions`：每動作的工具門檻；省略則允許全部（設定 `false` 以停用）。
  - `reactions`（涵蓋反應 + 讀取反應）
  - `stickers`、`emojiUploads`、`stickerUploads`、`polls`、`permissions`、`messages`、`threads`、`pins`、`search`
  - `memberInfo`、`roleInfo`、`channelInfo`、`voiceStatus`、`events`
  - `channels`（建立／編輯／刪除頻道 + 類別 + 權限）
  - `roles`（角色新增／移除，預設 `false`）
  - `moderation`（禁言／踢出／封鎖，預設 `false`）
  - `presence`（機器人狀態／活動，預設 `false`）
- `execApprovals`：Discord 專用的 Exec 核准私訊（按鈕 UI）。支援 `enabled`、`approvers`、`agentFilter`、`sessionFilter`。

表情反應通知使用 `guilds.<id>.reactionNotifications`：

- `off`：沒有反應事件。
- `own`：機器人自己訊息上的反應（預設）。
- `all`：所有訊息上的所有反應。
- `allowlist`：來自 `guilds.<id>.users` 的反應（所有訊息；空清單會停用）。

### PluralKit（PK）支援

啟用 PK 查詢，讓代理訊息解析為底層系統 + 成員。
啟用後，OpenClaw 會使用成員身分進行允許清單比對，並將
傳送者標示為 `Member (PK:System)`，以避免意外的 Discord 提及。

```json5
{
  channels: {
    discord: {
      pluralkit: {
        enabled: true,
        token: "pk_live_...", // optional; required for private systems
      },
    },
  },
}
```

允許清單備註（已啟用 PK）：

- 在 `dm.allowFrom`、`guilds.<id>.users` 或每頻道的 `users` 中使用 `pk:<memberId>`。
- 也會以名稱／slug 比對成員顯示名稱。
- 查詢使用 **原始** 的 Discord 訊息 ID（代理前的訊息），因此 PK API 僅能在其 30 分鐘視窗內解析。
- 若 PK 查詢失敗（例如私人系統未提供權杖），代理訊息會被視為機器人訊息並被丟棄，除非設定 `channels.discord.allowBots=true`。

### 工具動作預設值

| 動作群組       | 預設值 | 備註                            |
| -------------- | ------ | ------------------------------- |
| reactions      | 啟用   | 反應 + 列出反應 + emojiList     |
| stickers       | 啟用   | 傳送貼圖                        |
| emojiUploads   | 啟用   | 上傳表情符號                    |
| stickerUploads | 啟用   | 上傳貼圖                        |
| polls          | 啟用   | 建立投票                        |
| permissions    | 啟用   | 頻道權限快照                    |
| messages       | 啟用   | 讀取／傳送／編輯／刪除          |
| threads        | 啟用   | 建立／列出／回覆                |
| pins           | 啟用   | 釘選／取消釘選／列出            |
| search         | 啟用   | 訊息搜尋（預覽功能）            |
| memberInfo     | 啟用   | 成員資訊                        |
| roleInfo       | 啟用   | 角色清單                        |
| channelInfo    | 啟用   | 頻道資訊 + 清單                 |
| channels       | 啟用   | 頻道／類別管理                  |
| voiceStatus    | 啟用   | 語音狀態查詢                    |
| events         | 啟用   | 列出／建立排程事件              |
| roles          | 停用   | 角色新增／移除                  |
| moderation     | 停用   | 禁言／踢出／封鎖                |
| presence       | 停用   | 機器人狀態／活動（setPresence） |

- `replyToMode`：`off`（預設）、`first` 或 `all`。僅在模型包含回覆標籤時套用。

## 回覆標籤

若要請求串接回覆，模型可在輸出中包含一個標籤：

- `[[reply_to_current]]` — 回覆觸發的 Discord 訊息。
- `[[reply_to:<id>]]` — 回覆情境／歷史中的特定訊息 ID。
  目前的訊息 ID 會以 `[message_id: …]` 附加到提示中；歷史項目已包含 ID。

行為由 `channels.discord.replyToMode` 控制：

- `off`：忽略標籤。
- `first`：僅第一個對外分段／附件為回覆。
- `all`：每個對外分段／附件都是回覆。

允許清單比對備註：

- `allowFrom`/`users`/`groupChannels` 接受 ID、名稱、標籤或像 `<@id>` 的提及。
- 支援如 `discord:`/`user:`（使用者）與 `channel:`（群組私訊）的前綴。
- 使用 `*` 以允許任何傳送者／頻道。
- 當存在 `guilds.<id>.channels` 時，未列出的頻道預設會被拒絕。
- 當省略 `guilds.<id>.channels` 時，允許清單中的伺服器內所有頻道都會被允許。
- 若要 **不允許任何頻道**，請設定 `channels.discord.groupPolicy: "disabled"`（或保留空的允許清單）。
- 設定精靈可接受 `Guild/Channel` 名稱（公開 + 私有），並在可行時解析為 ID。
- 啟動時，OpenClaw 會將允許清單中的頻道／使用者名稱解析為 ID（當機器人可搜尋成員），並記錄對應；無法解析的項目會保留原樣。

原生命令備註：

- 註冊的命令會映射 OpenClaw 的聊天命令。
- 原生命令遵循與私訊／伺服器訊息相同的允許清單（`channels.discord.dm.allowFrom`、`channels.discord.guilds`、每頻道規則）。
- Slash commands 可能仍會在 Discord UI 中對未在允許清單的使用者可見；OpenClaw 會在執行時強制檢查，並回覆「未獲授權」。

## 工具動作

代理程式可呼叫 `discord` 以執行以下動作：

- `react` / `reactions`（新增或列出反應）
- `sticker`、`poll`、`permissions`
- `readMessages`、`sendMessage`、`editMessage`、`deleteMessage`
- 讀取／搜尋／釘選工具的負載包含正規化的 `timestampMs`（UTC epoch ms）與 `timestampUtc`，以及原始 Discord 的 `timestamp`。
- `threadCreate`、`threadList`、`threadReply`
- `pinMessage`、`unpinMessage`、`listPins`
- `searchMessages`、`memberInfo`、`roleInfo`、`roleAdd`、`roleRemove`、`emojiList`
- `channelInfo`、`channelList`、`voiceStatus`、`eventList`、`eventCreate`
- `timeout`、`kick`、`ban`
- `setPresence`（機器人活動與線上狀態）

Discord 訊息 ID 會在注入的情境（`[discord message id: …]` 與歷史行）中提供，讓代理程式能精準指定目標。
表情符號可為 Unicode（例如 `✅`）或自訂表情語法（如 `<:party_blob:1234567890>`）。

## 安全性與營運

- 將機器人權杖視為密碼；在受管主機上優先使用 `DISCORD_BOT_TOKEN` 環境變數，或鎖定設定檔權限。
- 只授予機器人必要的權限（通常為讀取／傳送訊息）。
- 若機器人卡住或遭遇速率限制，請在確認沒有其他程序佔用 Discord 工作階段後，重新啟動 Gateway 閘道器（`openclaw gateway --force`）。

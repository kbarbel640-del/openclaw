---
summary: "透過 BlueBubbles macOS 伺服器的 iMessage（REST 傳送／接收、輸入中、反應、配對、進階動作）。"
read_when:
  - 設定 BlueBubbles 頻道
  - 疑難排解 webhook 配對
  - 在 macOS 上設定 iMessage
title: "BlueBubbles"
x-i18n:
  source_path: channels/bluebubbles.md
  source_hash: 1414cf657d347ee7
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:42Z
---

# BlueBubbles（macOS REST）

狀態：隨附外掛，透過 HTTP 與 BlueBubbles macOS 伺服器通訊。**建議用於 iMessage 整合**，相較於舊版 imsg 頻道，具備更豐富的 API 與更容易的設定。

## 概覽

- 於 macOS 上透過 BlueBubbles 輔助應用程式執行（[bluebubbles.app](https://bluebubbles.app)）。
- 建議／測試：macOS Sequoia（15）。macOS Tahoe（26）可運作；目前在 Tahoe 上「編輯」功能損壞，群組圖示更新可能回報成功但不會同步。
- OpenClaw 透過其 REST API 與之通訊（`GET /api/v1/ping`、`POST /message/text`、`POST /chat/:id/*`）。
- 來訊透過 webhook 抵達；外送回覆、輸入中指示、已讀回條與 tapback 反應皆為 REST 呼叫。
- 附件與貼圖會以入站媒體匯入（可行時呈現給代理程式）。
- 配對／允許清單的運作方式與其他頻道相同（`/start/pairing` 等），使用 `channels.bluebubbles.allowFrom` + 配對碼。
- 反應會像 Slack／Telegram 一樣以系統事件呈現，代理程式可在回覆前「提及」它們。
- 進階功能：編輯、收回、回覆串接、訊息特效、群組管理。

## 快速開始

1. 在 Mac 上安裝 BlueBubbles 伺服器（請依照 [bluebubbles.app/install](https://bluebubbles.app/install) 的說明）。
2. 在 BlueBubbles 設定中啟用 Web API 並設定密碼。
3. 執行 `openclaw onboard` 並選擇 BlueBubbles，或手動設定：
   ```json5
   {
     channels: {
       bluebubbles: {
         enabled: true,
         serverUrl: "http://192.168.1.100:1234",
         password: "example-password",
         webhookPath: "/bluebubbles-webhook",
       },
     },
   }
   ```
4. 將 BlueBubbles 的 webhook 指向你的 Gateway 閘道器（例如：`https://your-gateway-host:3000/bluebubbles-webhook?password=<password>`）。
5. 啟動 Gateway 閘道器；它會註冊 webhook 處理器並開始配對。

## 讓 Messages.app 保持運作（VM／無頭設定）

某些 macOS VM／長時間運作的設定，可能會讓 Messages.app 進入「閒置」（來訊事件停止，直到開啟或前景化應用程式）。一個簡單的解法是使用 AppleScript + LaunchAgent **每 5 分鐘戳一下 Messages**。

### 1) 儲存 AppleScript

另存為：

- `~/Scripts/poke-messages.scpt`

範例腳本（非互動式；不會搶走焦點）：

```applescript
try
  tell application "Messages"
    if not running then
      launch
    end if

    -- Touch the scripting interface to keep the process responsive.
    set _chatCount to (count of chats)
  end tell
on error
  -- Ignore transient failures (first-run prompts, locked session, etc).
end try
```

### 2) 安裝 LaunchAgent

另存為：

- `~/Library/LaunchAgents/com.user.poke-messages.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.user.poke-messages</string>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>-lc</string>
      <string>/usr/bin/osascript &quot;$HOME/Scripts/poke-messages.scpt&quot;</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>StartInterval</key>
    <integer>300</integer>

    <key>StandardOutPath</key>
    <string>/tmp/poke-messages.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/poke-messages.err</string>
  </dict>
</plist>
```

注意事項：

- 此作業 **每 300 秒** 與 **登入時** 皆會執行。
- 第一次執行可能會觸發 macOS **自動化** 提示（`osascript` → Messages）。請在執行 LaunchAgent 的同一使用者工作階段中核准。

載入：

```bash
launchctl unload ~/Library/LaunchAgents/com.user.poke-messages.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.user.poke-messages.plist
```

## 入門引導

BlueBubbles 可在互動式設定精靈中選擇：

```
openclaw onboard
```

精靈會要求：

- **伺服器 URL**（必填）：BlueBubbles 伺服器位址（例如：`http://192.168.1.100:1234`）
- **密碼**（必填）：BlueBubbles Server 設定中的 API 密碼
- **Webhook 路徑**（選填）：預設為 `/bluebubbles-webhook`
- **私訊政策**：配對、允許清單、開放或停用
- **允許清單**：電話號碼、電子郵件或聊天目標

你也可以透過 CLI 新增 BlueBubbles：

```
openclaw channels add bluebubbles --http-url http://192.168.1.100:1234 --password <password>
```

## 存取控制（私訊 + 群組）

私訊：

- 預設：`channels.bluebubbles.dmPolicy = "pairing"`。
- 未知寄件者會收到配對碼；在核准前訊息會被忽略（配對碼 1 小時後過期）。
- 核准方式：
  - `openclaw pairing list bluebubbles`
  - `openclaw pairing approve bluebubbles <CODE>`
- 配對是預設的權杖交換機制。詳情：[Pairing](/start/pairing)

群組：

- `channels.bluebubbles.groupPolicy = open | allowlist | disabled`（預設：`allowlist`）。
- 當設定為 `allowlist` 時，`channels.bluebubbles.groupAllowFrom` 會控制誰能在群組中觸發。

### 提及門檻（群組）

BlueBubbles 支援群組聊天的提及門檻，行為與 iMessage／WhatsApp 相同：

- 使用 `agents.list[].groupChat.mentionPatterns`（或 `messages.groupChat.mentionPatterns`）偵測提及。
- 當群組啟用 `requireMention` 時，代理程式僅在被提及時回應。
- 來自已授權寄件者的控制指令可略過提及門檻。

每個群組的設定：

```json5
{
  channels: {
    bluebubbles: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15555550123"],
      groups: {
        "*": { requireMention: true }, // default for all groups
        "iMessage;-;chat123": { requireMention: false }, // override for specific group
      },
    },
  },
}
```

### 指令門檻

- 控制指令（例如：`/config`、`/model`）需要授權。
- 使用 `allowFrom` 與 `groupAllowFrom` 判定指令授權。
- 已授權寄件者即使在群組中未被提及，也可執行控制指令。

## 輸入中 + 已讀回條

- **輸入中指示**：在產生回覆前與過程中自動送出。
- **已讀回條**：由 `channels.bluebubbles.sendReadReceipts` 控制（預設：`true`）。
- **輸入中指示**：OpenClaw 送出輸入開始事件；BlueBubbles 會在送出或逾時時自動清除（以 DELETE 手動停止不可靠）。

```json5
{
  channels: {
    bluebubbles: {
      sendReadReceipts: false, // disable read receipts
    },
  },
}
```

## 進階動作

在設定中啟用後，BlueBubbles 支援進階訊息動作：

```json5
{
  channels: {
    bluebubbles: {
      actions: {
        reactions: true, // tapbacks (default: true)
        edit: true, // edit sent messages (macOS 13+, broken on macOS 26 Tahoe)
        unsend: true, // unsend messages (macOS 13+)
        reply: true, // reply threading by message GUID
        sendWithEffect: true, // message effects (slam, loud, etc.)
        renameGroup: true, // rename group chats
        setGroupIcon: true, // set group chat icon/photo (flaky on macOS 26 Tahoe)
        addParticipant: true, // add participants to groups
        removeParticipant: true, // remove participants from groups
        leaveGroup: true, // leave group chats
        sendAttachment: true, // send attachments/media
      },
    },
  },
}
```

可用動作：

- **react**：新增／移除 tapback 反應（`messageId`、`emoji`、`remove`）
- **edit**：編輯已送出的訊息（`messageId`、`text`）
- **unsend**：收回訊息（`messageId`）
- **reply**：回覆特定訊息（`messageId`、`text`、`to`）
- **sendWithEffect**：以 iMessage 特效送出（`text`、`to`、`effectId`）
- **renameGroup**：重新命名群組聊天（`chatGuid`、`displayName`）
- **setGroupIcon**：設定群組聊天的圖示／照片（`chatGuid`、`media`）— 在 macOS 26 Tahoe 上不穩定（API 可能回傳成功但圖示未同步）。
- **addParticipant**：將成員加入群組（`chatGuid`、`address`）
- **removeParticipant**：將成員移出群組（`chatGuid`、`address`）
- **leaveGroup**：離開群組聊天（`chatGuid`）
- **sendAttachment**：傳送媒體／檔案（`to`、`buffer`、`filename`、`asVoice`）
  - 語音備忘錄：設定 `asVoice: true` 為 **MP3** 或 **CAF** 音訊，即可作為 iMessage 語音訊息送出。BlueBubbles 會在送出語音備忘錄時將 MP3 轉換為 CAF。

### 訊息 ID（短版 vs 完整）

OpenClaw 可能會呈現「短版」訊息 ID（例如：`1`、`2`）以節省權杖。

- `MessageSid`／`ReplyToId` 可能是短 ID。
- `MessageSidFull`／`ReplyToIdFull` 包含提供者的完整 ID。
- 短 ID 僅存在於記憶體中；重新啟動或快取清除後可能過期。
- 動作可接受短或完整 `messageId`，但若短 ID 已不可用將回報錯誤。

為了耐久的自動化與儲存，請使用完整 ID：

- 範本：`{{MessageSidFull}}`、`{{ReplyToIdFull}}`
- 內容：入站負載中的 `MessageSidFull`／`ReplyToIdFull`

範本變數請參閱 [Configuration](/gateway/configuration)。

## 區塊串流

控制回覆是以單一訊息送出，或以區塊串流方式送出：

```json5
{
  channels: {
    bluebubbles: {
      blockStreaming: true, // enable block streaming (off by default)
    },
  },
}
```

## 媒體 + 限制

- 入站附件會下載並儲存在媒體快取中。
- 媒體上限由 `channels.bluebubbles.mediaMaxMb` 控制（預設：8 MB）。
- 外送文字會切分至 `channels.bluebubbles.textChunkLimit`（預設：4000 個字元）。

## 設定參考

完整設定：[Configuration](/gateway/configuration)

提供者選項：

- `channels.bluebubbles.enabled`：啟用／停用頻道。
- `channels.bluebubbles.serverUrl`：BlueBubbles REST API 基底 URL。
- `channels.bluebubbles.password`：API 密碼。
- `channels.bluebubbles.webhookPath`：Webhook 端點路徑（預設：`/bluebubbles-webhook`）。
- `channels.bluebubbles.dmPolicy`：`pairing | allowlist | open | disabled`（預設：`pairing`）。
- `channels.bluebubbles.allowFrom`：私訊允許清單（帳號、電子郵件、E.164 號碼、`chat_id:*`、`chat_guid:*`）。
- `channels.bluebubbles.groupPolicy`：`open | allowlist | disabled`（預設：`allowlist`）。
- `channels.bluebubbles.groupAllowFrom`：群組寄件者允許清單。
- `channels.bluebubbles.groups`：每群組設定（`requireMention` 等）。
- `channels.bluebubbles.sendReadReceipts`：送出已讀回條（預設：`true`）。
- `channels.bluebubbles.blockStreaming`：啟用區塊串流（預設：`false`；串流回覆必需）。
- `channels.bluebubbles.textChunkLimit`：外送切塊大小（字元）（預設：4000）。
- `channels.bluebubbles.chunkMode`：`length`（預設）僅在超過 `textChunkLimit` 時分割；`newline` 會在長度切塊前於空白行（段落邊界）分割。
- `channels.bluebubbles.mediaMaxMb`：入站媒體上限（MB）（預設：8）。
- `channels.bluebubbles.historyLimit`：上下文的最大群組訊息數（0 代表停用）。
- `channels.bluebubbles.dmHistoryLimit`：私訊歷史上限。
- `channels.bluebubbles.actions`：啟用／停用特定動作。
- `channels.bluebubbles.accounts`：多帳號設定。

相關的全域選項：

- `agents.list[].groupChat.mentionPatterns`（或 `messages.groupChat.mentionPatterns`）。
- `messages.responsePrefix`。

## 定址／投遞目標

為了穩定的路由，優先使用 `chat_guid`：

- `chat_guid:iMessage;-;+15555550123`（群組建議）
- `chat_id:123`
- `chat_identifier:...`
- 直接帳號：`+15555550123`、`user@example.com`
  - 若直接帳號尚無既有私訊聊天，OpenClaw 會透過 `POST /api/v1/chat/new` 建立一個。這需要啟用 BlueBubbles Private API。

## 安全性

- Webhook 請求會透過比對 `guid`／`password` 的查詢參數或標頭與 `channels.bluebubbles.password` 來進行驗證。來自 `localhost` 的請求也會被接受。
- 請妥善保管 API 密碼與 webhook 端點（視同憑證）。
- Localhost 信任代表同主機的反向代理可能無意間繞過密碼。若你為 Gateway 閘道器設置代理，請在代理層要求驗證，並設定 `gateway.trustedProxies`。請參閱 [Gateway security](/gateway/security#reverse-proxy-configuration)。
- 若需對外公開 BlueBubbles 伺服器，請啟用 HTTPS 與防火牆規則。

## 疑難排解

- 若輸入中／已讀事件停止運作，請檢查 BlueBubbles 的 webhook 記錄，並確認 Gateway 路徑符合 `channels.bluebubbles.webhookPath`。
- 配對碼在 1 小時後過期；請使用 `openclaw pairing list bluebubbles` 與 `openclaw pairing approve bluebubbles <code>`。
- 反應需要 BlueBubbles 的 Private API（`POST /api/v1/message/react`）；請確認伺服器版本已提供。
- 編輯／收回需要 macOS 13+ 與相容的 BlueBubbles 伺服器版本。在 macOS 26（Tahoe）上，因 Private API 變更，目前「編輯」功能損壞。
- 群組圖示更新在 macOS 26（Tahoe）上可能不穩定：API 可能回傳成功，但新圖示不會同步。
- OpenClaw 會依 BlueBubbles 伺服器的 macOS 版本自動隱藏已知損壞的動作。若在 macOS 26（Tahoe）仍顯示「編輯」，請使用 `channels.bluebubbles.actions.edit=false` 手動停用。
- 狀態／健康資訊：`openclaw status --all` 或 `openclaw status --deep`。

一般頻道流程請參閱 [Channels](/channels) 與 [Plugins](/plugins) 指南。

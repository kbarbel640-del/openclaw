---
summary: 「Microsoft Teams 機器人支援狀態、功能與設定」
read_when:
  - 進行 MS Teams 頻道功能開發時
title: 「Microsoft Teams」
x-i18n:
  source_path: channels/msteams.md
  source_hash: 2046cb8fa3dd349f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:23Z
---

# Microsoft Teams（外掛）

> 「凡入此門者，放棄一切希望。」

更新日期：2026-01-21

狀態：支援文字與 私訊 附件；頻道／群組檔案傳送需要 `sharePointSiteId` + Graph 權限（請參閱〈[在群組聊天中傳送檔案](#sending-files-in-group-chats)〉）。投票透過 Adaptive Cards 傳送。

## 需要外掛

Microsoft Teams 以外掛形式提供，未隨核心安裝一併包含。

**重大變更（2026.1.15）：** MS Teams 已自核心移出。若要使用，必須安裝外掛。

原因說明：讓核心安裝更精簡，並可讓 MS Teams 相依套件獨立更新。

透過 CLI 安裝（npm registry）：

```bash
openclaw plugins install @openclaw/msteams
```

本機檢出（從 git repo 執行時）：

```bash
openclaw plugins install ./extensions/msteams
```

若在設定／入門引導時選擇 Teams，且偵測到 git 檢出，
OpenClaw 會自動提供本機安裝路徑。

詳情：[Plugins](/plugin)

## 快速設定（新手）

1. 安裝 Microsoft Teams 外掛。
2. 建立 **Azure Bot**（App ID + 用戶端密鑰 + 租用戶 ID）。
3. 使用上述憑證設定 OpenClaw。
4. 透過公開 URL 或通道暴露 `/api/messages`（預設連接埠 3978）。
5. 安裝 Teams 應用程式套件並啟動 Gateway 閘道器。

最小設定：

```json5
{
  channels: {
    msteams: {
      enabled: true,
      appId: "<APP_ID>",
      appPassword: "<APP_PASSWORD>",
      tenantId: "<TENANT_ID>",
      webhook: { port: 3978, path: "/api/messages" },
    },
  },
}
```

注意：群組聊天預設為封鎖（`channels.msteams.groupPolicy: "allowlist"`）。若要允許群組回覆，請設定 `channels.msteams.groupAllowFrom`（或使用 `groupPolicy: "open"` 允許任何成員，需提及門檻）。

## 目標

- 透過 Teams 私訊、群組聊天或頻道與 OpenClaw 對話。
- 保持路由確定性：回覆一律回到原始頻道。
- 預設採安全的頻道行為（除非另行設定，否則需要提及）。

## 設定寫入

預設情況下，Microsoft Teams 允許由 `/config set|unset` 觸發的設定更新（需要 `commands.config: true`）。

停用方式：

```json5
{
  channels: { msteams: { configWrites: false } },
}
```

## 存取控制（私訊 + 群組）

**私訊存取**

- 預設：`channels.msteams.dmPolicy = "pairing"`。未知傳送者在核准前會被忽略。
- `channels.msteams.allowFrom` 接受 AAD 物件 ID、UPN 或顯示名稱。當憑證允許時，精靈會透過 Microsoft Graph 將名稱解析為 ID。

**群組存取**

- 預設：`channels.msteams.groupPolicy = "allowlist"`（除非加入 `groupAllowFrom`，否則封鎖）。若未設定，使用 `channels.defaults.groupPolicy` 覆寫預設。
- `channels.msteams.groupAllowFrom` 控制哪些傳送者可在群組聊天／頻道中觸發（回退至 `channels.msteams.allowFrom`）。
- 設定 `groupPolicy: "open"` 以允許任何成員（預設仍需提及）。
- 若要**不允許任何頻道**，請設定 `channels.msteams.groupPolicy: "disabled"`。

範例：

```json5
{
  channels: {
    msteams: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["user@org.com"],
    },
  },
}
```

**Teams + 頻道允許清單**

- 透過在 `channels.msteams.teams` 下列出團隊與頻道，限制群組／頻道回覆範圍。
- 金鑰可使用團隊 ID 或名稱；頻道金鑰可使用對話 ID 或名稱。
- 當設定 `groupPolicy="allowlist"` 且存在 teams 允許清單時，只接受列出的團隊／頻道（需提及）。
- 設定精靈接受 `Team/Channel` 項目並為你儲存。
- 啟動時，OpenClaw 會在 Graph 權限允許下，將團隊／頻道與使用者允許清單名稱解析為 ID，
  並記錄對應關係；無法解析的項目會保留原樣。

範例：

```json5
{
  channels: {
    msteams: {
      groupPolicy: "allowlist",
      teams: {
        "My Team": {
          channels: {
            General: { requireMention: true },
          },
        },
      },
    },
  },
}
```

## 運作方式

1. 安裝 Microsoft Teams 外掛。
2. 建立 **Azure Bot**（App ID + 密鑰 + 租用戶 ID）。
3. 建立 **Teams 應用程式套件**，引用該機器人並包含下方 RSC 權限。
4. 將 Teams 應用程式上傳／安裝到團隊（或私人體驗範圍以支援 私訊）。
5. 在 `~/.openclaw/openclaw.json`（或 環境變數）中設定 `msteams`，並啟動 Gateway 閘道器。
6. Gateway 閘道器 預設在 `/api/messages` 監聽 Bot Framework Webhook 流量。

## Azure Bot 設定（先決條件）

在設定 OpenClaw 之前，需要建立 Azure Bot 資源。

### 步驟 1：建立 Azure Bot

1. 前往 [建立 Azure Bot](https://portal.azure.com/#create/Microsoft.AzureBot)
2. 填寫 **Basics** 分頁：

   | 欄位               | 值                                                  |
   | ------------------ | --------------------------------------------------- |
   | **Bot handle**     | 你的機器人名稱，例如 `openclaw-msteams`（必須唯一） |
   | **Subscription**   | 選擇你的 Azure 訂用帳戶                             |
   | **Resource group** | 建立新的或使用既有的                                |
   | **Pricing tier**   | **Free**（適用於開發／測試）                        |
   | **Type of App**    | **Single Tenant**（建議，請見下方註解）             |
   | **Creation type**  | **Create new Microsoft App ID**                     |

> **淘汰公告：** 於 2025-07-31 之後，建立新的多租用戶機器人已淘汰。新機器人請使用 **Single Tenant**。

3. 點擊 **Review + create** → **Create**（等待約 1–2 分鐘）

### 步驟 2：取得憑證

1. 前往你的 Azure Bot 資源 → **Configuration**
2. 複製 **Microsoft App ID** → 這就是你的 `appId`
3. 點擊 **Manage Password** → 前往 App Registration
4. 在 **Certificates & secrets** → **New client secret** → 複製 **Value** → 這是你的 `appPassword`
5. 前往 **Overview** → 複製 **Directory (tenant) ID** → 這是你的 `tenantId`

### 步驟 3：設定 Messaging Endpoint

1. 在 Azure Bot → **Configuration**
2. 將 **Messaging endpoint** 設為你的 Webhook URL：
   - 正式環境：`https://your-domain.com/api/messages`
   - 本機開發：使用通道（請見下方〈[本機開發](#local-development-tunneling)〉）

### 步驟 4：啟用 Teams 頻道

1. 在 Azure Bot → **Channels**
2. 點擊 **Microsoft Teams** → Configure → Save
3. 接受服務條款

## 本機開發（通道）

Teams 無法存取 `localhost`。本機開發請使用通道：

**選項 A：ngrok**

```bash
ngrok http 3978
# Copy the https URL, e.g., https://abc123.ngrok.io
# Set messaging endpoint to: https://abc123.ngrok.io/api/messages
```

**選項 B：Tailscale Funnel**

```bash
tailscale funnel 3978
# Use your Tailscale funnel URL as the messaging endpoint
```

## Teams Developer Portal（替代方案）

你可以使用 [Teams Developer Portal](https://dev.teams.microsoft.com/apps) 取代手動建立 manifest ZIP：

1. 點擊 **+ New app**
2. 填寫基本資訊（名稱、描述、開發者資訊）
3. 前往 **App features** → **Bot**
4. 選擇 **Enter a bot ID manually** 並貼上你的 Azure Bot App ID
5. 勾選範圍：**Personal**、**Team**、**Group Chat**
6. 點擊 **Distribute** → **Download app package**
7. 在 Teams：**Apps** → **Manage your apps** → **Upload a custom app** → 選擇 ZIP

這通常比手動編輯 JSON manifest 更容易。

## 測試機器人

**選項 A：Azure Web Chat（先驗證 Webhook）**

1. Azure Portal → 你的 Azure Bot 資源 → **Test in Web Chat**
2. 傳送訊息——應可看到回覆
3. 這可在設定 Teams 之前確認 Webhook 端點可用

**選項 B：Teams（安裝應用程式後）**

1. 安裝 Teams 應用程式（側載或組織目錄）
2. 在 Teams 中找到機器人並傳送 私訊
3. 檢查 Gateway 閘道器 日誌是否有進站活動

## 設定（最小文字版）

1. **安裝 Microsoft Teams 外掛**
   - 來自 npm：`openclaw plugins install @openclaw/msteams`
   - 來自本機檢出：`openclaw plugins install ./extensions/msteams`

2. **機器人註冊**
   - 建立 Azure Bot（見上文）並記下：
     - App ID
     - 用戶端密鑰（App 密碼）
     - 租用戶 ID（單一租用戶）

3. **Teams 應用程式 manifest**
   - 包含 `bot` 項目，並設定為 `botId = <App ID>`。
   - 範圍：`personal`、`team`、`groupChat`。
   - `supportsFiles: true`（私人體驗範圍的檔案處理需要）。
   - 加入 RSC 權限（見下文）。
   - 建立圖示：`outline.png`（32x32）與 `color.png`（192x192）。
   - 將三個檔案一起壓縮：`manifest.json`、`outline.png`、`color.png`。

4. **設定 OpenClaw**

   ```json
   {
     "msteams": {
       "enabled": true,
       "appId": "<APP_ID>",
       "appPassword": "<APP_PASSWORD>",
       "tenantId": "<TENANT_ID>",
       "webhook": { "port": 3978, "path": "/api/messages" }
     }
   }
   ```

   也可使用 環境變數 取代設定鍵：
   - `MSTEAMS_APP_ID`
   - `MSTEAMS_APP_PASSWORD`
   - `MSTEAMS_TENANT_ID`

5. **機器人端點**
   - 將 Azure Bot Messaging Endpoint 設為：
     - `https://<host>:3978/api/messages`（或你選擇的路徑／連接埠）。

6. **執行 Gateway 閘道器**
   - 安裝外掛且存在含憑證的 `msteams` 設定後，Teams 頻道會自動啟動。

## 歷史內容脈絡

- `channels.msteams.historyLimit` 控制包裝進提示中的最近頻道／群組訊息數量。
- 會回退至 `messages.groupChat.historyLimit`。設定 `0` 可停用（預設 50）。
- 私訊 歷史可透過 `channels.msteams.dmHistoryLimit`（使用者回合數）限制。每位使用者覆寫：`channels.msteams.dms["<user_id>"].historyLimit`。

## 目前 Teams RSC 權限（Manifest）

以下為 Teams 應用程式 manifest 中**現有的 resourceSpecific 權限**。僅適用於安裝該應用程式的團隊／聊天。

**頻道（團隊範圍）：**

- `ChannelMessage.Read.Group`（Application）— 不需 @提及 即可接收所有頻道訊息
- `ChannelMessage.Send.Group`（Application）
- `Member.Read.Group`（Application）
- `Owner.Read.Group`（Application）
- `ChannelSettings.Read.Group`（Application）
- `TeamMember.Read.Group`（Application）
- `TeamSettings.Read.Group`（Application）

**群組聊天：**

- `ChatMessage.Read.Chat`（Application）— 不需 @提及 即可接收所有群組聊天訊息

## Teams Manifest 範例（已去識別）

包含必要欄位的最小有效範例。請替換 ID 與 URL。

```json
{
  "$schema": "https://developer.microsoft.com/en-us/json-schemas/teams/v1.23/MicrosoftTeams.schema.json",
  "manifestVersion": "1.23",
  "version": "1.0.0",
  "id": "00000000-0000-0000-0000-000000000000",
  "name": { "short": "OpenClaw" },
  "developer": {
    "name": "Your Org",
    "websiteUrl": "https://example.com",
    "privacyUrl": "https://example.com/privacy",
    "termsOfUseUrl": "https://example.com/terms"
  },
  "description": { "short": "OpenClaw in Teams", "full": "OpenClaw in Teams" },
  "icons": { "outline": "outline.png", "color": "color.png" },
  "accentColor": "#5B6DEF",
  "bots": [
    {
      "botId": "11111111-1111-1111-1111-111111111111",
      "scopes": ["personal", "team", "groupChat"],
      "isNotificationOnly": false,
      "supportsCalling": false,
      "supportsVideo": false,
      "supportsFiles": true
    }
  ],
  "webApplicationInfo": {
    "id": "11111111-1111-1111-1111-111111111111"
  },
  "authorization": {
    "permissions": {
      "resourceSpecific": [
        { "name": "ChannelMessage.Read.Group", "type": "Application" },
        { "name": "ChannelMessage.Send.Group", "type": "Application" },
        { "name": "Member.Read.Group", "type": "Application" },
        { "name": "Owner.Read.Group", "type": "Application" },
        { "name": "ChannelSettings.Read.Group", "type": "Application" },
        { "name": "TeamMember.Read.Group", "type": "Application" },
        { "name": "TeamSettings.Read.Group", "type": "Application" },
        { "name": "ChatMessage.Read.Chat", "type": "Application" }
      ]
    }
  }
}
```

### Manifest 注意事項（必填欄位）

- `bots[].botId` **必須** 與 Azure Bot App ID 相符。
- `webApplicationInfo.id` **必須** 與 Azure Bot App ID 相符。
- `bots[].scopes` 必須包含你計畫使用的介面（`personal`、`team`、`groupChat`）。
- `bots[].supportsFiles: true` 為私人體驗範圍檔案處理所需。
- `authorization.permissions.resourceSpecific` 若要使用頻道流量，必須包含讀取／傳送權限。

### 更新既有應用程式

要更新已安裝的 Teams 應用程式（例如新增 RSC 權限）：

1. 使用新設定更新你的 `manifest.json`
2. **遞增 `version` 欄位**（例如 `1.0.0` → `1.1.0`）
3. **重新壓縮** manifest 與圖示（`manifest.json`、`outline.png`、`color.png`）
4. 上傳新的 ZIP：
   - **選項 A（Teams Admin Center）：** Teams Admin Center → Teams apps → Manage apps → 找到你的應用程式 → Upload new version
   - **選項 B（側載）：** 在 Teams → Apps → Manage your apps → Upload a custom app
5. **團隊頻道：** 於每個團隊中重新安裝應用程式，讓新權限生效
6. **完全結束並重新啟動 Teams**（不只是關閉視窗），以清除快取的應用程式中繼資料

## 功能：僅 RSC vs Graph

### 僅使用 **Teams RSC**（已安裝應用程式，無 Graph API 權限）

可用：

- 讀取頻道訊息的**文字**內容。
- 傳送頻道訊息的**文字**內容。
- 接收**私人體驗（私訊）**檔案附件。

不可用：

- 頻道／群組的**圖片或檔案內容**（負載僅包含 HTML 佔位）。
- 下載儲存在 SharePoint／OneDrive 的附件。
- 讀取訊息歷史（僅限即時 Webhook 事件）。

### **Teams RSC + Microsoft Graph Application 權限**

新增：

- 下載託管內容（貼在訊息中的圖片）。
- 下載儲存在 SharePoint／OneDrive 的檔案附件。
- 透過 Graph 讀取頻道／聊天訊息歷史。

### RSC 與 Graph API 比較

| 功能           | RSC 權限              | Graph API                   |
| -------------- | --------------------- | --------------------------- |
| **即時訊息**   | 是（透過 Webhook）    | 否（僅輪詢）                |
| **歷史訊息**   | 否                    | 是（可查詢歷史）            |
| **設定複雜度** | 僅需應用程式 manifest | 需要管理員同意 + Token 流程 |
| **離線可用**   | 否（必須運行中）      | 是（可隨時查詢）            |

**結論：** RSC 用於即時監聽；Graph API 用於歷史存取。若需在離線後補抓遺漏訊息，必須使用具備 `ChannelMessage.Read.All` 的 Graph API（需要管理員同意）。

## 啟用 Graph 的媒體 + 歷史（頻道必需）

若需要**頻道**中的圖片／檔案，或要擷取**訊息歷史**，必須啟用 Microsoft Graph 權限並取得管理員同意。

1. 在 Entra ID（Azure AD）**App Registration** 中新增 Microsoft Graph **Application 權限**：
   - `ChannelMessage.Read.All`（頻道附件 + 歷史）
   - `Chat.Read.All` 或 `ChatMessage.Read.All`（群組聊天）
2. **為租用戶授予管理員同意**。
3. 提升 Teams 應用程式 **manifest 版本**，重新上傳，並**在 Teams 中重新安裝應用程式**。
4. **完全結束並重新啟動 Teams**，清除快取的應用程式中繼資料。

## 已知限制

### Webhook 逾時

Teams 透過 HTTP Webhook 傳遞訊息。若處理時間過長（例如 LLM 回應很慢），可能會出現：

- Gateway 閘道器 逾時
- Teams 重試訊息（造成重複）
- 回覆遺失

OpenClaw 會快速回傳並以主動方式傳送回覆，但極慢的回應仍可能造成問題。

### 格式

Teams 的 Markdown 功能較 Slack 或 Discord 受限：

- 基本格式可用：**粗體**、_斜體_、`code`、連結
- 複雜 Markdown（表格、巢狀清單）可能無法正確呈現
- 投票與任意卡片支援 Adaptive Cards（見下文）

## 設定

主要設定（共享頻道模式請見 `/gateway/configuration`）：

- `channels.msteams.enabled`：啟用／停用頻道。
- `channels.msteams.appId`、`channels.msteams.appPassword`、`channels.msteams.tenantId`：機器人憑證。
- `channels.msteams.webhook.port`（預設 `3978`）
- `channels.msteams.webhook.path`（預設 `/api/messages`）
- `channels.msteams.dmPolicy`：`pairing | allowlist | open | disabled`（預設：配對）
- `channels.msteams.allowFrom`：私訊允許清單（AAD 物件 ID、UPN 或顯示名稱）。在可用 Graph 存取時，精靈會於設定期間將名稱解析為 ID。
- `channels.msteams.textChunkLimit`：外送文字分段大小。
- `channels.msteams.chunkMode`：`length`（預設）或 `newline`，在長度分段前先依空白行（段落邊界）分割。
- `channels.msteams.mediaAllowHosts`：入站附件主機允許清單（預設為 Microsoft／Teams 網域）。
- `channels.msteams.mediaAuthAllowHosts`：媒體重試時附加 Authorization 標頭的主機允許清單（預設為 Graph + Bot Framework 主機）。
- `channels.msteams.requireMention`：在頻道／群組中需要 @提及（預設 true）。
- `channels.msteams.replyStyle`：`thread | top-level`（請見〈[回覆樣式](#reply-style-threads-vs-posts)〉）。
- `channels.msteams.teams.<teamId>.replyStyle`：每個團隊覆寫。
- `channels.msteams.teams.<teamId>.requireMention`：每個團隊覆寫。
- `channels.msteams.teams.<teamId>.tools`：每團隊的預設工具政策覆寫（`allow`/`deny`/`alsoAllow`），在缺少頻道覆寫時使用。
- `channels.msteams.teams.<teamId>.toolsBySender`：每團隊、每傳送者的預設工具政策覆寫（支援 `"*"` 萬用字元）。
- `channels.msteams.teams.<teamId>.channels.<conversationId>.replyStyle`：每頻道覆寫。
- `channels.msteams.teams.<teamId>.channels.<conversationId>.requireMention`：每頻道覆寫。
- `channels.msteams.teams.<teamId>.channels.<conversationId>.tools`：每頻道工具政策覆寫（`allow`/`deny`/`alsoAllow`）。
- `channels.msteams.teams.<teamId>.channels.<conversationId>.toolsBySender`：每頻道、每傳送者工具政策覆寫（支援 `"*"` 萬用字元）。
- `channels.msteams.sharePointSiteId`：群組聊天／頻道上傳檔案所用的 SharePoint 站台 ID（請見〈[在群組聊天中傳送檔案](#sending-files-in-group-chats)〉）。

## 路由與工作階段

- 工作階段金鑰遵循標準代理程式格式（請見 [/concepts/session](/concepts/session)）：
  - 私訊 共享主要工作階段（`agent:<agentId>:<mainKey>`）。
  - 頻道／群組訊息使用對話 ID：
    - `agent:<agentId>:msteams:channel:<conversationId>`
    - `agent:<agentId>:msteams:group:<conversationId>`

## 回覆樣式：Threads vs Posts

Teams 近期在相同的底層資料模型上引入兩種頻道 UI 樣式：

| 樣式                    | 說明                           | 建議的 `replyStyle` |
| ----------------------- | ------------------------------ | ------------------- |
| **Posts**（經典）       | 訊息以卡片顯示，下方有串狀回覆 | `thread`（預設）    |
| **Threads**（類 Slack） | 訊息線性流動，類似 Slack       | `top-level`         |

**問題：** Teams API 不會揭露頻道使用的 UI 樣式。若使用錯誤的 `replyStyle`：

- 在 Threads 樣式頻道中使用 `thread` → 回覆會顯得尷尬地巢狀
- 在 Posts 樣式頻道中使用 `top-level` → 回覆會成為獨立的頂層貼文，而非串內

**解法：** 依頻道設定，逐一設定 `replyStyle`：

```json
{
  "msteams": {
    "replyStyle": "thread",
    "teams": {
      "19:abc...@thread.tacv2": {
        "channels": {
          "19:xyz...@thread.tacv2": {
            "replyStyle": "top-level"
          }
        }
      }
    }
  }
}
```

## 附件與圖片

**目前限制：**

- **私訊：** 圖片與檔案附件可透過 Teams 機器人檔案 API 使用。
- **頻道／群組：** 附件位於 M365 儲存體（SharePoint／OneDrive）。Webhook 負載僅包含 HTML 佔位，不含實際檔案位元組。**需要 Graph API 權限** 才能下載頻道附件。

若無 Graph 權限，含圖片的頻道訊息只會以純文字接收（機器人無法存取圖片內容）。
預設情況下，OpenClaw 僅從 Microsoft／Teams 主機名稱下載媒體。可用 `channels.msteams.mediaAllowHosts` 覆寫（使用 `["*"]` 允許任何主機）。
Authorization 標頭僅會附加於 `channels.msteams.mediaAuthAllowHosts` 中的主機（預設為 Graph + Bot Framework 主機）。請保持清單嚴格（避免多租用戶尾碼）。

## 在群組聊天中傳送檔案

機器人可在 私訊 中使用 FileConsentCard 流程（內建）傳送檔案。然而，**在群組聊天／頻道中傳送檔案** 需要額外設定：

| 情境                 | 檔案傳送方式                              | 需要的設定                           |
| -------------------- | ----------------------------------------- | ------------------------------------ |
| **私訊**             | FileConsentCard → 使用者接受 → 機器人上傳 | 開箱即用                             |
| **群組聊天／頻道**   | 上傳至 SharePoint → 分享連結              | 需要 `sharePointSiteId` + Graph 權限 |
| **圖片（任何情境）** | Base64 內嵌                               | 開箱即用                             |

### 為何群組聊天需要 SharePoint

機器人沒有個人的 OneDrive 磁碟（`/me/drive` Graph API 端點不適用於應用程式身分）。要在群組聊天／頻道中傳送檔案，機器人需上傳至 **SharePoint 站台** 並建立分享連結。

### 設定

1. 在 Entra ID（Azure AD）→ App Registration 中 **新增 Graph API 權限**：
   - `Sites.ReadWrite.All`（Application）— 上傳檔案至 SharePoint
   - `Chat.Read.All`（Application）— 選用，啟用每使用者分享連結

2. **為租用戶授予管理員同意**。

3. **取得 SharePoint 站台 ID：**

   ```bash
   # Via Graph Explorer or curl with a valid token:
   curl -H "Authorization: Bearer $TOKEN" \
     "https://graph.microsoft.com/v1.0/sites/{hostname}:/{site-path}"

   # Example: for a site at "contoso.sharepoint.com/sites/BotFiles"
   curl -H "Authorization: Bearer $TOKEN" \
     "https://graph.microsoft.com/v1.0/sites/contoso.sharepoint.com:/sites/BotFiles"

   # Response includes: "id": "contoso.sharepoint.com,guid1,guid2"
   ```

4. **設定 OpenClaw：**
   ```json5
   {
     channels: {
       msteams: {
         // ... other config ...
         sharePointSiteId: "contoso.sharepoint.com,guid1,guid2",
       },
     },
   }
   ```

### 分享行為

| 權限                                    | 分享行為                               |
| --------------------------------------- | -------------------------------------- |
| 僅 `Sites.ReadWrite.All`                | 組織層級分享連結（組織內任何人可存取） |
| `Sites.ReadWrite.All` + `Chat.Read.All` | 每使用者分享連結（僅聊天成員可存取）   |

每使用者分享更安全，僅聊天參與者可存取檔案。若缺少 `Chat.Read.All` 權限，機器人會回退至組織層級分享。

### 回退行為

| 情境                                        | 結果                                       |
| ------------------------------------------- | ------------------------------------------ |
| 群組聊天 + 檔案 + 已設定 `sharePointSiteId` | 上傳至 SharePoint，傳送分享連結            |
| 群組聊天 + 檔案 + 未設定 `sharePointSiteId` | 嘗試 OneDrive 上傳（可能失敗），僅傳送文字 |
| 私人聊天 + 檔案                             | FileConsentCard 流程（不需 SharePoint）    |
| 任何情境 + 圖片                             | Base64 內嵌（不需 SharePoint）             |

### 檔案儲存位置

上傳的檔案會儲存在所設定 SharePoint 站台預設文件庫中的 `/OpenClawShared/` 資料夾。

## 投票（Adaptive Cards）

OpenClaw 以 Adaptive Cards 傳送 Teams 投票（Teams 無原生投票 API）。

- CLI：`openclaw message poll --channel msteams --target conversation:<id> ...`
- 投票結果由 Gateway 閘道器 記錄於 `~/.openclaw/msteams-polls.json`。
- Gateway 閘道器 必須保持上線以記錄投票。
- 目前尚未自動張貼結果摘要（需要時可檢視儲存檔）。

## Adaptive Cards（任意）

使用 `message` 工具或 CLI，向 Teams 使用者或對話傳送任何 Adaptive Card JSON。

`card` 參數接受 Adaptive Card JSON 物件。當提供 `card` 時，訊息文字為選填。

**代理程式工具：**

```json
{
  "action": "send",
  "channel": "msteams",
  "target": "user:<id>",
  "card": {
    "type": "AdaptiveCard",
    "version": "1.5",
    "body": [{ "type": "TextBlock", "text": "Hello!" }]
  }
}
```

**CLI：**

```bash
openclaw message send --channel msteams \
  --target "conversation:19:abc...@thread.tacv2" \
  --card '{"type":"AdaptiveCard","version":"1.5","body":[{"type":"TextBlock","text":"Hello!"}]}'
```

卡片結構與範例請見 [Adaptive Cards 文件](https://adaptivecards.io/)。目標格式詳情請見下方〈[Target formats](#target-formats)〉。

## Target formats

MSTeams 目標使用前綴來區分使用者與對話：

| 目標類型           | 格式                             | 範例                                            |
| ------------------ | -------------------------------- | ----------------------------------------------- |
| 使用者（依 ID）    | `user:<aad-object-id>`           | `user:40a1a0ed-4ff2-4164-a219-55518990c197`     |
| 使用者（依名稱）   | `user:<display-name>`            | `user:John Smith`（需要 Graph API）             |
| 群組／頻道         | `conversation:<conversation-id>` | `conversation:19:abc123...@thread.tacv2`        |
| 群組／頻道（原始） | `<conversation-id>`              | `19:abc123...@thread.tacv2`（若包含 `@thread`） |

**CLI 範例：**

```bash
# Send to a user by ID
openclaw message send --channel msteams --target "user:40a1a0ed-..." --message "Hello"

# Send to a user by display name (triggers Graph API lookup)
openclaw message send --channel msteams --target "user:John Smith" --message "Hello"

# Send to a group chat or channel
openclaw message send --channel msteams --target "conversation:19:abc...@thread.tacv2" --message "Hello"

# Send an Adaptive Card to a conversation
openclaw message send --channel msteams --target "conversation:19:abc...@thread.tacv2" \
  --card '{"type":"AdaptiveCard","version":"1.5","body":[{"type":"TextBlock","text":"Hello"}]}'
```

**代理程式工具範例：**

```json
{
  "action": "send",
  "channel": "msteams",
  "target": "user:John Smith",
  "message": "Hello!"
}
```

```json
{
  "action": "send",
  "channel": "msteams",
  "target": "conversation:19:abc...@thread.tacv2",
  "card": {
    "type": "AdaptiveCard",
    "version": "1.5",
    "body": [{ "type": "TextBlock", "text": "Hello" }]
  }
}
```

注意：未加上 `user:` 前綴時，名稱會預設解析為群組／團隊。以顯示名稱指定人員時，務必使用 `user:`。

## 主動訊息

- 主動訊息僅能在使用者**互動之後**傳送，因為我們會在該時點儲存對話參考。
- 請見 `/gateway/configuration` 以了解 `dmPolicy` 與允許清單的限制。

## 團隊與頻道 ID（常見陷阱）

Teams URL 中的 `groupId` 查詢參數**不是**設定所用的團隊 ID。請改從 URL 路徑中擷取 ID：

**團隊 URL：**

```
https://teams.microsoft.com/l/team/19%3ABk4j...%40thread.tacv2/conversations?groupId=...
                                    └────────────────────────────┘
                                    Team ID (URL-decode this)
```

**頻道 URL：**

```
https://teams.microsoft.com/l/channel/19%3A15bc...%40thread.tacv2/ChannelName?groupId=...
                                      └─────────────────────────┘
                                      Channel ID (URL-decode this)
```

**用於設定：**

- 團隊 ID = `/team/` 之後的路徑片段（URL 解碼，例如 `19:Bk4j...@thread.tacv2`）
- 頻道 ID = `/channel/` 之後的路徑片段（URL 解碼）
- **忽略** `groupId` 查詢參數

## 私人頻道

機器人在私人頻道中的支援有限：

| 功能                | 標準頻道 | 私人頻道             |
| ------------------- | -------- | -------------------- |
| 機器人安裝          | 是       | 有限                 |
| 即時訊息（Webhook） | 是       | 可能無法運作         |
| RSC 權限            | 是       | 行為可能不同         |
| @提及               | 是       | 若可存取機器人則可用 |
| Graph API 歷史      | 是       | 是（需權限）         |

**若私人頻道無法運作的替代方案：**

1. 使用標準頻道進行機器人互動
2. 使用 私訊 — 使用者隨時可直接傳訊給機器人
3. 使用 Graph API 存取歷史（需要 `ChannelMessage.Read.All`）

## 疑難排解

### 常見問題

- **頻道中圖片未顯示：** 缺少 Graph 權限或管理員同意。重新安裝 Teams 應用程式並完全結束／重開 Teams。
- **頻道沒有回應：** 預設需要提及；請設定 `channels.msteams.requireMention=false` 或依團隊／頻道設定。
- **版本不一致（Teams 仍顯示舊 manifest）：** 移除後重新加入應用程式，並完全結束 Teams 以重新整理。
- **Webhook 回傳 401 Unauthorized：** 在未使用 Azure JWT 手動測試時屬正常，代表端點可達但驗證失敗。請使用 Azure Web Chat 正確測試。

### Manifest 上傳錯誤

- **「Icon file cannot be empty」：** manifest 參考的圖示檔為 0 位元組。請建立有效 PNG 圖示（`outline.png` 需 32x32、`color.png` 需 192x192）。
- **「webApplicationInfo.Id already in use」：** 該應用程式仍安裝於其他團隊／聊天。請先解除安裝，或等待 5–10 分鐘讓變更傳播。
- **上傳時出現「Something went wrong」：** 改用 https://admin.teams.microsoft.com 上傳，開啟瀏覽器 DevTools（F12）→ Network 分頁，查看實際錯誤回應。
- **側載失敗：** 嘗試使用「Upload an app to your org's app catalog」取代「Upload a custom app」，通常可繞過側載限制。

### RSC 權限無法運作

1. 確認 `webApplicationInfo.id` 與你的機器人 App ID 完全一致
2. 重新上傳應用程式並在團隊／聊天中重新安裝
3. 檢查組織管理員是否封鎖 RSC 權限
4. 確認使用正確範圍：團隊使用 `ChannelMessage.Read.Group`，群組聊天使用 `ChatMessage.Read.Chat`

## 參考資料

- [Create Azure Bot](https://learn.microsoft.com/en-us/azure/bot-service/bot-service-quickstart-registration) — Azure Bot 設定指南
- [Teams Developer Portal](https://dev.teams.microsoft.com/apps) — 建立／管理 Teams 應用程式
- [Teams app manifest schema](https://learn.microsoft.com/en-us/microsoftteams/platform/resources/schema/manifest-schema)
- [Receive channel messages with RSC](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/channel-messages-with-rsc)
- [RSC permissions reference](https://learn.microsoft.com/en-us/microsoftteams/platform/graph-api/rsc/resource-specific-consent)
- [Teams bot file handling](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/bots-filesv4)（頻道／群組需要 Graph）
- [Proactive messaging](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/send-proactive-messages)

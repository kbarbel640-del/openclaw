---
summary: "Twitch 聊天機器人設定與安裝"
read_when:
  - 為 OpenClaw 設定 Twitch 聊天整合
title: "Twitch"
x-i18n:
  source_path: channels/twitch.md
  source_hash: 0dd1c05bef570470
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:30Z
---

# Twitch（外掛）

透過 IRC 連線提供 Twitch 聊天支援。OpenClaw 會以 Twitch 使用者（機器人帳號）的身分連線，在頻道中接收與傳送訊息。

## 需要的外掛

Twitch 以外掛形式提供，未隨核心安裝一併提供。

透過 CLI 安裝（npm registry）：

```bash
openclaw plugins install @openclaw/twitch
```

本機檢出（從 git repo 執行時）：

```bash
openclaw plugins install ./extensions/twitch
```

詳情：[Plugins](/plugin)

## 快速設定（初學者）

1. 為機器人建立專用的 Twitch 帳號（或使用既有帳號）。
2. 產生憑證：[Twitch Token Generator](https://twitchtokengenerator.com/)
   - 選擇 **Bot Token**
   - 確認已勾選權限範圍 `chat:read` 與 `chat:write`
   - 複製 **Client ID** 與 **Access Token**
3. 查找你的 Twitch 使用者 ID：https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/
4. 設定 Token：
   - 環境變數：`OPENCLAW_TWITCH_ACCESS_TOKEN=...`（僅限預設帳號）
   - 或設定檔：`channels.twitch.accessToken`
   - 若兩者皆設定，設定檔優先（環境變數僅作為預設帳號的後備）。
5. 啟動 Gateway 閘道器。

**⚠️ 重要：** 請加入存取控制（`allowFrom` 或 `allowedRoles`），以防止未授權的使用者觸發機器人。`requireMention` 預設為 `true`。

最小設定：

```json5
{
  channels: {
    twitch: {
      enabled: true,
      username: "openclaw", // Bot's Twitch account
      accessToken: "oauth:abc123...", // OAuth Access Token (or use OPENCLAW_TWITCH_ACCESS_TOKEN env var)
      clientId: "xyz789...", // Client ID from Token Generator
      channel: "vevisk", // Which Twitch channel's chat to join (required)
      allowFrom: ["123456789"], // (recommended) Your Twitch user ID only - get it from https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/
    },
  },
}
```

## 它是什麼

- 由 Gateway 閘道器擁有的 Twitch 頻道。
- 確定性路由：回覆一律回到 Twitch。
- 每個帳號都對應到一個獨立的工作階段金鑰 `agent:<agentId>:twitch:<accountName>`。
- `username` 是機器人的帳號（用於驗證），`channel` 是要加入的聊天室。

## 設定（詳細）

### 產生憑證

使用 [Twitch Token Generator](https://twitchtokengenerator.com/)：

- 選擇 **Bot Token**
- 確認已勾選權限範圍 `chat:read` 與 `chat:write`
- 複製 **Client ID** 與 **Access Token**

不需要手動註冊應用程式。Token 會在數小時後過期。

### 設定機器人

**環境變數（僅限預設帳號）：**

```bash
OPENCLAW_TWITCH_ACCESS_TOKEN=oauth:abc123...
```

**或設定檔：**

```json5
{
  channels: {
    twitch: {
      enabled: true,
      username: "openclaw",
      accessToken: "oauth:abc123...",
      clientId: "xyz789...",
      channel: "vevisk",
    },
  },
}
```

若同時設定環境變數與設定檔，設定檔優先。

### 存取控制（建議）

```json5
{
  channels: {
    twitch: {
      allowFrom: ["123456789"], // (recommended) Your Twitch user ID only
    },
  },
}
```

建議使用 `allowFrom` 作為硬性允許清單。若需要以角色為基礎的存取，則改用 `allowedRoles`。

**可用角色：** `"moderator"`、`"owner"`、`"vip"`、`"subscriber"`、`"all"`。

**為何使用使用者 ID？** 使用者名稱可能會變更，造成冒充風險；使用者 ID 是永久不變的。

查找你的 Twitch 使用者 ID：https://www.streamweasels.com/tools/convert-twitch-username-%20to-user-id/（將你的 Twitch 使用者名稱轉換為 ID）

## Token 重新整理（選用）

來自 [Twitch Token Generator](https://twitchtokengenerator.com/) 的 Token 無法自動重新整理，過期後需重新產生。

若要自動重新整理 Token，請在 [Twitch Developer Console](https://dev.twitch.tv/console) 建立你自己的 Twitch 應用程式，並加入至設定檔：

```json5
{
  channels: {
    twitch: {
      clientSecret: "your_client_secret",
      refreshToken: "your_refresh_token",
    },
  },
}
```

機器人會在到期前自動重新整理 Token，並記錄重新整理事件。

## 多帳號支援

使用 `channels.twitch.accounts` 搭配每個帳號各自的 Token。共享模式請參考 [`gateway/configuration`](/gateway/configuration)。

範例（一個機器人帳號加入兩個頻道）：

```json5
{
  channels: {
    twitch: {
      accounts: {
        channel1: {
          username: "openclaw",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "vevisk",
        },
        channel2: {
          username: "openclaw",
          accessToken: "oauth:def456...",
          clientId: "uvw012...",
          channel: "secondchannel",
        },
      },
    },
  },
}
```

**注意：** 每個帳號都需要自己的 Token（每個頻道一個 Token）。

## 存取控制

### 角色型限制

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          allowedRoles: ["moderator", "vip"],
        },
      },
    },
  },
}
```

### 依使用者 ID 的允許清單（最安全）

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          allowFrom: ["123456789", "987654321"],
        },
      },
    },
  },
}
```

### 角色型存取（替代方案）

`allowFrom` 是硬性允許清單。設定後，僅允許清單中的使用者 ID。
若要使用角色型存取，請不要設定 `allowFrom`，改為設定 `allowedRoles`：

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          allowedRoles: ["moderator"],
        },
      },
    },
  },
}
```

### 停用 @mention 要求

預設情況下，`requireMention` 為 `true`。若要停用並回應所有訊息：

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          requireMention: false,
        },
      },
    },
  },
}
```

## 疑難排解

首先，執行診斷指令：

```bash
openclaw doctor
openclaw channels status --probe
```

### 機器人未回應訊息

**檢查存取控制：** 確認你的使用者 ID 位於 `allowFrom`，或暫時移除
`allowFrom` 並設定 `allowedRoles: ["all"]` 進行測試。

**確認機器人在頻道中：** 機器人必須加入 `channel` 所指定的頻道。

### Token 問題

**「Failed to connect」或驗證錯誤：**

- 確認 `accessToken` 是 OAuth access token 的值（通常以 `oauth:` 前綴開頭）
- 檢查 Token 是否包含 `chat:read` 與 `chat:write` 權限範圍
- 若使用 Token 重新整理，確認已設定 `clientSecret` 與 `refreshToken`

### Token 重新整理無法運作

**檢查是否有重新整理事件的紀錄：**

```
Using env token source for mybot
Access token refreshed for user 123456 (expires in 14400s)
```

若看到「token refresh disabled (no refresh token)」：

- 確認已提供 `clientSecret`
- 確認已提供 `refreshToken`

## 設定

**帳號設定：**

- `username` - 機器人使用者名稱
- `accessToken` - 具備 `chat:read` 與 `chat:write` 的 OAuth access token
- `clientId` - Twitch Client ID（來自 Token Generator 或你的應用程式）
- `channel` - 要加入的頻道（必填）
- `enabled` - 啟用此帳號（預設：`true`）
- `clientSecret` - 選用：用於自動 Token 重新整理
- `refreshToken` - 選用：用於自動 Token 重新整理
- `expiresIn` - Token 到期時間（秒）
- `obtainmentTimestamp` - Token 取得時間戳
- `allowFrom` - 使用者 ID 允許清單
- `allowedRoles` - 角色型存取控制（`"moderator" | "owner" | "vip" | "subscriber" | "all"`）
- `requireMention` - 需要 @mention（預設：`true`）

**提供者選項：**

- `channels.twitch.enabled` - 啟用／停用頻道啟動
- `channels.twitch.username` - 機器人使用者名稱（簡化的單帳號設定）
- `channels.twitch.accessToken` - OAuth access token（簡化的單帳號設定）
- `channels.twitch.clientId` - Twitch Client ID（簡化的單帳號設定）
- `channels.twitch.channel` - 要加入的頻道（簡化的單帳號設定）
- `channels.twitch.accounts.<accountName>` - 多帳號設定（上述所有帳號欄位）

完整範例：

```json5
{
  channels: {
    twitch: {
      enabled: true,
      username: "openclaw",
      accessToken: "oauth:abc123...",
      clientId: "xyz789...",
      channel: "vevisk",
      clientSecret: "secret123...",
      refreshToken: "refresh456...",
      allowFrom: ["123456789"],
      allowedRoles: ["moderator", "vip"],
      accounts: {
        default: {
          username: "mybot",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "your_channel",
          enabled: true,
          clientSecret: "secret123...",
          refreshToken: "refresh456...",
          expiresIn: 14400,
          obtainmentTimestamp: 1706092800000,
          allowFrom: ["123456789", "987654321"],
          allowedRoles: ["moderator"],
        },
      },
    },
  },
}
```

## 工具動作

代理程式可以呼叫 `twitch`，其動作為：

- `send` - 向頻道傳送訊息

範例：

```json5
{
  action: "twitch",
  params: {
    message: "Hello Twitch!",
    to: "#mychannel",
  },
}
```

## 安全性與營運

- **將 Token 視為密碼** - 切勿將 Token 提交至 git
- **長時間執行的機器人請使用自動 Token 重新整理**
- **使用使用者 ID 允許清單**，而非使用者名稱來進行存取控制
- **監控日誌**，確認 Token 重新整理事件與連線狀態
- **最小化 Token 權限範圍** - 僅請求 `chat:read` 與 `chat:write`
- **若卡住**：確認沒有其他行程占用該工作階段後，重新啟動 Gateway 閘道器

## 限制

- 每則訊息 **500 個字元**（會在單字邊界自動分段）
- 分段前會移除 Markdown
- 無額外速率限制（使用 Twitch 內建的速率限制）

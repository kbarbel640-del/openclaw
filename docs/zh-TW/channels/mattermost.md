---
summary: 「Mattermost 機器人設定與 OpenClaw 設定」
read_when:
  - 設定 Mattermost
  - 偵錯 Mattermost 路由
title: 「Mattermost」
x-i18n:
  source_path: channels/mattermost.md
  source_hash: 57fabe5eb0efbcb8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:21Z
---

# Mattermost（plugin）

狀態：透過 plugin 支援（bot token + WebSocket 事件）。支援頻道、群組與 私訊。
Mattermost 是可自我託管的團隊即時通訊平台；產品細節與下載請參閱官方網站
[mattermost.com](https://mattermost.com)。

## 需要 plugin

Mattermost 以 plugin 形式提供，未隨核心安裝一併提供。

透過 CLI 安裝（npm registry）：

```bash
openclaw plugins install @openclaw/mattermost
```

本機檢出（從 git repo 執行時）：

```bash
openclaw plugins install ./extensions/mattermost
```

若在 設定／入門引導 中選擇 Mattermost 且偵測到 git 檢出，
OpenClaw 會自動提供本機安裝路徑。

詳情：[Plugins](/plugin)

## 快速開始

1. 安裝 Mattermost plugin。
2. 建立 Mattermost 機器人帳號並複製 **bot token**。
3. 複製 Mattermost **base URL**（例如：`https://chat.example.com`）。
4. 設定 OpenClaw 並啟動 Gateway 閘道器。

最小設定：

```json5
{
  channels: {
    mattermost: {
      enabled: true,
      botToken: "mm-token",
      baseUrl: "https://chat.example.com",
      dmPolicy: "pairing",
    },
  },
}
```

## 環境變數（預設帳號）

若偏好使用 環境變數，請在 Gateway 閘道器 主機上設定：

- `MATTERMOST_BOT_TOKEN=...`
- `MATTERMOST_URL=https://chat.example.com`

環境變數僅適用於 **預設** 帳號（`default`）。其他帳號必須使用設定值。

## 聊天模式

Mattermost 會自動回覆 私訊。頻道行為由 `chatmode` 控制：

- `oncall`（預設）：僅在頻道中被 @ 提及時回覆。
- `onmessage`：回覆每一則頻道訊息。
- `onchar`：當訊息以觸發前綴開頭時回覆。

設定範例：

```json5
{
  channels: {
    mattermost: {
      chatmode: "onchar",
      oncharPrefixes: [">", "!"],
    },
  },
}
```

注意事項：

- `onchar` 仍會回覆明確的 @ 提及。
- `channels.mattermost.requireMention` 為相容舊版設定而保留，但建議使用 `chatmode`。

## 存取控制（私訊）

- 預設：`channels.mattermost.dmPolicy = "pairing"`（未知的傳送者會取得配對碼）。
- 核准方式：
  - `openclaw pairing list mattermost`
  - `openclaw pairing approve mattermost <CODE>`
- 公開 私訊：`channels.mattermost.dmPolicy="open"` 加上 `channels.mattermost.allowFrom=["*"]`。

## 頻道（群組）

- 預設：`channels.mattermost.groupPolicy = "allowlist"`（提及閘控）。
- 以 `channels.mattermost.groupAllowFrom` 將傳送者加入允許清單（使用者 ID 或 `@username`）。
- 開放頻道：`channels.mattermost.groupPolicy="open"`（提及閘控）。

## 對外傳送的目標

搭配 `openclaw message send` 或 cron／webhooks 使用以下目標格式：

- `channel:<id>`：頻道
- `user:<id>`：私訊
- `@username`：私訊（透過 Mattermost API 解析）

僅提供 ID 會被視為頻道。

## 多帳號

Mattermost 在 `channels.mattermost.accounts` 之下支援多個帳號：

```json5
{
  channels: {
    mattermost: {
      accounts: {
        default: { name: "Primary", botToken: "mm-token", baseUrl: "https://chat.example.com" },
        alerts: { name: "Alerts", botToken: "mm-token-2", baseUrl: "https://alerts.example.com" },
      },
    },
  },
}
```

## 疑難排解

- 頻道沒有回覆：請確認機器人在該頻道並 @ 提及它（oncall），使用觸發前綴（onchar），或設定 `chatmode: "onmessage"`。
- 驗證錯誤：檢查 bot token、base URL，以及帳號是否已啟用。
- 多帳號問題：環境變數僅套用到 `default` 帳號。

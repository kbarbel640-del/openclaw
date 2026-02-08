---
summary: 「OpenClaw 可連接的即時通訊平台」
read_when:
  - 你想為 OpenClaw 選擇聊天頻道
  - 你需要快速概覽支援的即時通訊平台
title: 「聊天頻道」
x-i18n:
  source_path: channels/index.md
  source_hash: 5269db02b77b1dc3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:20Z
---

# 聊天頻道

OpenClaw 可以在你已經使用的任何聊天應用程式上與你對話。每個頻道都透過 Gateway 閘道器 連線。
所有頻道都支援文字；媒體與表情回應的支援度則依頻道而異。

## 支援的頻道

- [WhatsApp](/channels/whatsapp) — 最受歡迎；使用 Baileys，並需要 QR 配對。
- [Telegram](/channels/telegram) — 透過 grammY 的 Bot API；支援群組。
- [Discord](/channels/discord) — Discord Bot API + Gateway 閘道器；支援伺服器、頻道與私訊。
- [Slack](/channels/slack) — Bolt SDK；工作區應用程式。
- [Feishu](/channels/feishu) — 透過 WebSocket 的 Feishu/Lark 機器人（外掛，需另外安裝）。
- [Google Chat](/channels/googlechat) — 透過 HTTP webhook 的 Google Chat API 應用程式。
- [Mattermost](/channels/mattermost) — Bot API + WebSocket；頻道、群組、私訊（外掛，需另外安裝）。
- [Signal](/channels/signal) — signal-cli；以隱私為導向。
- [BlueBubbles](/channels/bluebubbles) — **iMessage 的建議方案**；使用 BlueBubbles macOS 伺服器 REST API，具備完整功能支援（編輯、收回、特效、反應、群組管理 — 編輯功能目前在 macOS 26 Tahoe 上損壞）。
- [iMessage (legacy)](/channels/imessage) — 透過 imsg CLI 的舊版 macOS 整合（已淘汰，新部署請使用 BlueBubbles）。
- [Microsoft Teams](/channels/msteams) — Bot Framework；企業級支援（外掛，需另外安裝）。
- [LINE](/channels/line) — LINE Messaging API 機器人（外掛，需另外安裝）。
- [Nextcloud Talk](/channels/nextcloud-talk) — 透過 Nextcloud Talk 的自架聊天（外掛，需另外安裝）。
- [Matrix](/channels/matrix) — Matrix 通訊協定（外掛，需另外安裝）。
- [Nostr](/channels/nostr) — 透過 NIP-04 的去中心化私訊（外掛，需另外安裝）。
- [Tlon](/channels/tlon) — 基於 Urbit 的即時通訊器（外掛，需另外安裝）。
- [Twitch](/channels/twitch) — 透過 IRC 連線的 Twitch 聊天（外掛，需另外安裝）。
- [Zalo](/channels/zalo) — Zalo Bot API；越南常用的即時通訊軟體（外掛，需另外安裝）。
- [Zalo Personal](/channels/zalouser) — 透過 QR 登入的 Zalo 個人帳號（外掛，需另外安裝）。
- [WebChat](/web/webchat) — 透過 WebSocket 的 Gateway 閘道器 WebChat 使用者介面。

## 注意事項

- 頻道可同時執行；設定多個後，OpenClaw 會依聊天進行路由。
- 最快的設定方式通常是 **Telegram**（簡單的機器人權杖）。WhatsApp 需要 QR 配對，且
  會在磁碟上儲存較多狀態資料。
- 群組行為依頻道而異；請參閱 [Groups](/concepts/groups)。
- 為了安全性，會強制執行私訊配對與允許清單；請參閱 [Security](/gateway/security)。
- Telegram 內部細節：[grammY notes](/channels/grammy)。
- 疑難排解：[Channel troubleshooting](/channels/troubleshooting)。
- 模型提供者另有文件說明；請參閱 [Model Providers](/providers/models)。

---
summary: 「透過 grammY 整合 Telegram Bot API，包含設定說明」
read_when:
  - 處理 Telegram 或 grammY 相關流程時
title: grammY
x-i18n:
  source_path: channels/grammy.md
  source_hash: ea7ef23e6d77801f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:20Z
---

# grammY 整合（Telegram Bot API）

# 為何選擇 grammY

- 以 TS 為優先的 Bot API 用戶端，內建 long-poll + webhook 輔助工具、中介軟體、錯誤處理與速率限制器。
- 比自行手刻 fetch + FormData 更乾淨的媒體輔助工具；支援所有 Bot API 方法。
- 具備擴充性：可透過自訂 fetch 支援 proxy、工作階段中介軟體（選用）、型別安全的 context。

# 我們已交付的內容

- **單一路徑用戶端：** 已移除基於 fetch 的實作；grammY 現為唯一的 Telegram 用戶端（傳送 + Gateway 閘道器），且預設啟用 grammY 節流器。
- **Gateway：** `monitorTelegramProvider` 建立一個 grammY `Bot`，串接提及／允許清單閘控、透過 `getFile`/`download` 進行媒體下載，並以 `sendMessage/sendPhoto/sendVideo/sendAudio/sendDocument` 傳遞回覆。透過 `webhookCallback` 支援 long-poll 或 webhook。
- **Proxy：** 選用的 `channels.telegram.proxy` 透過 grammY 的 `client.baseFetch` 使用 `undici.ProxyAgent`。
- **Webhook 支援：** `webhook-set.ts` 封裝 `setWebhook/deleteWebhook`；`webhook.ts` 提供回呼服務，含健康檢查與優雅關閉。當設定 `channels.telegram.webhookUrl` + `channels.telegram.webhookSecret` 時，Gateway 會啟用 webhook 模式（否則使用 long-poll）。
- **工作階段：** 私聊會合併到代理程式的主工作階段（`agent:<agentId>:<mainKey>`）；群組使用 `agent:<agentId>:telegram:group:<chatId>`；回覆會路由回相同頻道。
- **設定旋鈕：** `channels.telegram.botToken`、`channels.telegram.dmPolicy`、`channels.telegram.groups`（允許清單 + 提及預設值）、`channels.telegram.allowFrom`、`channels.telegram.groupAllowFrom`、`channels.telegram.groupPolicy`、`channels.telegram.mediaMaxMb`、`channels.telegram.linkPreview`、`channels.telegram.proxy`、`channels.telegram.webhookSecret`、`channels.telegram.webhookUrl`。
- **草稿串流：** 選用的 `channels.telegram.streamMode` 在私人主題聊天中使用 `sendMessageDraft`（Bot API 9.3+）。此功能與頻道區塊串流無關。
- **測試：** grammY mocks 覆蓋私訊 + 群組提及閘控與對外傳送；仍歡迎補充更多媒體／webhook 相關的測試夾具。

開放問題

- 若遭遇 Bot API 429，是否啟用選用的 grammY 外掛（節流器）。
- 新增更多結構化媒體測試（貼圖、語音訊息）。
- 讓 webhook 監聽埠可設定（目前除非透過 Gateway 閘道器 串接，否則固定為 8787）。

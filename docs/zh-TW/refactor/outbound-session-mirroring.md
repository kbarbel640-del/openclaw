---
title: 出站工作階段鏡像重構（Issue #1520）
description: Track outbound session mirroring refactor notes, decisions, tests, and open items.
x-i18n:
  source_path: refactor/outbound-session-mirroring.md
  source_hash: b88a72f36f7b6d8a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:31Z
---

# 出站工作階段鏡像重構（Issue #1520）

## 狀態

- 進行中。
- 核心 + 外掛的頻道路由已更新以支援出站鏡像。
- Gateway send 現在在省略 sessionKey 時會推導目標工作階段。

## 背景

出站傳送先前被鏡像到「目前」的代理程式工作階段（工具工作階段金鑰），而非目標頻道的工作階段。入站路由使用頻道／對等端工作階段金鑰，因此出站回應會落在錯誤的工作階段，且首次聯繫的目標經常缺少工作階段項目。

## 目標

- 將出站訊息鏡像到目標頻道的工作階段金鑰。
- 在缺少時於出站建立工作階段項目。
- 讓執行緒／主題的範圍與入站工作階段金鑰保持一致。
- 覆蓋核心頻道與隨附的擴充功能。

## 實作摘要

- 新的出站工作階段路由輔助工具：
  - `src/infra/outbound/outbound-session.ts`
  - `resolveOutboundSessionRoute` 使用 `buildAgentSessionKey`（dmScope + identityLinks）建置目標 sessionKey。
  - `ensureOutboundSessionEntry` 透過 `recordSessionMetaFromInbound` 寫入最小的 `MsgContext`。
- `runMessageAction`（send）會推導目標 sessionKey，並將其傳遞給 `executeSendAction` 進行鏡像。
- `message-tool` 不再直接鏡像；僅從目前的工作階段金鑰解析 agentId。
- 外掛的 send 路徑會使用推導出的 sessionKey，透過 `appendAssistantMessageToSessionTranscript` 進行鏡像。
- Gateway send 在未提供時會推導目標工作階段金鑰（預設代理程式），並確保建立工作階段項目。

## 執行緒／主題處理

- Slack：replyTo/threadId -> `resolveThreadSessionKeys`（後綴）。
- Discord：threadId/replyTo -> `resolveThreadSessionKeys`，搭配 `useSuffix=false` 以符合入站（執行緒頻道 ID 已界定工作階段）。
- Telegram：主題 ID 透過 `buildTelegramGroupPeerId` 映射至 `chatId:topic:<id>`。

## 已涵蓋的擴充功能

- Matrix、MS Teams、Mattermost、BlueBubbles、Nextcloud Talk、Zalo、Zalo Personal、Nostr、Tlon。
- 備註：
  - Mattermost 目標現在會移除 `@`，以進行 DM 工作階段金鑰路由。
  - Zalo Personal 對於 1:1 目標使用 DM 對等端種類（僅在存在 `group:` 時才為群組）。
  - BlueBubbles 的群組目標會移除 `chat_*` 前綴，以符合入站工作階段金鑰。
  - Slack 的自動執行緒鏡像會以不區分大小寫的方式比對頻道 ID。
  - Gateway send 在鏡像前會將提供的工作階段金鑰轉為小寫。

## 決策

- **Gateway send 工作階段推導**：若提供 `sessionKey`，則使用之；若省略，則從目標 + 預設代理程式推導 sessionKey，並在該處鏡像。
- **工作階段項目建立**：一律使用 `recordSessionMetaFromInbound`，其 `Provider/From/To/ChatType/AccountId/Originating*` 與入站格式對齊。
- **目標正規化**：出站路由在可用時使用已解析的目標（經 `resolveChannelTarget` 之後）。
- **工作階段金鑰大小寫**：在寫入與遷移期間，將工作階段金鑰正規化為小寫。

## 新增／更新的測試

- `src/infra/outbound/outbound-session.test.ts`
  - Slack 執行緒工作階段金鑰。
  - Telegram 主題工作階段金鑰。
  - 搭配 Discord 的 dmScope identityLinks。
- `src/agents/tools/message-tool.test.ts`
  - 從工作階段金鑰推導 agentId（未傳遞 sessionKey）。
- `src/gateway/server-methods/send.test.ts`
  - 在省略時推導工作階段金鑰並建立工作階段項目。

## 未完成事項／後續追蹤

- 語音通話外掛使用自訂的 `voice:<phone>` 工作階段金鑰。此處尚未標準化出站對應；若 message-tool 需要支援語音通話傳送，請加入明確的對應。
- 確認是否有任何外部外掛使用超出隨附集合的非標準 `From/To` 格式。

## 影響的檔案

- `src/infra/outbound/outbound-session.ts`
- `src/infra/outbound/outbound-send-service.ts`
- `src/infra/outbound/message-action-runner.ts`
- `src/agents/tools/message-tool.ts`
- `src/gateway/server-methods/send.ts`
- 測試位於：
  - `src/infra/outbound/outbound-session.test.ts`
  - `src/agents/tools/message-tool.test.ts`
  - `src/gateway/server-methods/send.test.ts`

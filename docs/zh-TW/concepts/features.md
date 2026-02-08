---
summary: "OpenClaw 在頻道、路由、媒體與 UX 方面的功能。"
read_when:
  - 你想要查看 OpenClaw 支援項目的完整清單
title: "功能"
x-i18n:
  source_path: concepts/features.md
  source_hash: 1b6aee0bfda75182
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:55Z
---

## 亮點

<Columns>
  <Card title="頻道" icon="message-square">
    透過單一 Gateway 閘道器 支援 WhatsApp、Telegram、Discord 與 iMessage。
  </Card>
  <Card title="外掛" icon="plug">
    以擴充功能加入 Mattermost 等更多整合。
  </Card>
  <Card title="路由" icon="route">
    具備隔離工作階段的多代理程式路由。
  </Card>
  <Card title="媒體" icon="image">
    圖片、音訊與文件的收發支援。
  </Card>
  <Card title="應用程式與 UI" icon="monitor">
    Web Control UI 與 macOS 配套應用程式。
  </Card>
  <Card title="行動節點" icon="smartphone">
    具備 Canvas 支援的 iOS 與 Android 節點。
  </Card>
</Columns>

## 完整清單

- 透過 WhatsApp Web（Baileys）的 WhatsApp 整合
- Telegram 機器人支援（grammY）
- Discord 機器人支援（channels.discord.js）
- Mattermost 機器人支援（plugin）
- 透過本機 imsg CLI（macOS）的 iMessage 整合
- 以工具串流的 RPC 模式提供給 Pi 的代理程式橋接
- 長回應的串流與分塊處理
- 依工作區或傳送者進行隔離工作階段的多代理程式路由
- 透過 OAuth 為 Anthropic 與 OpenAI 提供訂閱式驗證
- 工作階段：直接聊天會合併為共享的 `main`；群組則相互隔離
- 具備以提及為基礎的啟用方式之群組聊天支援
- 圖片、音訊與文件的媒體支援
- 可選的語音備註轉錄掛鉤
- WebChat 與 macOS 選單列應用程式
- 具備配對與 Canvas 介面的 iOS 節點
- 具備配對、Canvas、聊天與相機功能的 Android 節點

<Note>
已移除 Legacy Claude、Codex、Gemini 與 Opencode 路徑。Pi 是唯一的
程式設計代理程式路徑。
</Note>

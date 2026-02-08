---
summary: 「OpenClaw 是一個可在任何作業系統上運行的 AI 代理程式多頻道 Gateway 閘道器。」
read_when:
  - 向新手介紹 OpenClaw
title: 「OpenClaw」
x-i18n:
  source_path: index.md
  source_hash: 97a613c67efb448b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:43Z
---

# OpenClaw 🦞

<p align="center">
    <img
        src="/assets/openclaw-logo-text-dark.png"
        alt="OpenClaw"
        width="500"
        class="dark:hidden"
    />
    <img
        src="/assets/openclaw-logo-text.png"
        alt="OpenClaw"
        width="500"
        class="hidden dark:block"
    />
</p>

> _「EXFOLIATE! EXFOLIATE!」_ — 可能是一隻太空龍蝦

<p align="center">
  <strong>適用於任何作業系統的 AI 代理程式 Gateway 閘道器，橫跨 WhatsApp、Telegram、Discord、iMessage 等。</strong><br />
  傳送一則訊息，從口袋裡取得代理程式回應。外掛可加入 Mattermost 等更多平台。
</p>

<Columns>
  <Card title="開始使用" href="/start/getting-started" icon="rocket">
    安裝 OpenClaw，數分鐘內啟動 Gateway 閘道器。
  </Card>
  <Card title="執行精靈" href="/start/wizard" icon="sparkles">
    透過 `openclaw onboard` 與配對流程進行引導式設定。
  </Card>
  <Card title="開啟控制介面" href="/web/control-ui" icon="layout-dashboard">
    啟動瀏覽器儀表板，用於聊天、設定與工作階段。
  </Card>
</Columns>

## 什麼是 OpenClaw？

OpenClaw 是一個**自架的 Gateway 閘道器**，可將你喜愛的聊天應用程式——WhatsApp、Telegram、Discord、iMessage 等——連接到像 Pi 這樣的 AI 程式設計代理程式。你只需在自己的電腦（或伺服器）上執行單一的 Gateway 閘道器程序，它就會成為你的訊息應用程式與隨時可用的 AI 助手之間的橋樑。

**適合誰使用？** 想要隨時隨地傳訊給個人 AI 助手的開發者與進階使用者——同時不放棄資料掌控權，也不依賴代管服務。

**有何不同？**

- **自架**：在你的硬體上運行，依你的規則
- **多頻道**：單一 Gateway 閘道器同時服務 WhatsApp、Telegram、Discord 等
- **代理程式原生**：為程式設計代理程式打造，支援工具使用、工作階段、記憶體與多代理程式路由
- **開放原始碼**：MIT 授權，社群驅動

**需要什麼？** Node 22+、一把 API 金鑰（建議使用 Anthropic），以及 5 分鐘。

## 運作方式

```mermaid
flowchart LR
  A["Chat apps + plugins"] --> B["Gateway"]
  B --> C["Pi agent"]
  B --> D["CLI"]
  B --> E["Web Control UI"]
  B --> F["macOS app"]
  B --> G["iOS and Android nodes"]
```

Gateway 閘道器是工作階段、路由與頻道連線的單一事實來源。

## 主要能力

<Columns>
  <Card title="多頻道 Gateway 閘道器" icon="network">
    以單一 Gateway 閘道器程序支援 WhatsApp、Telegram、Discord 與 iMessage。
  </Card>
  <Card title="外掛頻道" icon="plug">
    透過擴充套件加入 Mattermost 等更多平台。
  </Card>
  <Card title="多代理程式路由" icon="route">
    依代理程式、工作區或傳送者進行隔離的工作階段。
  </Card>
  <Card title="媒體支援" icon="image">
    傳送與接收圖片、音訊與文件。
  </Card>
  <Card title="Web 控制介面" icon="monitor">
    用於聊天、設定、工作階段與節點的瀏覽器儀表板。
  </Card>
  <Card title="行動節點" icon="smartphone">
    配對 iOS 與 Android 節點，支援 Canvas。
  </Card>
</Columns>

## 快速開始

<Steps>
  <Step title="安裝 OpenClaw">
    ```bash
    npm install -g openclaw@latest
    ```
  </Step>
  <Step title="入門引導並安裝服務">
    ```bash
    openclaw onboard --install-daemon
    ```
  </Step>
  <Step title="配對 WhatsApp 並啟動 Gateway 閘道器">
    ```bash
    openclaw channels login
    openclaw gateway --port 18789
    ```
  </Step>
</Steps>

需要完整的安裝與開發設定嗎？請參閱 [快速開始](/start/quickstart)。

## 儀表板

Gateway 閘道器啟動後，開啟瀏覽器的控制介面。

- 本機預設：http://127.0.0.1:18789/
- 遠端存取：[Web surfaces](/web) 與 [Tailscale](/gateway/tailscale)

<p align="center">
  <img src="whatsapp-openclaw.jpg" alt="OpenClaw" width="420" />
</p>

## 設定（選用）

設定檔位於 `~/.openclaw/openclaw.json`。

- 若你**什麼都不做**，OpenClaw 會以 RPC 模式使用內建的 Pi 二進位檔，並為每位傳送者建立工作階段。
- 若你想要加以鎖定，請從 `channels.whatsapp.allowFrom` 開始，並（針對群組）設定提及規則。

範例：

```json5
{
  channels: {
    whatsapp: {
      allowFrom: ["+15555550123"],
      groups: { "*": { requireMention: true } },
    },
  },
  messages: { groupChat: { mentionPatterns: ["@openclaw"] } },
}
```

## 從這裡開始

<Columns>
  <Card title="文件中樞" href="/start/hubs" icon="book-open">
    依使用情境整理的所有文件與指南。
  </Card>
  <Card title="設定" href="/gateway/configuration" icon="settings">
    核心 Gateway 閘道器設定、權杖與提供者設定。
  </Card>
  <Card title="遠端存取" href="/gateway/remote" icon="globe">
    SSH 與 tailnet 存取模式。
  </Card>
  <Card title="頻道" href="/channels/telegram" icon="message-square">
    WhatsApp、Telegram、Discord 等的頻道專屬設定。
  </Card>
  <Card title="節點" href="/nodes" icon="smartphone">
    具備配對與 Canvas 的 iOS 與 Android 節點。
  </Card>
  <Card title="說明" href="/help" icon="life-buoy">
    常見修正與疑難排解入口。
  </Card>
</Columns>

## 進一步了解

<Columns>
  <Card title="完整功能清單" href="/concepts/features" icon="list">
    完整的頻道、路由與媒體能力。
  </Card>
  <Card title="多代理程式路由" href="/concepts/multi-agent" icon="route">
    工作區隔離與每個代理程式的工作階段。
  </Card>
  <Card title="安全性" href="/gateway/security" icon="shield">
    權杖、允許清單與安全控制。
  </Card>
  <Card title="疑難排解" href="/gateway/troubleshooting" icon="wrench">
    Gateway 閘道器診斷與常見錯誤。
  </Card>
  <Card title="關於與致謝" href="/reference/credits" icon="info">
    專案起源、貢獻者與授權。
  </Card>
</Columns>

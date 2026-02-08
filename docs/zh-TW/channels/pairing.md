---
summary: "配對總覽：核准誰可以對你發送 私訊 + 哪些節點可以加入"
read_when:
  - 設定 私訊 存取控制
  - 配對新的 iOS/Android 節點
  - 檢視 OpenClaw 的安全態勢
title: "配對"
x-i18n:
  source_path: channels/pairing.md
  source_hash: cc6ce9c71db6d96d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:02Z
---

# 配對

「配對」是 OpenClaw 明確的 **擁有者核准** 步驟。
它用於兩個地方：

1. **私訊 配對**（允許誰可以與機器人對話）
2. **節點 配對**（允許哪些裝置／節點加入 Gateway 閘道器 網路）

安全背景： [Security](/gateway/security)

## 1) 私訊 配對（入站聊天存取）

當某個 頻道 以 私訊 政策 `pairing` 設定時，未知的傳送者會收到一組短代碼，且其訊息在你核准之前 **不會被處理**。

預設的 私訊 政策記載於： [Security](/gateway/security)

配對代碼：

- 8 個字元，大寫，不含易混淆字元（`0O1I`）。
- **1 小時後過期**。機器人只會在建立新請求時送出配對訊息（約每個傳送者每小時一次）。
- 進行中的 私訊 配對請求預設每個 頻道 **最多 3 個**；超出者會被忽略，直到其中一個過期或被核准。

### 核准傳送者

```bash
openclaw pairing list telegram
openclaw pairing approve telegram <CODE>
```

支援的 頻道： `telegram`, `whatsapp`, `signal`, `imessage`, `discord`, `slack`。

### 狀態存放位置

儲存在 `~/.openclaw/credentials/` 之下：

- 進行中的請求： `<channel>-pairing.json`
- 已核准的 allowlist 儲存區： `<channel>-allowFrom.json`

請將這些視為敏感資料（它們控管你助理的存取）。

## 2) 節點裝置 配對（iOS/Android/macOS/無介面 節點）

節點會以 **裝置** 的形式，使用 `role: node` 連線到 Gateway 閘道器。Gateway 閘道器
會建立一個必須被核准的裝置配對請求。

### 核准節點裝置

```bash
openclaw devices list
openclaw devices approve <requestId>
openclaw devices reject <requestId>
```

### 節點配對狀態儲存

儲存在 `~/.openclaw/devices/` 之下：

- `pending.json`（短期；進行中的請求會過期）
- `paired.json`（已配對的裝置 + 權杖）

### 注意事項

- 舊版的 `node.pair.*` API（CLI： `openclaw nodes pending/approve`）是
  獨立的、由 Gateway 閘道器 擁有的配對儲存區。WS 節點仍需要裝置配對。

## 相關文件

- 安全模型 + 提示注入： [Security](/gateway/security)
- 安全更新（執行 doctor）： [Updating](/install/updating)
- 頻道 設定：
  - Telegram： [Telegram](/channels/telegram)
  - WhatsApp： [WhatsApp](/channels/whatsapp)
  - Signal： [Signal](/channels/signal)
  - BlueBubbles（iMessage）： [BlueBubbles](/channels/bluebubbles)
  - iMessage（舊版）： [iMessage](/channels/imessage)
  - Discord： [Discord](/channels/discord)
  - Slack： [Slack](/channels/slack)

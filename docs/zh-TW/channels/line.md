---
summary: 「LINE Messaging API 外掛程式的設定、組態與使用方式」
read_when:
  - 你想要將 OpenClaw 連接到 LINE
  - 你需要設定 LINE webhook 與憑證
  - 你想要使用 LINE 專屬的訊息選項
title: LINE
x-i18n:
  source_path: channels/line.md
  source_hash: 8fbac126786f95b9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:23Z
---

# LINE（外掛程式）

LINE 透過 LINE Messaging API 連接到 OpenClaw。此外掛程式會在 Gateway 閘道器上以 webhook
接收器的形式運作，並使用你的 channel access token 與 channel secret 進行
驗證。

狀態：已透過外掛程式支援。支援私訊、群組聊天、媒體、位置、Flex
訊息、範本訊息與快速回覆。不支援表情回應與串討論。

## 需要外掛程式

安裝 LINE 外掛程式：

```bash
openclaw plugins install @openclaw/line
```

本機檢出（從 git 儲存庫執行時）：

```bash
openclaw plugins install ./extensions/line
```

## 設定

1. 建立 LINE Developers 帳號並開啟主控台：
   https://developers.line.biz/console/
2. 建立（或選擇）一個 Provider，並新增 **Messaging API** 頻道。
3. 從頻道設定中複製 **Channel access token** 與 **Channel secret**。
4. 在 Messaging API 設定中啟用 **Use webhook**。
5. 將 webhook URL 設為你的 Gateway 閘道器端點（必須為 HTTPS）：

```
https://gateway-host/line/webhook
```

Gateway 閘道器會回應 LINE 的 webhook 驗證（GET）與傳入事件（POST）。
如果你需要自訂路徑，請設定 `channels.line.webhookPath` 或
`channels.line.accounts.<id>.webhookPath`，並相應更新 URL。

## 組態

最小組態：

```json5
{
  channels: {
    line: {
      enabled: true,
      channelAccessToken: "LINE_CHANNEL_ACCESS_TOKEN",
      channelSecret: "LINE_CHANNEL_SECRET",
      dmPolicy: "pairing",
    },
  },
}
```

環境變數（僅限預設帳號）：

- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`

Token／secret 檔案：

```json5
{
  channels: {
    line: {
      tokenFile: "/path/to/line-token.txt",
      secretFile: "/path/to/line-secret.txt",
    },
  },
}
```

多帳號：

```json5
{
  channels: {
    line: {
      accounts: {
        marketing: {
          channelAccessToken: "...",
          channelSecret: "...",
          webhookPath: "/line/marketing",
        },
      },
    },
  },
}
```

## 存取控制

私訊預設需要配對。未知的寄件者會收到一組配對碼，且在核准前其
訊息會被忽略。

```bash
openclaw pairing list line
openclaw pairing approve line <CODE>
```

允許清單與政策：

- `channels.line.dmPolicy`：`pairing | allowlist | open | disabled`
- `channels.line.allowFrom`：允許清單中的 LINE 使用者 ID（用於私訊）
- `channels.line.groupPolicy`：`allowlist | open | disabled`
- `channels.line.groupAllowFrom`：允許清單中的 LINE 使用者 ID（用於群組）
- 逐群組覆寫：`channels.line.groups.<groupId>.allowFrom`

LINE ID 區分大小寫。有效的 ID 範例如下：

- 使用者：`U` + 32 個十六進位字元
- 群組：`C` + 32 個十六進位字元
- 房間：`R` + 32 個十六進位字元

## 訊息行為

- 文字會以每 5000 個字元分段。
- Markdown 格式會被移除；程式碼區塊與表格會在可行時轉換為 Flex
  卡片。
- 串流回應會被緩衝；在代理程式運作期間，LINE 會接收完整區塊並顯示
  載入動畫。
- 媒體下載上限由 `channels.line.mediaMaxMb` 限制（預設為 10）。

## 頻道資料（豐富訊息）

使用 `channelData.line` 來傳送快速回覆、位置、Flex 卡片或範本
訊息。

```json5
{
  text: "Here you go",
  channelData: {
    line: {
      quickReplies: ["Status", "Help"],
      location: {
        title: "Office",
        address: "123 Main St",
        latitude: 35.681236,
        longitude: 139.767125,
      },
      flexMessage: {
        altText: "Status card",
        contents: {
          /* Flex payload */
        },
      },
      templateMessage: {
        type: "confirm",
        text: "Proceed?",
        confirmLabel: "Yes",
        confirmData: "yes",
        cancelLabel: "No",
        cancelData: "no",
      },
    },
  },
}
```

LINE 外掛程式也隨附一個 `/card` 指令，用於 Flex 訊息預設集：

```
/card info "Welcome" "Thanks for joining!"
```

## 疑難排解

- **Webhook 驗證失敗：** 請確保 webhook URL 為 HTTPS，且
  `channelSecret` 與 LINE 主控台相符。
- **沒有傳入事件：** 請確認 webhook 路徑與 `channels.line.webhookPath`
  相符，且 Gateway 閘道器可從 LINE 連線。
- **媒體下載錯誤：** 若媒體超過
  預設限制，請提高 `channels.line.mediaMaxMb`。

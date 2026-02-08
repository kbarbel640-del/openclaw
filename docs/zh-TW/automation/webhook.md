---
summary: 「用於喚醒與隔離代理程式執行的 Webhook 入口」
read_when:
  - 新增或變更 Webhook 端點
  - 將外部系統接入 OpenClaw
title: 「Webhooks」
x-i18n:
  source_path: automation/webhook.md
  source_hash: f26b88864567be82
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:32Z
---

# Webhooks

Gateway 閘道器 可以公開一個小型的 HTTP Webhook 端點，供外部觸發使用。

## 啟用

```json5
{
  hooks: {
    enabled: true,
    token: "shared-secret",
    path: "/hooks",
  },
}
```

注意事項：

- 當 `hooks.enabled=true` 時，必須提供 `hooks.token`。
- `hooks.path` 預設為 `/hooks`。

## 驗證

每個請求都必須包含 hook token。建議使用標頭：

- `Authorization: Bearer <token>`（建議）
- `x-openclaw-token: <token>`
- `?token=<token>`（已棄用；會記錄警告，並將在未來的主要版本中移除）

## 端點

### `POST /hooks/wake`

Payload：

```json
{ "text": "System line", "mode": "now" }
```

- `text` **必填**（string）：事件的描述（例如，「New email received」）。
- `mode` 選填（`now` | `next-heartbeat`）：是否立即觸發心跳（預設為 `now`），或等待下一次定期檢查。

效果：

- 為 **main** 工作階段加入一個系統事件佇列
- 若 `mode=now`，則立即觸發心跳

### `POST /hooks/agent`

Payload：

```json
{
  "message": "Run this",
  "name": "Email",
  "sessionKey": "hook:email:msg-123",
  "wakeMode": "now",
  "deliver": true,
  "channel": "last",
  "to": "+15551234567",
  "model": "openai/gpt-5.2-mini",
  "thinking": "low",
  "timeoutSeconds": 120
}
```

- `message` **必填**（string）：要讓代理程式處理的提示或訊息。
- `name` 選填（string）：hook 的人類可讀名稱（例如，「GitHub」），用作工作階段摘要中的前綴。
- `sessionKey` 選填（string）：用於識別代理程式工作階段的金鑰。預設為隨機的 `hook:<uuid>`。使用一致的金鑰可在 hook 情境中進行多回合對話。
- `wakeMode` 選填（`now` | `next-heartbeat`）：是否立即觸發心跳（預設為 `now`），或等待下一次定期檢查。
- `deliver` 選填（boolean）：若為 `true`，代理程式的回應將傳送到訊息頻道。預設為 `true`。僅為心跳確認的回應會自動略過。
- `channel` 選填（string）：用於傳送的訊息頻道。可選其一：`last`、`whatsapp`、`telegram`、`discord`、`slack`、`mattermost`（plugin）、`signal`、`imessage`、`msteams`。預設為 `last`。
- `to` 選填（string）：頻道的收件者識別碼（例如，WhatsApp／Signal 的電話號碼、Telegram 的 chat ID、Discord／Slack／Mattermost（plugin） 的 channel ID、Microsoft Teams 的 conversation ID）。預設為 main 工作階段中的最後一個收件者。
- `model` 選填（string）：模型覆寫（例如，`anthropic/claude-3-5-sonnet` 或別名）。若有限制，必須在允許的模型清單中。
- `thinking` 選填（string）：思考等級覆寫（例如，`low`、`medium`、`high`）。
- `timeoutSeconds` 選填（number）：代理程式執行的最長時間（秒）。

效果：

- 執行一次 **隔離的** 代理程式回合（使用自己的工作階段金鑰）
- 一律將摘要張貼到 **main** 工作階段
- 若 `wakeMode=now`，則立即觸發心跳

### `POST /hooks/<name>`（mapped）

自訂 hook 名稱會透過 `hooks.mappings`（見設定）解析。對應可將任意 payload 轉換為 `wake` 或 `agent` 動作，並可選用樣板或程式碼轉換。

對應選項（摘要）：

- `hooks.presets: ["gmail"]` 會啟用內建的 Gmail 對應。
- `hooks.mappings` 讓你在設定中定義 `match`、`action` 與樣板。
- `hooks.transformsDir` + `transform.module` 會載入 JS／TS 模組以實作自訂邏輯。
- 使用 `match.source` 以保留通用的匯入端點（以 payload 驅動的路由）。
- TS 轉換需要 TS 載入器（例如 `bun` 或 `tsx`），或在執行階段使用預先編譯的 `.js`。
- 在對應上設定 `deliver: true` + `channel`/`to`，即可將回覆路由到聊天介面
  （`channel` 預設為 `last`，並在失敗時回退至 WhatsApp）。
- `allowUnsafeExternalContent: true` 會停用該 hook 的外部內容安全包裝
  （危險；僅適用於受信任的內部來源）。
- `openclaw webhooks gmail setup` 會為 `openclaw webhooks gmail run` 寫入 `hooks.gmail` 設定。
  完整的 Gmail watch 流程請見 [Gmail Pub/Sub](/automation/gmail-pubsub)。

## 回應

- `200` 用於 `/hooks/wake`
- `202` 用於 `/hooks/agent`（已啟動非同步執行）
- 驗證失敗時回傳 `401`
- Payload 無效時回傳 `400`
- Payload 過大時回傳 `413`

## 範例

```bash
curl -X POST http://127.0.0.1:18789/hooks/wake \
  -H 'Authorization: Bearer SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"text":"New email received","mode":"now"}'
```

```bash
curl -X POST http://127.0.0.1:18789/hooks/agent \
  -H 'x-openclaw-token: SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"message":"Summarize inbox","name":"Email","wakeMode":"next-heartbeat"}'
```

### 使用不同的模型

在代理程式 payload（或對應）中加入 `model`，即可為該次執行覆寫模型：

```bash
curl -X POST http://127.0.0.1:18789/hooks/agent \
  -H 'x-openclaw-token: SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"message":"Summarize inbox","name":"Email","model":"openai/gpt-5.2-mini"}'
```

若你強制使用 `agents.defaults.models`，請確保覆寫的模型包含在其中。

```bash
curl -X POST http://127.0.0.1:18789/hooks/gmail \
  -H 'Authorization: Bearer SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"source":"gmail","messages":[{"from":"Ada","subject":"Hello","snippet":"Hi"}]}'
```

## 安全性

- 將 hook 端點置於 loopback、tailnet，或受信任的反向代理之後。
- 使用專用的 hook token；不要重複使用 Gateway 閘道器 的驗證 token。
- 避免在 Webhook 記錄中包含敏感的原始 payload。
- Hook payload 預設視為不受信任，並以安全邊界包裝。
  若必須為特定 hook 停用此功能，請在該 hook 的對應中設定 `allowUnsafeExternalContent: true`
  （危險）。

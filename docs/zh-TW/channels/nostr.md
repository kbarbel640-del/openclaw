---
summary: 「透過 NIP-04 加密訊息的 Nostr 私訊頻道」
read_when:
  - 你希望 OpenClaw 透過 Nostr 接收私訊
  - 你正在設定去中心化訊息傳遞
title: 「Nostr」
x-i18n:
  source_path: channels/nostr.md
  source_hash: 6b9fe4c74bf5e7c0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:25Z
---

# Nostr

**狀態：** 選用外掛（預設停用）。

Nostr 是一種去中心化的社交網路通訊協定。此頻道可讓 OpenClaw 透過 NIP-04 接收並回覆加密的直接訊息（DMs）。

## 安裝（視需求）

### 入門引導（建議）

- 入門引導精靈（`openclaw onboard`）與 `openclaw channels add` 會列出選用的頻道外掛。
- 選取 Nostr 後，系統會提示你隨需安裝該外掛。

安裝預設行為：

- **Dev 頻道 + 可用的 git checkout：** 使用本機外掛路徑。
- **Stable/Beta：** 從 npm 下載。

你隨時可以在提示中覆寫此選擇。

### 手動安裝

```bash
openclaw plugins install @openclaw/nostr
```

使用本機 checkout（開發流程）：

```bash
openclaw plugins install --link <path-to-openclaw>/extensions/nostr
```

安裝或啟用外掛後，請重新啟動 Gateway 閘道器。

## 快速設定

1. 產生一組 Nostr 金鑰對（如需要）：

```bash
# Using nak
nak key generate
```

2. 新增至設定檔：

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}"
    }
  }
}
```

3. 匯出金鑰：

```bash
export NOSTR_PRIVATE_KEY="nsec1..."
```

4. 重新啟動 Gateway 閘道器。

## 設定參考

| Key          | Type     | Default                                     | Description                    |
| ------------ | -------- | ------------------------------------------- | ------------------------------ |
| `privateKey` | string   | required                                    | 私鑰，格式為 `nsec` 或十六進位 |
| `relays`     | string[] | `['wss://relay.damus.io', 'wss://nos.lol']` | 中繼站 URL（WebSocket）        |
| `dmPolicy`   | string   | `pairing`                                   | 私訊存取政策                   |
| `allowFrom`  | string[] | `[]`                                        | 允許的寄件者公鑰               |
| `enabled`    | boolean  | `true`                                      | 啟用／停用頻道                 |
| `name`       | string   | -                                           | 顯示名稱                       |
| `profile`    | object   | -                                           | NIP-01 個人檔案中繼資料        |

## 個人檔案中繼資料

個人檔案資料會以 NIP-01 的 `kind:0` 事件發佈。你可以從控制 UI（Channels -> Nostr -> Profile）進行管理，或直接在設定檔中設定。

範例：

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "profile": {
        "name": "openclaw",
        "displayName": "OpenClaw",
        "about": "Personal assistant DM bot",
        "picture": "https://example.com/avatar.png",
        "banner": "https://example.com/banner.png",
        "website": "https://example.com",
        "nip05": "openclaw@example.com",
        "lud16": "openclaw@example.com"
      }
    }
  }
}
```

注意事項：

- 個人檔案的 URL 必須使用 `https://`。
- 從中繼站匯入時會合併欄位，並保留本機覆寫值。

## 存取控制

### 私訊政策

- **pairing**（預設）：未知的寄件者會收到配對碼。
- **allowlist**：僅 `allowFrom` 中的公鑰可傳送私訊。
- **open**：公開接收私訊（需要 `allowFrom: ["*"]`）。
- **disabled**：忽略所有傳入的私訊。

### Allowlist 範例

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "dmPolicy": "allowlist",
      "allowFrom": ["npub1abc...", "npub1xyz..."]
    }
  }
}
```

## 金鑰格式

支援的格式：

- **私鑰：** `nsec...` 或 64 字元十六進位
- **公鑰（`allowFrom`）：** `npub...` 或十六進位

## 中繼站

預設值：`relay.damus.io` 與 `nos.lol`。

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "relays": ["wss://relay.damus.io", "wss://relay.primal.net", "wss://nostr.wine"]
    }
  }
}
```

建議：

- 使用 2–3 個中繼站以提高備援性。
- 避免使用過多中繼站（延遲、重複訊息）。
- 付費中繼站可提升可靠性。
- 本機中繼站適合用於測試（`ws://localhost:7777`）。

## 協定支援

| NIP    | Status    | Description                     |
| ------ | --------- | ------------------------------- |
| NIP-01 | Supported | 基本事件格式 + 個人檔案中繼資料 |
| NIP-04 | Supported | 加密私訊（`kind:4`）            |
| NIP-17 | Planned   | 禮物包裝私訊                    |
| NIP-44 | Planned   | 版本化加密                      |

## 測試

### 本機中繼站

```bash
# Start strfry
docker run -p 7777:7777 ghcr.io/hoytech/strfry
```

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "relays": ["ws://localhost:7777"]
    }
  }
}
```

### 手動測試

1. 從日誌中記下機器人的公鑰（npub）。
2. 開啟一個 Nostr 用戶端（Damus、Amethyst 等）。
3. 對該機器人公鑰傳送私訊。
4. 驗證回應是否正確。

## 疑難排解

### 未收到訊息

- 確認私鑰有效。
- 確保中繼站 URL 可連線，且使用 `wss://`（或本機使用 `ws://`）。
- 確認 `enabled` 不是 `false`。
- 檢查 Gateway 閘道器日誌是否有中繼站連線錯誤。

### 未送出回應

- 確認中繼站允許寫入。
- 檢查對外連線能力。
- 注意是否觸發中繼站速率限制。

### 重複回應

- 使用多個中繼站時屬於預期行為。
- 訊息會依事件 ID 去重；僅第一個送達會觸發回應。

## 安全性

- 切勿提交私鑰。
- 使用環境變數來存放金鑰。
- 生產環境機器人請考慮使用 `allowlist`。

## 限制（MVP）

- 僅支援直接私訊（不支援群組聊天）。
- 不支援媒體附件。
- 僅支援 NIP-04（規劃支援 NIP-17 禮物包裝）。

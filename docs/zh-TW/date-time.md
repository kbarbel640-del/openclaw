---
summary: 「跨信封、提示、工具與連接器的日期與時間處理」
read_when:
  - 當你正在變更時間戳記如何呈現給模型或使用者時
  - 當你正在除錯訊息或系統提示輸出中的時間格式時
title: 「日期與時間」
x-i18n:
  source_path: date-time.md
  source_hash: 753af5946a006215
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:13Z
---

# 日期與時間

OpenClaw 預設使用 **主機本地時間作為傳輸時間戳記**，而 **僅在系統提示中使用使用者時區**。
提供者的時間戳記會被保留，以確保工具維持其原生語意（目前時間可透過 `session_status` 取得）。

## 訊息信封（預設為本地）

傳入訊息會以時間戳記（分鐘精度）包裝：

```
[Provider ... 2026-01-05 16:26 PST] message text
```

此信封時間戳記 **預設為主機本地時間**，不論提供者的時區為何。

你可以覆寫此行為：

```json5
{
  agents: {
    defaults: {
      envelopeTimezone: "local", // "utc" | "local" | "user" | IANA timezone
      envelopeTimestamp: "on", // "on" | "off"
      envelopeElapsed: "on", // "on" | "off"
    },
  },
}
```

- `envelopeTimezone: "utc"` 使用 UTC。
- `envelopeTimezone: "local"` 使用主機時區。
- `envelopeTimezone: "user"` 使用 `agents.defaults.userTimezone`（若無則回退至主機時區）。
- 使用明確的 IANA 時區（例如 `"America/Chicago"`）以固定時區。
- `envelopeTimestamp: "off"` 會從信封標頭移除絕對時間戳記。
- `envelopeElapsed: "off"` 會移除經過時間的後綴（`+2m` 樣式）。

### 範例

**本地（預設）：**

```
[WhatsApp +1555 2026-01-18 00:19 PST] hello
```

**使用者時區：**

```
[WhatsApp +1555 2026-01-18 00:19 CST] hello
```

**啟用經過時間：**

```
[WhatsApp +1555 +30s 2026-01-18T05:19Z] follow-up
```

## 系統提示：目前日期與時間

若已知使用者時區，系統提示會包含專屬的
**目前日期與時間** 區段，且 **僅包含時區**（不含時鐘／時間格式），
以保持提示快取的穩定性：

```
Time zone: America/Chicago
```

當代理程式需要目前時間時，請使用 `session_status` 工具；狀態卡片包含一行時間戳記。

## 系統事件行（預設為本地）

插入到代理程式內容中的排隊系統事件，會使用與訊息信封相同的時區選擇
（預設：主機本地）作為前綴時間戳記。

```
System: [2026-01-12 12:19:17 PST] Model switched.
```

### 設定使用者時區 + 格式

```json5
{
  agents: {
    defaults: {
      userTimezone: "America/Chicago",
      timeFormat: "auto", // auto | 12 | 24
    },
  },
}
```

- `userTimezone` 設定 **使用者本地時區** 以供提示內容使用。
- `timeFormat` 控制提示中的 **12 小時／24 小時顯示**。`auto` 會遵循 OS 偏好設定。

## 時間格式偵測（自動）

當 `timeFormat: "auto"` 時，OpenClaw 會檢查 OS 偏好設定（macOS／Windows），
並在需要時回退至地區設定格式。偵測到的值會 **依行程快取**，
以避免重複的系統呼叫。

## 工具負載 + 連接器（原始提供者時間 + 正規化欄位）

頻道工具會回傳 **提供者原生的時間戳記**，並加入正規化欄位以維持一致性：

- `timestampMs`：epoch 毫秒（UTC）
- `timestampUtc`：ISO 8601 UTC 字串

原始的提供者欄位會被保留，不會遺失任何資料。

- Slack：來自 API 的類 epoch 字串
- Discord：UTC ISO 時間戳記
- Telegram／WhatsApp：提供者特定的數值／ISO 時間戳記

若需要本地時間，請使用已知的時區在下游進行轉換。

## 相關文件

- [System Prompt](/concepts/system-prompt)
- [Timezones](/concepts/timezone)
- [Messages](/concepts/messages)

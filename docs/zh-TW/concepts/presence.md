---
summary: "OpenClaw presence 項目的產生、合併與顯示方式"
read_when:
  - 偵錯 Instances 分頁
  - 調查重複或過期的 instance 列
  - 變更 Gateway WS 連線或 system-event 信標
title: "Presence"
x-i18n:
  source_path: concepts/presence.md
  source_hash: c752c76a880878fe
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:02Z
---

# Presence

OpenClaw「presence」是一種輕量、盡力而為的視圖，用來呈現：

- **Gateway** 本身，以及
- **連線到 Gateway 的用戶端**（mac app、WebChat、CLI 等）

Presence 主要用於呈現 macOS app 的 **Instances** 分頁，並提供操作人員的快速可視性。

## Presence 欄位（顯示內容）

Presence 項目是具有下列欄位的結構化物件：

- `instanceId`（可選但強烈建議）：穩定的用戶端身分（通常為 `connect.client.instanceId`）
- `host`：易於辨識的主機名稱
- `ip`：盡力而為的 IP 位址
- `version`：用戶端版本字串
- `deviceFamily` / `modelIdentifier`：硬體提示
- `mode`：`ui`、`webchat`、`cli`、`backend`、`probe`、`test`、`node`、…
- `lastInputSeconds`：「自上次使用者輸入起的秒數」（若可得）
- `reason`：`self`、`connect`、`node-connected`、`periodic`、…
- `ts`：最後更新時間戳（自 epoch 起算的毫秒）

## 產生者（presence 來源）

Presence 項目由多個來源產生，並會**合併**。

### 1) Gateway 自身項目

Gateway 會在啟動時一律建立一筆「self」項目，讓 UI 在任何用戶端連線之前就能顯示 Gateway 主機。

### 2) WebSocket 連線

每個 WS 用戶端都會以 `connect` 請求開始。握手成功後，Gateway 會為該連線 upsert 一筆 presence 項目。

#### 為什麼一次性的 CLI 指令不會顯示

CLI 常為短暫的一次性指令而連線。為避免洗版 Instances 清單，`client.mode === "cli"` **不會** 轉換為 presence 項目。

### 3) `system-event` 信標

用戶端可以透過 `system-event` 方法傳送較豐富的週期性信標。mac app 會使用此方式回報主機名稱、IP 與 `lastInputSeconds`。

### 4) Node 連線（角色：node）

當 node 以 `role: node` 透過 Gateway WebSocket 連線時，Gateway 會為該 node upsert 一筆 presence 項目（流程與其他 WS 用戶端相同）。

## 合併與去重規則（為什麼 `instanceId` 很重要）

Presence 項目儲存在單一的記憶體內 map 中：

- 項目以**presence key** 作為索引。
- 最佳的 key 是可跨重新啟動存活的穩定 `instanceId`（來自 `connect.client.instanceId`）。
- Key 不區分大小寫。

如果用戶端在重新連線時沒有穩定的 `instanceId`，就可能顯示為**重複**列。

## TTL 與容量上限

Presence 有意設計為短暫性資料：

- **TTL：** 超過 5 分鐘的項目會被清除
- **最大項目數：** 200（先丟棄最舊的）

這能讓清單保持新鮮，並避免記憶體無限制成長。

## 遠端／通道注意事項（loopback IP）

當用戶端透過 SSH 通道／本機連接埠轉送連線時，Gateway 可能會將遠端位址視為 `127.0.0.1`。為避免覆寫用戶端回報的正確 IP，會忽略 loopback 的遠端位址。

## 使用者

### macOS Instances 分頁

macOS app 會呈現 `system-presence` 的輸出，並依據最後一次更新的時間，套用小型狀態指示（Active／Idle／Stale）。

## 偵錯提示

- 若要查看原始清單，請對 Gateway 呼叫 `system-presence`。
- 若看到重複項目：
  - 確認用戶端在握手時送出穩定的 `client.instanceId`
  - 確認週期性信標使用相同的 `instanceId`
  - 檢查是否連線衍生的項目缺少 `instanceId`（此情況下出現重複屬於預期行為）

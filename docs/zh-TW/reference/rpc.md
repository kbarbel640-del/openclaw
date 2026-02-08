---
summary: 「用於外部 CLI（signal-cli、legacy imsg）的 RPC 轉接器與 Gateway 閘道器模式」
read_when:
  - 新增或變更外部 CLI 整合時
  - 偵錯 RPC 轉接器（signal-cli、imsg）時
title: 「RPC 轉接器」
x-i18n:
  source_path: reference/rpc.md
  source_hash: 06dc6b97184cc704
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:29Z
---

# RPC 轉接器

OpenClaw 透過 JSON-RPC 整合外部 CLI。目前使用兩種模式。

## 模式 A：HTTP 常駐程式（signal-cli）

- `signal-cli` 以常駐程式方式執行，透過 HTTP 提供 JSON-RPC。
- 事件串流為 SSE（`/api/v1/events`）。
- 健康探測：`/api/v1/check`。
- 當 `channels.signal.autoStart=true` 時，OpenClaw 會負責其生命週期。

設定與端點請參閱 [Signal](/channels/signal)。

## 模式 B：stdio 子行程（legacy：imsg）

> **注意：** 新的 iMessage 設定請改用 [BlueBubbles](/channels/bluebubbles)。

- OpenClaw 會將 `imsg rpc` 以子行程方式啟動（legacy iMessage 整合）。
- JSON-RPC 透過 stdin/stdout 以逐行方式傳輸（每行一個 JSON 物件）。
- 不需要 TCP 連接埠，也不需要常駐程式。

使用的核心方法：

- `watch.subscribe` → 通知（`method: "message"`）
- `watch.unsubscribe`
- `send`
- `chats.list`（探測／診斷）

legacy 設定與位址請參閱 [iMessage](/channels/imessage)（建議使用 `chat_id`）。

## 轉接器準則

- Gateway 閘道器 擁有行程（啟動／停止與提供者生命週期綁定）。
- 讓 RPC 用戶端具備韌性：設定逾時、行程結束時自動重新啟動。
- 優先使用穩定 ID（例如 `chat_id`），避免使用顯示字串。

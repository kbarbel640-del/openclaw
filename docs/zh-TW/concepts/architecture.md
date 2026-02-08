---
summary: "WebSocket Gateway 閘道器架構、元件與客戶端流程"
read_when:
  - 進行 Gateway 閘道器通訊協定、客戶端或傳輸協定相關工作時
title: "Gateway 架構"
x-i18n:
  source_path: concepts/architecture.md
  source_hash: c636d5d8a5e62806
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:57Z
---

# Gateway 架構

最後更新：2026-01-22

## 概覽

- 單一、長時間存活的 **Gateway** 擁有所有訊息介面（透過 Baileys 的 WhatsApp、透過 grammY 的 Telegram、Slack、Discord、Signal、iMessage、WebChat）。
- 控制平面客戶端（macOS 應用程式、CLI、Web UI、自動化）透過 **WebSocket** 連線至設定的綁定主機上的 Gateway（預設為 `127.0.0.1:18789`）。
- **Nodes**（macOS/iOS/Android/headless）同樣透過 **WebSocket** 連線，但會宣告 `role: node`，並附帶明確的功能（caps）與指令。
- 每個主機僅有一個 Gateway；它是唯一會開啟 WhatsApp 工作階段的地方。
- **canvas host**（預設為 `18793`）提供可由代理程式編輯的 HTML 與 A2UI。

## 元件與流程

### Gateway（常駐程式）

- 維護各提供者的連線。
- 提供具型別的 WS API（請求、回應、伺服器推送事件）。
- 依據 JSON Schema 驗證傳入的 frame。
- 發送事件，例如 `agent`、`chat`、`presence`、`health`、`heartbeat`、`cron`。

### Clients（mac 應用程式 / CLI / Web 管理介面）

- 每個客戶端一條 WS 連線。
- 傳送請求（`health`、`status`、`send`、`agent`、`system-presence`）。
- 訂閱事件（`tick`、`agent`、`presence`、`shutdown`）。

### Nodes（macOS / iOS / Android / headless）

- 使用 `role: node` 連線到 **相同的 WS 伺服器**。
- 在 `connect` 中提供裝置身分；配對為 **以裝置為基礎**（角色 `node`），
  核准資訊存放於裝置配對儲存區。
- 提供的指令包括 `canvas.*`、`camera.*`、`screen.record`、`location.get`。

通訊協定細節：

- [Gateway protocol](/gateway/protocol)

### WebChat

- 使用 Gateway WS API 取得聊天歷史並傳送訊息的靜態 UI。
- 在遠端設定中，透過與其他客戶端相同的 SSH/Tailscale 通道連線。

## 連線生命週期（單一客戶端）

```
Client                    Gateway
  |                          |
  |---- req:connect -------->|
  |<------ res (ok) ---------|   (or res error + close)
  |   (payload=hello-ok carries snapshot: presence + health)
  |                          |
  |<------ event:presence ---|
  |<------ event:tick -------|
  |                          |
  |------- req:agent ------->|
  |<------ res:agent --------|   (ack: {runId,status:"accepted"})
  |<------ event:agent ------|   (streaming)
  |<------ res:agent --------|   (final: {runId,status,summary})
  |                          |
```

## 線路通訊協定（摘要）

- 傳輸：WebSocket，文字 frame，JSON 負載。
- 第一個 frame **必須** 為 `connect`。
- 完成握手後：
  - 請求：`{type:"req", id, method, params}` → `{type:"res", id, ok, payload|error}`
  - 事件：`{type:"event", event, payload, seq?, stateVersion?}`
- 若設定 `OPENCLAW_GATEWAY_TOKEN`（或 `--token`），`connect.params.auth.token`
  必須相符，否則連線將關閉。
- 具有副作用的方法（`send`、`agent`）需要冪等性金鑰，
  以安全地重試；伺服器會保留短期的去重快取。
- Nodes 必須包含 `role: "node"`，並在 `connect` 中提供功能、指令與權限。

## 配對 + 本地信任

- 所有 WS 客戶端（操作人員 + nodes）都會在 `connect` 中包含 **裝置身分**。
- 新的裝置 ID 需要配對核准；Gateway 會發放 **裝置權杖** 供後續連線使用。
- **本地** 連線（loopback 或 Gateway 主機本身的 tailnet 位址）可自動核准，以維持同主機 UX 的順暢。
- **非本地** 連線必須簽署 `connect.challenge` nonce，並需要明確核准。
- Gateway 驗證（`gateway.auth.*`）仍適用於 **所有** 連線，無論本地或遠端。

詳情：[Gateway protocol](/gateway/protocol)、[Pairing](/start/pairing)、
[Security](/gateway/security)。

## 通訊協定型別化與程式碼產生

- 使用 TypeBox schema 定義通訊協定。
- 由這些 schema 產生 JSON Schema。
- 由 JSON Schema 產生 Swift 模型。

## 遠端存取

- 建議方式：Tailscale 或 VPN。
- 替代方案：SSH 通道
  ```bash
  ssh -N -L 18789:127.0.0.1:18789 user@host
  ```
- 在通道上套用相同的握手與驗證權杖。
- 在遠端設定中可為 WS 啟用 TLS + 選用的憑證釘選。

## 營運快照

- 啟動：`openclaw gateway`（前景執行，記錄輸出至 stdout）。
- 健康狀態：透過 WS 的 `health`（也包含在 `hello-ok` 中）。
- 監管：使用 launchd/systemd 進行自動重新啟動。

## 不變條件

- 每個主機僅有一個 Gateway 控制單一 Baileys 工作階段。
- 握手為必要步驟；任何非 JSON 或非 connect 的第一個 frame 都會立即關閉連線。
- 事件不會重播；客戶端在出現缺口時必須重新整理。

---
summary: "以瀏覽器為基礎的 Gateway 控制 UI（聊天、節點、設定）"
read_when:
  - 你想要從瀏覽器操作 Gateway
  - 你想要在沒有 SSH 通道的情況下存取 Tailnet
title: "控制 UI"
x-i18n:
  source_path: web/control-ui.md
  source_hash: ad239e4a4354999a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:18Z
---

# 控制 UI（瀏覽器）

控制 UI 是一個由 Gateway 提供的精簡 **Vite + Lit** 單頁應用程式：

- 預設：`http://<host>:18789/`
- 可選前綴：設定 `gateway.controlUi.basePath`（例如 `/openclaw`）

它會在相同的連接埠上 **直接與 Gateway WebSocket 通訊**。

## 快速開啟（本機）

如果 Gateway 正在同一台電腦上執行，請開啟：

- http://127.0.0.1:18789/（或 http://localhost:18789/）

如果頁面無法載入，請先啟動 Gateway：`openclaw gateway`。

驗證會在 WebSocket 握手期間提供，方式如下：

- `connect.params.auth.token`
- `connect.params.auth.password`
  儀表板設定面板可讓你儲存權杖；密碼不會被持久化。
  入門引導精靈預設會產生一個 gateway 權杖，因此首次連線時請在此貼上。

## 裝置配對（首次連線）

當你從新的瀏覽器或裝置連線到控制 UI 時，Gateway
需要 **一次性的配對核准** —— 即使你與 `gateway.auth.allowTailscale: true` 位於同一個 Tailnet。
這是一項安全措施，用來防止未經授權的存取。

**你會看到的內容：**「disconnected (1008): pairing required」

**核准裝置的方法：**

```bash
# List pending requests
openclaw devices list

# Approve by request ID
openclaw devices approve <requestId>
```

核准後，該裝置會被記住，除非你使用 `openclaw devices revoke --device <id> --role <role>` 撤銷，否則不需要重新核准。關於權杖輪替與撤銷，請參閱
[Devices CLI](/cli/devices)。

**注意事項：**

- 本機連線（`127.0.0.1`）會自動核准。
- 遠端連線（LAN、Tailnet 等）需要明確核准。
- 每個瀏覽器設定檔都會產生唯一的裝置 ID，因此切換瀏覽器或
  清除瀏覽器資料都需要重新配對。

## 目前可用的功能

- 透過 Gateway WS 與模型聊天（`chat.history`、`chat.send`、`chat.abort`、`chat.inject`）
- 在聊天中串流工具呼叫 + 即時工具輸出卡片（代理程式事件）
- 頻道：WhatsApp/Telegram/Discord/Slack + 外掛頻道（Mattermost 等）的狀態 + QR 登入 + 每個頻道的設定（`channels.status`、`web.login.*`、`config.patch`）
- 執行個體：存在清單 + 重新整理（`system-presence`）
- 工作階段：清單 + 每個工作階段的思考/詳細輸出覆寫（`sessions.list`、`sessions.patch`）
- Cron 工作：清單/新增/執行/啟用/停用 + 執行歷史（`cron.*`）
- Skills：狀態、啟用/停用、安裝、API 金鑰更新（`skills.*`）
- 節點：清單 + 能力（`node.list`）
- Exec 核准：編輯 gateway 或節點允許清單 + 針對 `exec host=gateway/node` 詢問政策（`exec.approvals.*`）
- 設定：檢視/編輯 `~/.openclaw/openclaw.json`（`config.get`、`config.set`）
- 設定：套用 + 重新啟動並進行驗證（`config.apply`），並喚醒最後一個作用中的工作階段
- 設定寫入包含 base-hash 防護，以避免覆寫並行編輯
- 設定結構描述 + 表單渲染（`config.schema`，包含外掛 + 頻道結構描述）；Raw JSON 編輯器仍可使用
- 偵錯：狀態/健康狀況/模型快照 + 事件記錄 + 手動 RPC 呼叫（`status`、`health`、`models.list`）
- 記錄：即時追蹤 gateway 檔案記錄，支援篩選/匯出（`logs.tail`）
- 更新：執行套件/git 更新 + 重新啟動（`update.run`），並提供重新啟動報告

Cron 工作面板注意事項：

- 對於隔離的工作，傳遞預設為公告摘要。如果你只想要內部執行，可切換為 none。
- 當選擇 announce 時，會顯示頻道/目標欄位。

## 聊天行為

- `chat.send` 是 **非阻塞的**：會立即以 `{ runId, status: "started" }` 回應，並透過 `chat` 事件串流回傳結果。
- 使用相同的 `idempotencyKey` 重新送出時，執行中會回傳 `{ status: "in_flight" }`，完成後回傳 `{ status: "ok" }`。
- `chat.inject` 會在工作階段逐字稿中附加一則助理備註，並廣播一個 `chat` 事件，僅供 UI 更新使用（不執行代理程式、不進行頻道傳遞）。
- 停止：
  - 點擊 **Stop**（呼叫 `chat.abort`）
  - 輸入 `/stop`（或 `stop|esc|abort|wait|exit|interrupt`）以進行帶外中止
  - `chat.abort` 支援 `{ sessionKey }`（不需要 `runId`），可中止該工作階段的所有作用中執行

## Tailnet 存取（建議）

### 整合式 Tailscale Serve（首選）

將 Gateway 保持在 loopback，並讓 Tailscale Serve 以 HTTPS 進行代理：

```bash
openclaw gateway --tailscale serve
```

開啟：

- `https://<magicdns>/`（或你設定的 `gateway.controlUi.basePath`）

預設情況下，當 `gateway.auth.allowTailscale` 為 `true` 時，Serve 請求可以透過 Tailscale 身分標頭進行驗證
（`tailscale-user-login`）。OpenClaw 會透過 `tailscale whois` 解析
`x-forwarded-for` 位址來驗證身分，並與標頭比對，而且只會在請求命中 loopback 且帶有 Tailscale 的 `x-forwarded-*` 標頭時接受這些請求。
如果你希望即使是 Serve 流量也必須使用權杖/密碼，請設定
`gateway.auth.allowTailscale: false`（或強制 `gateway.auth.mode: "password"`）。

### 綁定到 tailnet + 權杖

```bash
openclaw gateway --bind tailnet --token "$(openssl rand -hex 32)"
```

然後開啟：

- `http://<tailscale-ip>:18789/`（或你設定的 `gateway.controlUi.basePath`）

將權杖貼到 UI 設定中（會以 `connect.params.auth.token` 傳送）。

## 不安全的 HTTP

如果你透過純 HTTP（`http://<lan-ip>` 或 `http://<tailscale-ip>`）開啟儀表板，
瀏覽器會在 **非安全內容** 中執行，並封鎖 WebCrypto。預設情況下，
OpenClaw **會阻擋** 沒有裝置身分的控制 UI 連線。

**建議的修正方式：** 使用 HTTPS（Tailscale Serve）或在本機開啟 UI：

- `https://<magicdns>/`（Serve）
- `http://127.0.0.1:18789/`（在 gateway 主機上）

**降級範例（僅在 HTTP 上使用權杖）：**

```json5
{
  gateway: {
    controlUi: { allowInsecureAuth: true },
    bind: "tailnet",
    auth: { mode: "token", token: "replace-me" },
  },
}
```

這會停用控制 UI 的裝置身分 + 配對（即使在 HTTPS 上也是如此）。僅在你信任該網路時使用。

關於 HTTPS 設定指引，請參閱 [Tailscale](/gateway/tailscale)。

## 建置 UI

Gateway 會從 `dist/control-ui` 提供靜態檔案。使用以下指令建置：

```bash
pnpm ui:build # auto-installs UI deps on first run
```

可選的絕對 base（當你需要固定的資產 URL 時）：

```bash
OPENCLAW_CONTROL_UI_BASE_PATH=/openclaw/ pnpm ui:build
```

本機開發（獨立的 dev 伺服器）：

```bash
pnpm ui:dev # auto-installs UI deps on first run
```

接著將 UI 指向你的 Gateway WS URL（例如 `ws://127.0.0.1:18789`）。

## 偵錯/測試：dev 伺服器 + 遠端 Gateway

控制 UI 是靜態檔案；WebSocket 目標是可設定的，且可以與 HTTP 來源不同。這在你想要在本機使用 Vite dev 伺服器，但 Gateway 執行在其他地方時非常方便。

1. 啟動 UI dev 伺服器：`pnpm ui:dev`
2. 開啟如下的 URL：

```text
http://localhost:5173/?gatewayUrl=ws://<gateway-host>:18789
```

可選的一次性驗證（如有需要）：

```text
http://localhost:5173/?gatewayUrl=wss://<gateway-host>:18789&token=<gateway-token>
```

注意事項：

- `gatewayUrl` 會在載入後儲存在 localStorage，並從 URL 中移除。
- `token` 會儲存在 localStorage；`password` 僅保留在記憶體中。
- 當設定 `gatewayUrl` 時，UI 不會回退使用設定或環境變數中的認證。
  必須明確提供 `token`（或 `password`）。缺少明確的認證會視為錯誤。
- 當 Gateway 位於 TLS 後方（Tailscale Serve、HTTPS 代理等）時，請使用 `wss://`。
- 為防止點擊劫持，`gatewayUrl` 僅在頂層視窗中接受（不可嵌入）。
- 對於跨來源的 dev 設定（例如 `pnpm ui:dev` 指向遠端 Gateway），請將 UI
  來源加入 `gateway.controlUi.allowedOrigins`。

範例：

```json5
{
  gateway: {
    controlUi: {
      allowedOrigins: ["http://localhost:5173"],
    },
  },
}
```

遠端存取設定詳情：[Remote access](/gateway/remote)。

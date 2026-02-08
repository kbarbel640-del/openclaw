---
summary: "Gateway Web 介面：控制 UI、綁定模式與安全性"
read_when:
  - 您想透過 Tailscale 存取 Gateway
  - 您需要瀏覽器的控制 UI 與設定編輯
title: "Web"
x-i18n:
  source_path: web/index.md
  source_hash: 1315450b71a799c8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:04Z
---

# Web（Gateway）

Gateway 會從與 Gateway WebSocket 相同的連接埠提供一個小型的 **瀏覽器控制 UI**（Vite + Lit）：

- 預設：`http://<host>:18789/`
- 可選前綴：設定 `gateway.controlUi.basePath`（例如：`/openclaw`）

功能說明位於 [Control UI](/web/control-ui)。
本頁重點介紹綁定模式、安全性，以及對外的 Web 介面。

## Webhooks

當 `hooks.enabled=true` 時，Gateway 也會在同一個 HTTP 伺服器上提供一個小型的 webhook 端點。
關於驗證與負載，請參閱 [Gateway 設定](/gateway/configuration) → `hooks`。

## 設定（預設啟用）

當資產存在時，控制 UI **預設啟用**（`dist/control-ui`）。
您可以透過設定來控制：

```json5
{
  gateway: {
    controlUi: { enabled: true, basePath: "/openclaw" }, // basePath optional
  },
}
```

## Tailscale 存取

### 整合式 Serve（建議）

將 Gateway 保持在 loopback，並讓 Tailscale Serve 代理：

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "serve" },
  },
}
```

接著啟動 Gateway：

```bash
openclaw gateway
```

開啟：

- `https://<magicdns>/`（或您設定的 `gateway.controlUi.basePath`）

### Tailnet 綁定 + 權杖

```json5
{
  gateway: {
    bind: "tailnet",
    controlUi: { enabled: true },
    auth: { mode: "token", token: "your-token" },
  },
}
```

接著啟動 Gateway（非 loopback 綁定需要權杖）：

```bash
openclaw gateway
```

開啟：

- `http://<tailscale-ip>:18789/`（或您設定的 `gateway.controlUi.basePath`）

### 公共網際網路（Funnel）

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "funnel" },
    auth: { mode: "password" }, // or OPENCLAW_GATEWAY_PASSWORD
  },
}
```

## 安全性注意事項

- 預設需要 Gateway 驗證（權杖／密碼或 Tailscale 身分標頭）。
- 非 loopback 綁定仍然**必須**使用共用權杖／密碼（`gateway.auth` 或環境變數）。
- 精靈預設會產生一個 Gateway 權杖（即使在 loopback 上）。
- UI 會送出 `connect.params.auth.token` 或 `connect.params.auth.password`。
- 控制 UI 會送出防止點擊劫持的標頭，且除非設定 `gateway.controlUi.allowedOrigins`，否則只接受同源瀏覽器的 WebSocket 連線。
- 使用 Serve 時，當 `gateway.auth.allowTailscale` 為 `true`，Tailscale 身分標頭即可滿足驗證（不需要權杖／密碼）。設定
  `gateway.auth.allowTailscale: false` 以要求明確的憑證。請參閱
  [Tailscale](/gateway/tailscale) 與 [Security](/gateway/security)。
- `gateway.tailscale.mode: "funnel"` 需要 `gateway.auth.mode: "password"`（共用密碼）。

## 建置 UI

Gateway 會從 `dist/control-ui` 提供靜態檔案。使用以下指令建置：

```bash
pnpm ui:build # auto-installs UI deps on first run
```

---
summary: "Gateway 儀表板（控制 UI）的存取與驗證"
read_when:
  - 變更儀表板驗證或曝露模式時
title: "儀表板"
x-i18n:
  source_path: web/dashboard.md
  source_hash: 852e359885574fa3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:04Z
---

# 儀表板（控制 UI）

Gateway 儀表板是預設由 `/` 提供的瀏覽器控制 UI
（可用 `gateway.controlUi.basePath` 覆寫）。

快速開啟（本機 Gateway）：

- http://127.0.0.1:18789/（或 http://localhost:18789/）

重要參考：

- [Control UI](/web/control-ui)：使用方式與 UI 功能。
- [Tailscale](/gateway/tailscale)：Serve／Funnel 自動化。
- [Web surfaces](/web)：綁定模式與安全性說明。

驗證會在 WebSocket 交握時透過 `connect.params.auth` 強制執行
（token 或密碼）。請參閱 [Gateway 設定](/gateway/configuration) 中的 `gateway.auth`。

安全注意事項：控制 UI 是「管理員介面」（聊天、設定、exec 核准）。
請勿公開對外。UI 會在首次載入後將 token 儲存在 `localStorage`。
建議使用 localhost、Tailscale Serve，或 SSH 通道。

## 快速路徑（建議）

- 完成入門引導後，CLI 會自動開啟儀表板並列印乾淨（未含 token）的連結。
- 隨時重新開啟：`openclaw dashboard`（複製連結、可行時開啟瀏覽器、無頭環境則顯示 SSH 提示）。
- 若 UI 要求驗證，請將 `gateway.auth.token`（或 `OPENCLAW_GATEWAY_TOKEN`）中的 token 貼到控制 UI 設定中。

## Token 基礎（本機 vs 遠端）

- **Localhost**：開啟 `http://127.0.0.1:18789/`。
- **Token 來源**：`gateway.auth.token`（或 `OPENCLAW_GATEWAY_TOKEN`）；連線後 UI 會在 localStorage 中儲存一份副本。
- **非 localhost**：使用 Tailscale Serve（若 `gateway.auth.allowTailscale: true` 則可免 token）、以 token 綁定 tailnet，或使用 SSH 通道。請參閱 [Web surfaces](/web)。

## 若看到「unauthorized」／1008

- 確認 Gateway 可連線（本機：`openclaw status`；遠端：建立 SSH 通道 `ssh -N -L 18789:127.0.0.1:18789 user@host`，再開啟 `http://127.0.0.1:18789/`）。
- 從 Gateway 主機取得 token：`openclaw config get gateway.auth.token`（或產生一個：`openclaw doctor --generate-gateway-token`）。
- 在儀表板設定中，將 token 貼到驗證欄位後再連線。

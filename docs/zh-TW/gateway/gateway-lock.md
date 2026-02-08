---
summary: 「使用 WebSocket 監聽器繫結的 Gateway 單例防護」
read_when:
  - 「執行或除錯 Gateway 程序時」
  - 「調查單一實例強制機制時」
title: 「Gateway 鎖定」
x-i18n:
  source_path: gateway/gateway-lock.md
  source_hash: 15fdfa066d1925da
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:19Z
---

# Gateway 鎖定

最後更新：2025-12-11

## 為什麼

- 確保在同一主機上，每個基礎連接埠只會執行一個 Gateway 實例；額外的 Gateway 必須使用隔離的設定檔與唯一的連接埠。
- 在發生當機／SIGKILL 時仍能存活，而不會留下過期的鎖定檔案。
- 當控制連接埠已被佔用時，能快速失敗並提供清楚的錯誤。

## 機制

- Gateway 在啟動時立即使用專用的 TCP 監聽器繫結 WebSocket 監聽器（預設為 `ws://127.0.0.1:18789`）。
- 若繫結因 `EADDRINUSE` 失敗，啟動流程會拋出 `GatewayLockError("another gateway instance is already listening on ws://127.0.0.1:<port>")`。
- 作業系統會在任何程序結束時（包含當機與 SIGKILL）自動釋放監聽器——不需要獨立的鎖定檔案或清理步驟。
- 在關閉時，Gateway 會關閉 WebSocket 伺服器與底層的 HTTP 伺服器，以迅速釋放連接埠。

## 錯誤呈現

- 若連接埠被其他程序佔用，啟動時會拋出 `GatewayLockError("another gateway instance is already listening on ws://127.0.0.1:<port>")`。
- 其他繫結失敗則會呈現為 `GatewayLockError("failed to bind gateway socket on ws://127.0.0.1:<port>: …")`。

## 操作注意事項

- 若連接埠被「另一個」程序佔用，錯誤訊息相同；請釋放該連接埠，或使用 `openclaw gateway --port <port>` 選擇另一個。
- macOS 應用程式在啟動 Gateway 之前仍會維持其自身的輕量 PID 防護；執行階段的鎖定則由 WebSocket 繫結強制實施。

---
summary: 「mac app 如何嵌入 Gateway WebChat，以及如何進行除錯」
read_when:
  - 除錯 mac WebChat 檢視或 loopback 連接埠時
title: 「WebChat」
x-i18n:
  source_path: platforms/mac/webchat.md
  source_hash: 04ff448758e53009
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:06Z
---

# WebChat（macOS app）

macOS 選單列 app 會將 WebChat UI 以原生 SwiftUI 檢視嵌入。它會連線至 Gateway 閘道器，並預設使用所選代理程式的 **主要工作階段**（也提供工作階段切換器以切換至其他工作階段）。

- **本機模式**：直接連線至本機 Gateway WebSocket。
- **遠端模式**：透過 SSH 轉送 Gateway 控制連接埠，並將該通道作為資料平面。

## 啟動與除錯

- 手動：Lobster 選單 → 「Open Chat」。
- 測試時自動開啟：
  ```bash
  dist/OpenClaw.app/Contents/MacOS/OpenClaw --webchat
  ```
- 記錄：`./scripts/clawlog.sh`（子系統 `bot.molt`，分類 `WebChatSwiftUI`）。

## 連線方式說明

- 資料平面：Gateway WS 方法 `chat.history`、`chat.send`、`chat.abort`、
  `chat.inject`，以及事件 `chat`、`agent`、`presence`、`tick`、`health`。
- 工作階段：預設為主要工作階段（`main`，或在 scope 為
  global 時使用 `global`）。UI 可在不同工作階段之間切換。
- 入門引導會使用專用的工作階段，以將首次執行的設定流程分離。

## 安全面向

- 遠端模式僅透過 SSH 轉送 Gateway WebSocket 控制連接埠。

## 已知限制

- UI 針對聊天工作階段進行最佳化（並非完整的瀏覽器沙箱）。

---
summary: "OpenClaw 應用程式、Gateway 閘道器 節點傳輸，以及 PeekabooBridge 的 macOS IPC 架構"
read_when:
  - 編輯 IPC 合約或選單列應用程式 IPC
title: "macOS IPC"
x-i18n:
  source_path: platforms/mac/xpc.md
  source_hash: d0211c334a4a59b7
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:11Z
---

# OpenClaw macOS IPC 架構

**目前模型：** 使用本機 Unix socket 將 **node 主機服務** 連接到 **macOS 應用程式**，用於執行核准 + `system.run`。另有一個 `openclaw-mac` 的除錯 CLI 供裝置探索／連線檢查；代理程式動作仍透過 Gateway WebSocket 與 `node.invoke` 流轉。UI 自動化使用 PeekabooBridge。

## 目標

- 單一 GUI 應用程式實例，負責所有面向 TCC 的工作（通知、螢幕錄製、麥克風、語音、AppleScript）。
- 精簡的自動化介面：Gateway + node 指令，並以 PeekabooBridge 進行 UI 自動化。
- 可預期的權限：始終使用相同的已簽署 bundle ID，由 launchd 啟動，讓 TCC 授權得以維持。

## 運作方式

### Gateway + node 傳輸

- 應用程式以本機模式執行 Gateway，並以 node 身分連線至它。
- 代理程式動作透過 `node.invoke` 執行（例如：`system.run`、`system.notify`、`canvas.*`）。

### Node 服務 + 應用程式 IPC

- 無介面的 node 主機服務連線至 Gateway WebSocket。
- `system.run` 請求會透過本機 Unix socket 轉送到 macOS 應用程式。
- 應用程式在 UI 情境中執行指令，必要時提示使用者，並回傳輸出。

圖（SCI）：

```
Agent -> Gateway -> Node Service (WS)
                      |  IPC (UDS + token + HMAC + TTL)
                      v
                  Mac App (UI + TCC + system.run)
```

### PeekabooBridge（UI 自動化）

- UI 自動化使用名為 `bridge.sock` 的獨立 UNIX socket 與 PeekabooBridge JSON 通訊協定。
- 主機偏好順序（用戶端）：Peekaboo.app → Claude.app → OpenClaw.app → 本機執行。
- 安全性：橋接主機需具備允許的 TeamID；僅限 DEBUG 的同 UID 逃生門由 `PEEKABOO_ALLOW_UNSIGNED_SOCKET_CLIENTS=1`（Peekaboo 慣例）保護。
- 另請參閱：[PeekabooBridge 使用方式](/platforms/mac/peekaboo) 了解詳情。

## 操作流程

- 重新啟動／重新建置：`SIGN_IDENTITY="Apple Development: <Developer Name> (<TEAMID>)" scripts/restart-mac.sh`
  - 終止既有實例
  - Swift 建置 + 封裝
  - 寫入／初始化／啟動 LaunchAgent
- 單一實例：若偵測到相同 bundle ID 的另一個實例正在執行，應用程式會提早結束。

## 強化注意事項

- 優先要求所有具權限的介面皆符合 TeamID 比對。
- PeekabooBridge：`PEEKABOO_ALLOW_UNSIGNED_SOCKET_CLIENTS=1`（僅限 DEBUG）可能允許同 UID 呼叫者用於本機開發。
- 所有通訊皆維持為僅限本機；不對外暴露任何網路 socket。
- TCC 提示僅由 GUI 應用程式 bundle 觸發；請在重建期間維持已簽署的 bundle ID 穩定。
- IPC 強化：socket 模式 `0600`、權杖、對端 UID 檢查、HMAC 挑戰／回應、短 TTL。

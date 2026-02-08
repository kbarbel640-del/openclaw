---
summary: "適用於 macOS UI 自動化的 PeekabooBridge 整合"
read_when:
  - 在 OpenClaw.app 中託管 PeekabooBridge
  - 透過 Swift Package Manager 整合 Peekaboo
  - 變更 PeekabooBridge 的通訊協定／路徑
title: "Peekaboo Bridge"
x-i18n:
  source_path: platforms/mac/peekaboo.md
  source_hash: b5b9ddb9a7c59e15
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:05Z
---

# Peekaboo Bridge（macOS UI 自動化）

OpenClaw 可將 **PeekabooBridge** 作為具備本機權限感知的 UI 自動化代理主機來託管。這讓 `peekaboo` CLI 能夠驅動 UI 自動化，同時重用 macOS App 的 TCC 權限。

## 這是什麼（以及不是什麼）

- **Host**：OpenClaw.app 可作為 PeekabooBridge 的主機。
- **Client**：使用 `peekaboo` CLI（不需要獨立的 `openclaw ui ...` 介面）。
- **UI**：視覺疊加層仍保留在 Peekaboo.app；OpenClaw 是精簡的代理主機。

## 啟用 Bridge

在 macOS App 中：

- 設定 → **啟用 Peekaboo Bridge**

啟用後，OpenClaw 會啟動本機 UNIX socket 伺服器。若停用，主機會停止，且 `peekaboo` 會回退到其他可用的主機。

## Client 探索順序

Peekaboo Client 通常依下列順序嘗試主機：

1. Peekaboo.app（完整 UX）
2. Claude.app（若已安裝）
3. OpenClaw.app（精簡代理）

使用 `peekaboo bridge status --verbose` 查看目前啟用的主機以及正在使用的 socket 路徑。你也可以覆寫為：

```bash
export PEEKABOO_BRIDGE_SOCKET=/path/to/bridge.sock
```

## 安全性與權限

- Bridge 會驗證 **呼叫端的程式碼簽章**；並強制套用 TeamID 的允許清單（Peekaboo 主機 TeamID + OpenClaw App TeamID）。
- 請求在約 10 秒後逾時。
- 若缺少必要權限，Bridge 會回傳清楚的錯誤訊息，而不是啟動「系統設定」。

## 快照行為（自動化）

快照會儲存在記憶體中，並在短時間後自動過期。若需要更長的保留時間，請由 Client 重新擷取。

## 疑難排解

- 若 `peekaboo` 回報「bridge client is not authorized」，請確認 Client 已正確簽章，或僅在 **debug** 模式下使用 `PEEKABOO_ALLOW_UNSIGNED_SOCKET_CLIENTS=1` 執行主機。
- 若找不到任何主機，請開啟其中一個主機 App（Peekaboo.app 或 OpenClaw.app），並確認已授予必要權限。

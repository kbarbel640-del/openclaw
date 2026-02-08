---
summary: "OpenClaw macOS 配套應用程式（選單列 + Gateway 閘道器 broker）"
read_when:
  - 實作 macOS 應用程式功能
  - 變更 macOS 上的 Gateway 生命週期或節點橋接
title: "macOS 應用程式"
x-i18n:
  source_path: platforms/macos.md
  source_hash: a5b1c02e5905e4cb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:22Z
---

# OpenClaw macOS 配套應用程式（選單列 + Gateway 閘道器 broker）

macOS 應用程式是 OpenClaw 的 **選單列配套**。它負責權限管理，
在本機管理／附加 Gateway（launchd 或手動），並將 macOS 能力以節點形式暴露給代理程式。

## 功能說明

- 在選單列顯示原生通知與狀態。
- 管理 TCC 提示（通知、輔助使用、螢幕錄製、麥克風、
  語音辨識、Automation/AppleScript）。
- 執行或連線至 Gateway（本機或遠端）。
- 暴露僅限 macOS 的工具（Canvas、Camera、Screen Recording、`system.run`）。
- 在 **remote** 模式下啟動本機節點主機服務（launchd），在 **local** 模式下停止。
- 可選擇性地主持 **PeekabooBridge** 以進行 UI 自動化。
- 依需求透過 npm/pnpm 安裝全域 CLI（`openclaw`）（不建議使用 bun 作為 Gateway 執行階段）。

## Local 與 remote 模式

- **Local**（預設）：應用程式會附加到現有的本機 Gateway；
  若不存在，則透過 `openclaw gateway install` 啟用 launchd 服務。
- **Remote**：應用程式透過 SSH/Tailscale 連線至 Gateway，且不會啟動
  本機處理程序。
  應用程式會啟動本機 **node host service**，讓遠端 Gateway 能夠存取此 Mac。
  應用程式不會將 Gateway 作為子處理程序啟動。

## Launchd 控制

應用程式會管理一個使用者層級的 LaunchAgent，標籤為 `bot.molt.gateway`
（或在使用 `--profile`/`OPENCLAW_PROFILE` 時為 `bot.molt.<profile>`；舊版 `com.openclaw.*` 仍可卸載）。

```bash
launchctl kickstart -k gui/$UID/bot.molt.gateway
launchctl bootout gui/$UID/bot.molt.gateway
```

在執行具名設定檔時，請將標籤替換為 `bot.molt.<profile>`。

如果尚未安裝 LaunchAgent，可從應用程式中啟用，或執行
`openclaw gateway install`。

## 節點能力（mac）

macOS 應用程式會將自己呈現為一個節點。常見指令包括：

- Canvas：`canvas.present`、`canvas.navigate`、`canvas.eval`、`canvas.snapshot`、`canvas.a2ui.*`
- Camera：`camera.snap`、`camera.clip`
- Screen：`screen.record`
- System：`system.run`、`system.notify`

節點會回報一個 `permissions` 對應表，讓代理程式判斷允許的操作。

節點服務 + 應用程式 IPC：

- 當無頭節點主機服務執行中（remote 模式），它會作為節點連線至 Gateway WS。
- `system.run` 會在 macOS 應用程式中（UI/TCC 情境）透過本機 Unix socket 執行；提示與輸出皆保留在應用程式內。

圖示（SCI）：

```
Gateway -> Node Service (WS)
                 |  IPC (UDS + token + HMAC + TTL)
                 v
             Mac App (UI + TCC + system.run)
```

## Exec 核准（system.run）

`system.run` 由 macOS 應用程式中的 **Exec 核准** 控制（設定 → Exec 核准）。
安全性 + 詢問 + allowlist 會儲存在此 Mac 本機的：

```
~/.openclaw/exec-approvals.json
```

範例：

```json
{
  "version": 1,
  "defaults": {
    "security": "deny",
    "ask": "on-miss"
  },
  "agents": {
    "main": {
      "security": "allowlist",
      "ask": "on-miss",
      "allowlist": [{ "pattern": "/opt/homebrew/bin/rg" }]
    }
  }
}
```

備註：

- `allowlist` 項目是針對已解析二進位路徑的 glob 樣式。
- 在提示中選擇「Always Allow」會將該指令加入 allowlist。
- `system.run` 環境覆寫會先被過濾（移除 `PATH`、`DYLD_*`、`LD_*`、`NODE_OPTIONS`、`PYTHON*`、`PERL*`、`RUBYOPT`），然後再與應用程式的環境合併。

## Deep links

應用程式會註冊 `openclaw://` URL scheme 以供本機操作。

### `openclaw://agent`

觸發一個 Gateway 的 `agent` 請求。

```bash
open 'openclaw://agent?message=Hello%20from%20deep%20link'
```

查詢參數：

- `message`（必填）
- `sessionKey`（選填）
- `thinking`（選填）
- `deliver` / `to` / `channel`（選填）
- `timeoutSeconds`（選填）
- `key`（選填，無人值守模式金鑰）

安全性：

- 若未提供 `key`，應用程式會提示確認。
- 若提供有效的 `key`，則為無人值守執行（設計用於個人自動化）。

## 入門引導流程（典型）

1. 安裝並啟動 **OpenClaw.app**。
2. 完成權限檢查清單（TCC 提示）。
3. 確認 **Local** 模式啟用且 Gateway 正在執行。
4. 如需終端機存取，請安裝 CLI。

## 建置與開發流程（原生）

- `cd apps/macos && swift build`
- `swift run OpenClaw`（或 Xcode）
- 封裝應用程式：`scripts/package-mac-app.sh`

## 偵錯 Gateway 連線（macOS CLI）

使用偵錯 CLI 來測試與 macOS 應用程式相同的 Gateway WebSocket 握手與裝置探索
邏輯，而不需啟動應用程式。

```bash
cd apps/macos
swift run openclaw-mac connect --json
swift run openclaw-mac discover --timeout 3000 --json
```

連線選項：

- `--url <ws://host:port>`：覆寫設定
- `--mode <local|remote>`：從設定解析（預設：設定或本機）
- `--probe`：強制重新進行健康探測
- `--timeout <ms>`：請求逾時（預設：`15000`）
- `--json`：用於比對差異的結構化輸出

探索選項：

- `--include-local`：包含原本會被視為「local」而過濾的 Gateway
- `--timeout <ms>`：整體探索視窗（預設：`2000`）
- `--json`：用於比對差異的結構化輸出

提示：可與 `openclaw gateway discover --json` 進行比較，以判斷
macOS 應用程式的探索管線（NWBrowser + tailnet DNS‑SD 備援）是否與
Node CLI 基於 `dns-sd` 的探索有所不同。

## 遠端連線管線（SSH 通道）

當 macOS 應用程式以 **Remote** 模式執行時，會開啟一個 SSH 通道，讓本機 UI
元件能像連線至 localhost 一樣與遠端 Gateway 溝通。

### 控制通道（Gateway WebSocket 連接埠）

- **用途：** 健康檢查、狀態、Web Chat、設定，以及其他控制平面呼叫。
- **本機連接埠：** Gateway 連接埠（預設 `18789`），始終固定。
- **遠端連接埠：** 遠端主機上相同的 Gateway 連接埠。
- **行為：** 不使用隨機本機連接埠；應用程式會重用現有的健康通道，
  或在需要時重新啟動。
- **SSH 形式：** `ssh -N -L <local>:127.0.0.1:<remote>`，搭配 BatchMode +
  ExitOnForwardFailure + keepalive 選項。
- **IP 回報：** SSH 通道使用 loopback，因此 Gateway 看到的節點
  IP 會是 `127.0.0.1`。若希望顯示實際用戶端 IP，
  請使用 **Direct（ws/wss）** 傳輸（請參閱 [macOS remote access](/platforms/mac/remote)）。

設定步驟請參閱 [macOS remote access](/platforms/mac/remote)。協定
細節請參閱 [Gateway protocol](/gateway/protocol)。

## 相關文件

- [Gateway runbook](/gateway)
- [Gateway（macOS）](/platforms/mac/bundled-gateway)
- [macOS 權限](/platforms/mac/permissions)
- [Canvas](/platforms/mac/canvas)

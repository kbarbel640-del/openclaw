---
summary: 「透過 SSH 控制遠端 OpenClaw Gateway 閘道器的 macOS 應用程式流程」
read_when:
  - 設定或除錯遠端 mac 控制時
title: 「遠端控制」
x-i18n:
  source_path: platforms/mac/remote.md
  source_hash: 61b43707250d5515
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:12Z
---

# Remote OpenClaw（macOS ⇄ 遠端主機）

此流程讓 macOS 應用程式作為完整的遠端控制器，控制執行在另一台主機（桌機／伺服器）上的 OpenClaw Gateway 閘道器。這是應用程式的 **Remote over SSH**（遠端執行）功能。所有功能——健康檢查、Voice Wake 轉送，以及 Web Chat——都會重複使用 _設定 → 一般_ 中相同的遠端 SSH 設定。

## 模式

- **Local（此 Mac）**：所有內容都在筆電上執行，不涉及 SSH。
- **Remote over SSH（預設）**：OpenClaw 指令在遠端主機上執行。mac 應用程式會使用 `-o BatchMode` 加上你選擇的身分／金鑰，並建立本機連接埠轉送來開啟 SSH 連線。
- **Remote direct（ws/wss）**：不使用 SSH 通道。mac 應用程式直接連線至 Gateway URL（例如透過 Tailscale Serve 或公開的 HTTPS 反向代理）。

## 遠端傳輸方式

遠端模式支援兩種傳輸：

- **SSH 通道**（預設）：使用 `ssh -N -L ...` 將 Gateway 連接埠轉送至 localhost。由於通道是 loopback，Gateway 會將節點的 IP 視為 `127.0.0.1`。
- **Direct（ws/wss）**：直接連線至 Gateway URL。Gateway 會看到真實的用戶端 IP。

## 遠端主機的先決條件

1. 安裝 Node + pnpm，並建置／安裝 OpenClaw CLI（`pnpm install && pnpm build && pnpm link --global`）。
2. 確保 `openclaw` 在非互動式 shell 的 PATH 中（必要時可建立符號連結到 `/usr/local/bin` 或 `/opt/homebrew/bin`）。
3. 啟用使用金鑰驗證的 SSH。我們建議使用 **Tailscale** IP，以便在非 LAN 環境下維持穩定連線。

## macOS 應用程式設定

1. 開啟 _設定 → 一般_。
2. 在 **OpenClaw runs** 底下，選擇 **Remote over SSH** 並設定：
   - **Transport**：**SSH tunnel** 或 **Direct（ws/wss）**。
   - **SSH target**：`user@host`（可選 `:port`）。
     - 若 Gateway 位於相同 LAN 且有廣播 Bonjour，可從探索到的清單中選取以自動填入此欄位。
   - **Gateway URL**（僅 Direct）：`wss://gateway.example.ts.net`（或用於本機／LAN 的 `ws://...`）。
   - **Identity file**（進階）：你的金鑰路徑。
   - **Project root**（進階）：用於執行指令的遠端專案檢出路徑。
   - **CLI path**（進階）：可執行的 `openclaw` 進入點／二進位檔的選用路徑（在有廣播時會自動填入）。
3. 點擊 **Test remote**。成功表示遠端 `openclaw status --json` 可正確執行。失敗通常代表 PATH／CLI 問題；exit 127 表示在遠端找不到 CLI。
4. 健康檢查與 Web Chat 現在會自動透過此 SSH 通道執行。

## Web Chat

- **SSH 通道**：Web Chat 會透過轉送的 WebSocket 控制連接埠（預設為 18789）連線至 Gateway。
- **Direct（ws/wss）**：Web Chat 直接連線至設定的 Gateway URL。
- 目前已不再有獨立的 WebChat HTTP 伺服器。

## 權限

- 遠端主機需要與本機相同的 TCC 核准（Automation、Accessibility、Screen Recording、Microphone、Speech Recognition、Notifications）。請在該機器上執行入門引導以一次授權完成。
- 節點會透過 `node.list`／`node.describe` 公告其權限狀態，讓代理程式知道可用的功能。

## 安全性注意事項

- 優先在遠端主機上使用 loopback 綁定，並透過 SSH 或 Tailscale 連線。
- 若將 Gateway 綁定至非 loopback 介面，請要求使用權杖／密碼驗證。
- 請參閱 [Security](/gateway/security) 與 [Tailscale](/gateway/tailscale)。

## WhatsApp 登入流程（遠端）

- 在 **遠端主機** 上執行 `openclaw channels login --verbose`。使用手機上的 WhatsApp 掃描 QR Code。
- 若驗證過期，請在該主機上重新執行登入。健康檢查會顯示連線問題。

## 疑難排解

- **exit 127／not found**：`openclaw` 未加入非登入 shell 的 PATH。請將其加入 `/etc/paths`、你的 shell rc，或建立符號連結到 `/usr/local/bin`/`/opt/homebrew/bin`。
- **Health probe failed**：檢查 SSH 連線可達性、PATH，以及 Baileys 是否已登入（`openclaw status --json`）。
- **Web Chat 卡住**：確認 Gateway 正在遠端主機上執行，且轉送的連接埠與 Gateway WS 連接埠一致；UI 需要健康的 WS 連線。
- **Node IP 顯示 127.0.0.1**：使用 SSH 通道時屬於預期行為。若希望 Gateway 看到真實的用戶端 IP，請將 **Transport** 切換為 **Direct（ws/wss）**。
- **Voice Wake**：在遠端模式下，觸發詞會自動轉送；不需要額外的轉送器。

## 通知音效

可透過使用 `openclaw` 與 `node.invoke` 的腳本，為每個通知選擇音效，例如：

```bash
openclaw nodes notify --node <id> --title "Ping" --body "Remote gateway ready" --sound Glass
```

應用程式中已不再提供全域「預設音效」切換；呼叫端需為每個請求選擇音效（或不使用音效）。

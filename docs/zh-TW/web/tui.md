---
summary: "終端機 UI（TUI）：從任何機器連線至 Gateway 閘道器"
read_when:
  - 你想要一份對新手友善的 TUI 操作導覽
  - 你需要完整的 TUI 功能、指令與快捷鍵清單
title: "TUI"
x-i18n:
  source_path: web/tui.md
  source_hash: 6ab8174870e4722d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:18Z
---

# TUI（終端機 UI）

## 快速開始

1. 啟動 Gateway 閘道器。

```bash
openclaw gateway
```

2. 開啟 TUI。

```bash
openclaw tui
```

3. 輸入訊息並按 Enter。

遠端 Gateway 閘道器：

```bash
openclaw tui --url ws://<host>:<port> --token <gateway-token>
```

如果你的 Gateway 閘道器使用密碼驗證，請使用 `--password`。

## 你會看到的畫面

- 標頭：連線 URL、目前代理程式、目前工作階段。
- 聊天記錄：使用者訊息、助理回覆、系統通知、工具卡片。
- 狀態列：連線／執行狀態（連線中、執行中、串流中、閒置、錯誤）。
- 頁尾：連線狀態 + 代理程式 + 工作階段 + 模型 + 思考／詳細／推理 + Token 計數 + 傳遞。
- 輸入區：具備自動完成的文字編輯器。

## 心智模型：代理程式 + 工作階段

- 代理程式是唯一的 slug（例如 `main`、`research`）。Gateway 閘道器會提供清單。
- 工作階段隸屬於目前的代理程式。
- 工作階段金鑰會以 `agent:<agentId>:<sessionKey>` 儲存。
  - 如果你輸入 `/session main`，TUI 會將其展開為 `agent:<currentAgent>:main`。
  - 如果你輸入 `/session agent:other:main`，你會明確切換到該代理程式的工作階段。
- 工作階段範圍：
  - `per-sender`（預設）：每個代理程式可以有多個工作階段。
  - `global`：TUI 一律使用 `global` 工作階段（選擇器可能是空的）。
- 目前的代理程式 + 工作階段會一直顯示在頁尾。

## 傳送 + 傳遞

- 訊息會傳送至 Gateway 閘道器；預設不會傳遞給提供者。
- 開啟傳遞：
  - `/deliver on`
  - 或在設定面板中
  - 或以 `openclaw tui --deliver` 啟動

## 選擇器 + 覆蓋層

- 模型選擇器：列出可用模型並設定工作階段覆寫。
- 代理程式選擇器：選擇不同的代理程式。
- 工作階段選擇器：僅顯示目前代理程式的工作階段。
- 設定：切換傳遞、工具輸出展開，以及思考內容可見性。

## 鍵盤快捷鍵

- Enter：傳送訊息
- Esc：中止進行中的執行
- Ctrl+C：清除輸入（按兩次離開）
- Ctrl+D：離開
- Ctrl+L：模型選擇器
- Ctrl+G：代理程式選擇器
- Ctrl+P：工作階段選擇器
- Ctrl+O：切換工具輸出展開
- Ctrl+T：切換思考內容可見性（會重新載入歷史）

## 斜線指令

核心：

- `/help`
- `/status`
- `/agent <id>`（或 `/agents`）
- `/session <key>`（或 `/sessions`）
- `/model <provider/model>`（或 `/models`）

工作階段控制：

- `/think <off|minimal|low|medium|high>`
- `/verbose <on|full|off>`
- `/reasoning <on|off|stream>`
- `/usage <off|tokens|full>`
- `/elevated <on|off|ask|full>`（別名：`/elev`）
- `/activation <mention|always>`
- `/deliver <on|off>`

工作階段生命週期：

- `/new` 或 `/reset`（重設工作階段）
- `/abort`（中止進行中的執行）
- `/settings`
- `/exit`

其他 Gateway 斜線指令（例如 `/context`）會轉送至 Gateway 閘道器，並以系統輸出顯示。請參閱 [Slash commands](/tools/slash-commands)。

## 本機殼層指令

- 在一行前面加上 `!`，即可在 TUI 主機上執行本機殼層指令。
- TUI 每個工作階段只會提示一次是否允許本機執行；若拒絕，該工作階段將保持 `!` 停用。
- 指令會在 TUI 工作目錄中，以全新、非互動式殼層執行（沒有持續性的 `cd`/env）。
- 單獨的 `!` 會當作一般訊息送出；前置空白不會觸發本機執行。

## 工具輸出

- 工具呼叫會以卡片形式顯示，包含參數與結果。
- Ctrl+O 可在收合／展開檢視之間切換。
- 工具執行期間，部分更新會串流到同一張卡片中。

## 歷史 + 串流

- 連線時，TUI 會載入最新的歷史（預設 200 則訊息）。
- 串流回應會就地更新，直到完成為止。
- TUI 也會監聽代理程式的工具事件，以呈現更豐富的工具卡片。

## 連線細節

- TUI 會以 `mode: "tui"` 的身分向 Gateway 閘道器註冊。
- 重新連線時會顯示系統訊息；事件缺口會在記錄中顯示。

## 選項

- `--url <url>`：Gateway WebSocket URL（預設來自設定或 `ws://127.0.0.1:<port>`）
- `--token <token>`：Gateway Token（如需要）
- `--password <password>`：Gateway 密碼（如需要）
- `--session <key>`：工作階段金鑰（預設：`main`，或在全域範圍時為 `global`）
- `--deliver`：將助理回覆傳遞給提供者（預設關閉）
- `--thinking <level>`：覆寫傳送時的思考等級
- `--timeout-ms <ms>`：代理程式逾時（毫秒，預設為 `agents.defaults.timeoutSeconds`）

注意：當你設定 `--url` 時，TUI 不會回退使用設定或環境中的憑證。
請明確傳入 `--token` 或 `--password`。缺少明確的憑證會視為錯誤。

## 疑難排解

傳送訊息後沒有輸出：

- 在 TUI 中執行 `/status`，確認 Gateway 閘道器已連線且為閒置／忙碌狀態。
- 檢查 Gateway 閘道器日誌：`openclaw logs --follow`。
- 確認代理程式可以執行：`openclaw status` 與 `openclaw models status`。
- 如果你預期訊息出現在聊天頻道中，請啟用傳遞（`/deliver on` 或 `--deliver`）。
- `--history-limit <n>`：要載入的歷史筆數（預設 200）

## 連線疑難排解

- `disconnected`：確保 Gateway 閘道器正在執行，且你的 `--url/--token/--password` 正確。
- 選擇器中沒有代理程式：檢查 `openclaw agents list` 與你的路由設定。
- 工作階段選擇器是空的：你可能在全域範圍，或尚未有任何工作階段。

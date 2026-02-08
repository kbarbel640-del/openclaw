---
summary: 「終端機 UI（TUI）：從任何機器連線至 Gateway」
read_when:
  - 「你想要適合初學者的 TUI 操作導覽」
  - 「你需要完整的 TUI 功能、指令與快捷鍵清單」
title: 「TUI」
x-i18n:
  source_path: tui.md
  source_hash: 1eb111456fe0aab6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:10Z
---

# TUI（Terminal UI）

## 快速開始

1. 啟動 Gateway。

```bash
openclaw gateway
```

2. 開啟 TUI。

```bash
openclaw tui
```

3. 輸入訊息並按 Enter。

遠端 Gateway：

```bash
openclaw tui --url ws://<host>:<port> --token <gateway-token>
```

如果你的 Gateway 使用密碼驗證，請使用 `--password`。

## 你會看到的內容

- 標頭：連線 URL、目前的 agent、目前的 session。
- 聊天紀錄：使用者訊息、助理回覆、系統通知、工具卡片。
- 狀態列：連線／執行狀態（connecting、running、streaming、idle、error）。
- 頁尾：連線狀態 + agent + session + model + think/verbose/reasoning + token 計數 + deliver。
- 輸入區：具備自動完成的文字編輯器。

## 心智模型：agents + sessions

- Agents 是唯一的 slug（例如 `main`、`research`）。Gateway 會提供清單。
- Sessions 隸屬於目前的 agent。
- Session 金鑰會儲存為 `agent:<agentId>:<sessionKey>`。
  - 如果你輸入 `/session main`，TUI 會將其展開為 `agent:<currentAgent>:main`。
  - 如果你輸入 `/session agent:other:main`，你會明確切換到該 agent 的 session。
- Session 範圍：
  - `per-sender`（預設）：每個 agent 有多個 sessions。
  - `global`：TUI 一律使用 `global` session（選擇器可能為空）。
- 目前的 agent + session 會始終顯示在頁尾。

## 傳送 + 投遞

- 訊息會送至 Gateway；預設不會投遞到提供者。
- 開啟投遞：
  - `/deliver on`
  - 或在設定面板中
  - 或以 `openclaw tui --deliver` 啟動

## 選擇器 + 覆蓋層

- 模型選擇器：列出可用模型並設定 session 覆寫。
- Agent 選擇器：選擇不同的 agent。
- Session 選擇器：僅顯示目前 agent 的 sessions。
- 設定：切換投遞、工具輸出展開，以及思考顯示。

## 鍵盤快捷鍵

- Enter：送出訊息
- Esc：中止進行中的執行
- Ctrl+C：清除輸入（按兩次以離開）
- Ctrl+D：離開
- Ctrl+L：模型選擇器
- Ctrl+G：agent 選擇器
- Ctrl+P：session 選擇器
- Ctrl+O：切換工具輸出展開
- Ctrl+T：切換思考顯示（會重新載入歷史）

## 斜線指令

核心：

- `/help`
- `/status`
- `/agent <id>`（或 `/agents`）
- `/session <key>`（或 `/sessions`）
- `/model <provider/model>`（或 `/models`）

Session 控制：

- `/think <off|minimal|low|medium|high>`
- `/verbose <on|full|off>`
- `/reasoning <on|off|stream>`
- `/usage <off|tokens|full>`
- `/elevated <on|off|ask|full>`（別名：`/elev`）
- `/activation <mention|always>`
- `/deliver <on|off>`

Session 生命週期：

- `/new` 或 `/reset`（重設 session）
- `/abort`（中止進行中的執行）
- `/settings`
- `/exit`

其他 Gateway 斜線指令（例如 `/context`）會轉送至 Gateway，並以系統輸出顯示。請參閱 [Slash commands](/tools/slash-commands)。

## 本機 shell 指令

- 以 `!` 作為行首可在 TUI 主機上執行本機 shell 指令。
- TUI 會在每個 session 詢問一次是否允許本機執行；若拒絕，該 session 會維持 `!` 停用。
- 指令會在 TUI 工作目錄中的全新、非互動式 shell 內執行（不會保留 `cd`/env）。
- 單獨的 `!` 會作為一般訊息送出；前置空白不會觸發本機執行。

## 工具輸出

- 工具呼叫會以卡片顯示，包含參數與結果。
- Ctrl+O 在收合／展開檢視之間切換。
- 工具執行期間，部分更新會串流到同一張卡片。

## 歷史 + 串流

- 連線時，TUI 會載入最新的歷史（預設 200 則訊息）。
- 串流回應會即時更新，直到完成。
- TUI 也會監聽 agent 的工具事件，以呈現更豐富的工具卡片。

## 連線細節

- TUI 會以 `mode: "tui"` 的身分向 Gateway 註冊。
- 重新連線時會顯示系統訊息；事件缺口會在紀錄中呈現。

## 選項

- `--url <url>`：Gateway WebSocket URL（預設為設定或 `ws://127.0.0.1:<port>`）
- `--token <token>`：Gateway token（若需要）
- `--password <password>`：Gateway 密碼（若需要）
- `--session <key>`：Session 金鑰（預設：`main`；當範圍為 global 時為 `global`）
- `--deliver`：將助理回覆投遞給提供者（預設關閉）
- `--thinking <level>`：覆寫送出時的思考層級
- `--timeout-ms <ms>`：Agent 逾時（毫秒）（預設為 `agents.defaults.timeoutSeconds`）

注意：當你設定 `--url` 時，TUI 不會回退使用設定或環境憑證。
請明確傳入 `--token` 或 `--password`。缺少明確的憑證會視為錯誤。

## 疑難排解

送出訊息後沒有輸出：

- 在 TUI 中執行 `/status` 以確認 Gateway 已連線且為 idle／busy。
- 檢查 Gateway 紀錄：`openclaw logs --follow`。
- 確認 agent 可執行：`openclaw status` 與 `openclaw models status`。
- 若你預期訊息會出現在聊天頻道，請啟用投遞（`/deliver on` 或 `--deliver`）。
- `--history-limit <n>`：要載入的歷史筆數（預設 200）

## 疑難排解

- `disconnected`：確保 Gateway 正在執行，且你的 `--url/--token/--password` 正確。
- 選擇器中沒有 agents：檢查 `openclaw agents list` 與你的路由設定。
- Session 選擇器為空：你可能位於 global 範圍，或尚未建立任何 sessions。

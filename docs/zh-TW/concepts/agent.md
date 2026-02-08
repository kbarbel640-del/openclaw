---
summary: "代理程式執行期（內嵌的 pi-mono）、工作區契約，以及工作階段啟動流程"
read_when:
  - 變更代理程式執行期、工作區啟動流程，或工作階段行為時
title: "Agent Runtime"
x-i18n:
  source_path: concepts/agent.md
  source_hash: 04b4e0bc6345d2af
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:00Z
---

# Agent Runtime 🤖

OpenClaw 執行單一個內嵌的代理程式執行期，源自 **pi-mono**。

## Workspace（必要）

OpenClaw 使用單一的代理程式工作區目錄（`agents.defaults.workspace`），作為工具與情境的 **唯一** 工作目錄（`cwd`）。

建議：使用 `openclaw setup`，在缺少時建立 `~/.openclaw/openclaw.json`，並初始化工作區檔案。

完整的工作區結構 + 備份指南：[Agent workspace](/concepts/agent-workspace)

如果啟用 `agents.defaults.sandbox`，非主要工作階段可以改用
位於 `agents.defaults.sandbox.workspaceRoot` 之下的每個工作階段專屬工作區（請參閱
[Gateway configuration](/gateway/configuration)）。

## Bootstrap 檔案（注入）

在 `agents.defaults.workspace` 之內，OpenClaw 會預期存在以下可由使用者編輯的檔案：

- `AGENTS.md` — 操作指示 +「記憶」
- `SOUL.md` — 角色設定、邊界、語氣
- `TOOLS.md` — 使用者維護的工具備註（例如 `imsg`、`sag`、慣例）
- `BOOTSTRAP.md` — 僅執行一次的首次啟動儀式（完成後會刪除）
- `IDENTITY.md` — 代理程式名稱／風格／表情符號
- `USER.md` — 使用者個人資料 + 偏好的稱呼方式

在新工作階段的第一個回合，OpenClaw 會將這些檔案的內容直接注入代理程式情境中。

空白檔案會被略過。大型檔案會被修剪並截斷，並加上標記，以保持提示精簡（完整內容請直接閱讀檔案）。

如果某個檔案缺失，OpenClaw 會注入一行「缺少檔案」的標記（且 `openclaw setup` 會建立安全的預設範本）。

`BOOTSTRAP.md` 僅會在 **全新的工作區**（不存在其他 bootstrap 檔案）中建立。若你在完成儀式後將其刪除，後續重新啟動時不應再次建立。

若要完全停用 bootstrap 檔案的建立（用於已預先填充的工作區），請設定：

```json5
{ agent: { skipBootstrap: true } }
```

## 內建工具

核心工具（read/exec/edit/write 以及相關系統工具）始終可用，
但需遵守工具政策。`apply_patch` 為選用項目，且受 `tools.exec.applyPatch` 管控。
`TOOLS.md` **不會** 控制實際存在哪些工具；它只是
用來指引你希望工具被如何使用。

## Skills

OpenClaw 會從三個位置載入 Skills（若名稱衝突，以工作區為準）：

- 隨安裝提供（Bundled）
- 受管理／本機：`~/.openclaw/skills`
- 工作區：`<workspace>/skills`

Skills 可透過設定或環境變數進行管控（請參閱
[Gateway configuration](/gateway/configuration) 中的 `skills`）。

## pi-mono 整合

OpenClaw 重用 pi-mono 程式碼庫中的部分元件（模型／工具），但 **工作階段管理、裝置探索，以及工具連線皆由 OpenClaw 自行負責**。

- 不使用 pi-coding 代理程式執行期。
- 不會參考 `~/.pi/agent` 或 `<workspace>/.pi` 設定。

## Sessions

工作階段逐字稿會以 JSONL 形式儲存於：

- `~/.openclaw/agents/<agentId>/sessions/<SessionId>.jsonl`

工作階段 ID 為穩定值，並由 OpenClaw 選擇。
舊版 Pi／Tau 的工作階段資料夾 **不會** 被讀取。

## 串流期間的引導

當佇列模式為 `steer` 時，傳入訊息會被注入到目前的執行中。
佇列會在 **每一次工具呼叫之後** 檢查；若存在佇列訊息，
目前助理訊息中剩餘的工具呼叫將被略過（工具回傳錯誤結果，
內容為「Skipped due to queued user message.」），接著在下一次助理回應前，
注入該佇列中的使用者訊息。

當佇列模式為 `followup` 或 `collect` 時，傳入訊息會被保留，
直到目前回合結束，然後以佇列中的負載啟動新的代理程式回合。
模式與去彈跳／上限行為請參閱
[Queue](/concepts/queue)。

區塊串流會在助理區塊完成後立即送出；其預設為 **關閉**
（`agents.defaults.blockStreamingDefault: "off"`）。
可透過 `agents.defaults.blockStreamingBreak` 調整邊界（`text_end` 與 `message_end`；
預設為 text_end）。
使用 `agents.defaults.blockStreamingChunk` 控制軟性區塊分段（預設
800–1200 個字元；優先段落分隔，其次換行，最後才是句子）。
使用 `agents.defaults.blockStreamingCoalesce` 合併串流區塊，以降低
單行訊息洗版（在送出前依閒置時間進行合併）。非 Telegram 的頻道需要
明確設定 `*.blockStreaming: true` 才能啟用區塊回覆。
詳細工具摘要會在工具啟動時送出（不進行去彈跳）；Control UI
在可用時，會透過代理程式事件串流工具輸出。
更多細節請見：[Streaming + chunking](/concepts/streaming)。

## Model refs

設定中的 model refs（例如 `agents.defaults.model` 與 `agents.defaults.models`）會以
**第一個** `/` 進行分割解析。

- 設定模型時請使用 `provider/model`。
- 若模型 ID 本身包含 `/`（OpenRouter 風格），請包含提供者前綴（例如：`openrouter/moonshotai/kimi-k2`）。
- 若省略提供者，OpenClaw 會將輸入視為別名或 **預設提供者** 的模型（僅在模型 ID 中不存在 `/` 時有效）。

## Configuration（最小）

至少需要設定：

- `agents.defaults.workspace`
- `channels.whatsapp.allowFrom`（強烈建議）

---

_下一步：[Group Chats](/concepts/group-messages)_ 🦞

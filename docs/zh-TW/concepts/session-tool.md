---
summary: 「用於列出工作階段、擷取歷史紀錄，以及跨工作階段傳送訊息的代理程式工作階段工具」
read_when:
  - 新增或修改工作階段工具時
title: 「工作階段工具」
x-i18n:
  source_path: concepts/session-tool.md
  source_hash: cb6e0982ebf507bc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:17Z
---

# 工作階段工具

目標：提供一組小而不易誤用的工具，讓代理程式可以列出工作階段、擷取歷史紀錄，並傳送到另一個工作階段。

## 工具名稱

- `sessions_list`
- `sessions_history`
- `sessions_send`
- `sessions_spawn`

## 金鑰模型

- 主要的一對一聊天桶一律使用字面金鑰 `"main"`（解析為目前代理程式的主要金鑰）。
- 群組聊天使用 `agent:<agentId>:<channel>:group:<id>` 或 `agent:<agentId>:<channel>:channel:<id>`（傳入完整金鑰）。
- 排程工作使用 `cron:<job.id>`。
- Hook 除非明確設定，否則使用 `hook:<uuid>`。
- Node 工作階段除非明確設定，否則使用 `node-<nodeId>`。

`global` 與 `unknown` 為保留值，且永不列出。若為 `session.scope = "global"`，我們會在所有工具中將其別名為 `main`，以確保呼叫端永遠不會看到 `global`。

## sessions_list

將工作階段列為列陣列。

參數：

- `kinds?: string[]` 篩選：`"main" | "group" | "cron" | "hook" | "node" | "other"` 之一
- `limit?: number` 最大列數（預設：伺服器預設，會限制例如 200）
- `activeMinutes?: number` 僅列出在 N 分鐘內有更新的工作階段
- `messageLimit?: number` 0 = 不含訊息（預設 0）；>0 = 包含最近 N 則訊息

行為：

- `messageLimit > 0` 會為每個工作階段擷取 `chat.history`，並包含最近 N 則訊息。
- 工具結果會在清單輸出中被過濾；工具訊息請使用 `sessions_history`。
- 在 **沙箱隔離的** 代理程式工作階段中執行時，工作階段工具預設為 **僅可見於其所產生的工作階段**（見下文）。

列形狀（JSON）：

- `key`：工作階段金鑰（字串）
- `kind`：`main | group | cron | hook | node | other`
- `channel`：`whatsapp | telegram | discord | signal | imessage | webchat | internal | unknown`
- `displayName`（若可用，群組顯示標籤）
- `updatedAt`（毫秒）
- `sessionId`
- `model`、`contextTokens`、`totalTokens`
- `thinkingLevel`、`verboseLevel`、`systemSent`、`abortedLastRun`
- `sendPolicy`（若有設定的工作階段覆寫）
- `lastChannel`、`lastTo`
- `deliveryContext`（可用時的正規化 `{ channel, to, accountId }`）
- `transcriptPath`（由儲存目錄 + sessionId 推導的最佳努力路徑）
- `messages?`（僅在 `messageLimit > 0` 時）

## sessions_history

擷取單一工作階段的逐字稿。

參數：

- `sessionKey`（必填；接受工作階段金鑰或來自 `sessions_list` 的 `sessionId`）
- `limit?: number` 最大訊息數（由伺服器限制）
- `includeTools?: boolean`（預設為 false）

行為：

- `includeTools=false` 會過濾 `role: "toolResult"` 訊息。
- 以原始逐字稿格式回傳訊息陣列。
- 當提供 `sessionId` 時，OpenClaw 會將其解析為對應的工作階段金鑰（缺少 id 會回傳錯誤）。

## sessions_send

將訊息傳送到另一個工作階段。

參數：

- `sessionKey`（必填；接受工作階段金鑰或來自 `sessions_list` 的 `sessionId`）
- `message`（必填）
- `timeoutSeconds?: number`（預設 >0；0 = 發送即忘）

行為：

- `timeoutSeconds = 0`：佇列並回傳 `{ runId, status: "accepted" }`。
- `timeoutSeconds > 0`：最多等待 N 秒完成，然後回傳 `{ runId, status: "ok", reply }`。
- 若等待逾時：`{ runId, status: "timeout", error }`。執行會繼續；稍後再呼叫 `sessions_history`。
- 若執行失敗：`{ runId, status: "error", error }`。
- 主要執行完成後才會宣告投遞的執行，且為最佳努力；`status: "ok"` 不保證宣告已送達。
- 透過 Gateway 閘道器 `agent.wait`（伺服器端）進行等待，避免重新連線導致等待中斷。
- 主要執行會注入代理程式對代理程式的訊息情境。
- 主要執行完成後，OpenClaw 會執行 **回覆往返迴圈**：
  - 第 2 輪以上在請求端與目標代理程式之間交替。
  - 精確回覆 `REPLY_SKIP` 以停止來回。
  - 最大回合數為 `session.agentToAgent.maxPingPongTurns`（0–5，預設 5）。
- 迴圈結束後，OpenClaw 會執行 **代理程式對代理程式的宣告步驟**（僅目標代理程式）：
  - 在宣告步驟中精確回覆 `ANNOUNCE_SKIP` 以保持沉默。
  - 任何其他回覆都會送至目標頻道。
  - 宣告步驟包含原始請求 + 第 1 輪回覆 + 最新的來回回覆。

## 頻道欄位

- 對於群組，`channel` 是記錄在工作階段項目的頻道。
- 對於一對一聊天，`channel` 會從 `lastChannel` 對應。
- 對於 cron／hook／node，`channel` 為 `internal`。
- 若缺少，`channel` 為 `unknown`。

## 安全性／傳送政策

依頻道／聊天類型（非依工作階段 id）進行政策式封鎖。

```json
{
  "session": {
    "sendPolicy": {
      "rules": [
        {
          "match": { "channel": "discord", "chatType": "group" },
          "action": "deny"
        }
      ],
      "default": "allow"
    }
  }
}
```

執行期覆寫（每個工作階段項目）：

- `sendPolicy: "allow" | "deny"`（未設定 = 繼承設定）
- 可透過 `sessions.patch` 或僅限擁有者的 `/send on|off|inherit`（獨立訊息）設定。

強制點：

- `chat.send`／`agent`（Gateway 閘道器）
- 自動回覆投遞邏輯

## sessions_spawn

在隔離的工作階段中啟動子代理程式執行，並將結果宣告回請求者的聊天頻道。

參數：

- `task`（必填）
- `label?`（選填；用於記錄／UI）
- `agentId?`（選填；若允許，可在另一個代理程式 id 之下啟動）
- `model?`（選填；覆寫子代理程式模型；無效值會回傳錯誤）
- `runTimeoutSeconds?`（預設 0；設定後，於 N 秒後中止子代理程式執行）
- `cleanup?`（`delete|keep`，預設 `keep`）

允許清單：

- `agents.list[].subagents.allowAgents`：可透過 `agentId` 允許的代理程式 id 清單（`["*"]` 以允許任何）。預設：僅請求者代理程式。

探索：

- 使用 `agents_list` 來探索哪些代理程式 id 允許用於 `sessions_spawn`。

行為：

- 以 `deliver: false` 啟動新的 `agent:<agentId>:subagent:<uuid>` 工作階段。
- 子代理程式預設擁有完整工具集 **但不包含工作階段工具**（可透過 `tools.subagents.tools` 設定）。
- 子代理程式不得呼叫 `sessions_spawn`（不允許子代理程式 → 子代理程式的啟動）。
- 一律為非阻塞：立即回傳 `{ status: "accepted", runId, childSessionKey }`。
- 完成後，OpenClaw 會執行子代理程式的 **宣告步驟**，並將結果張貼到請求者聊天頻道。
- 在宣告步驟中精確回覆 `ANNOUNCE_SKIP` 以保持沉默。
- 宣告回覆會正規化為 `Status`／`Result`／`Notes`；`Status` 來自執行期結果（非模型文字）。
- 子代理程式工作階段會在 `agents.defaults.subagents.archiveAfterMinutes` 後自動封存（預設：60）。
- 宣告回覆包含一行統計資料（執行時間、token、sessionKey／sessionId、逐字稿路徑，以及選用的成本）。

## 沙箱工作階段可見性

沙箱隔離的工作階段可以使用工作階段工具，但預設僅能看到它們透過 `sessions_spawn` 所產生的工作階段。

設定：

```json5
{
  agents: {
    defaults: {
      sandbox: {
        // default: "spawned"
        sessionToolsVisibility: "spawned", // or "all"
      },
    },
  },
}
```

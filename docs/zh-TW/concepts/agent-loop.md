---
summary: 「代理程式迴圈的生命週期、串流，以及等待語意」
read_when:
  - 當你需要對代理程式迴圈或生命週期事件有精確的逐步說明時
title: 「Agent Loop」
x-i18n:
  source_path: concepts/agent-loop.md
  source_hash: 0775b96eb3451e13
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:03Z
---

# Agent Loop（OpenClaw）

代理程式迴圈（agentic loop）是代理程式一次完整且「真實」的執行流程：輸入接收 → 脈絡組裝 → 模型推論 →
工具執行 → 串流回覆 → 永久化。這是一條權威路徑，將一則訊息轉化為動作與最終回覆，同時保持工作階段狀態的一致性。

在 OpenClaw 中，一個迴圈代表每個工作階段一次、序列化的執行，會在模型思考、呼叫工具以及串流輸出時發出生命週期與串流事件。本文件說明這個真實迴圈如何端到端地串接。

## 進入點

- Gateway RPC：`agent` 與 `agent.wait`。
- CLI：`agent` 指令。

## 運作方式（高階）

1. `agent` RPC 驗證參數、解析工作階段（sessionKey/sessionId）、持久化工作階段中繼資料，並立即回傳 `{ runId, acceptedAt }`。
2. `agentCommand` 執行代理程式：
   - 解析模型 + thinking/verbose 預設值
   - 載入 Skills 快照
   - 呼叫 `runEmbeddedPiAgent`（pi-agent-core 執行階段）
   - 若內嵌迴圈未發出，則補送 **生命週期 end/error**
3. `runEmbeddedPiAgent`：
   - 透過每個工作階段 + 全域佇列來序列化執行
   - 解析模型 + 驗證設定檔並建立 pi 工作階段
   - 訂閱 pi 事件並串流 assistant/tool 的增量
   - 強制逾時 -> 超過即中止執行
   - 回傳 payload 與使用量中繼資料
4. `subscribeEmbeddedPiSession` 將 pi-agent-core 事件橋接到 OpenClaw 的 `agent` 串流：
   - 工具事件 => `stream: "tool"`
   - assistant 增量 => `stream: "assistant"`
   - 生命週期事件 => `stream: "lifecycle"`（`phase: "start" | "end" | "error"`）
5. `agent.wait` 使用 `waitForAgentJob`：
   - 等待 `runId` 的 **生命週期 end/error**
   - 回傳 `{ status: ok|error|timeout, startedAt, endedAt, error? }`

## 佇列 + 併發

- 執行會依工作階段金鑰（工作階段車道）序列化，並可選擇再經過全域車道。
- 這可防止工具/工作階段競態，並保持工作階段歷史的一致性。
- 訊息頻道可以選擇佇列模式（collect/steer/followup）以餵送此車道系統。
  請參閱 [Command Queue](/concepts/queue)。

## 工作階段 + 工作空間準備

- 解析並建立工作空間；沙箱隔離的執行可能會重新導向至沙箱工作空間根目錄。
- 載入 Skills（或重用快照），並注入至環境與提示詞中。
- 解析並注入啟動／脈絡檔案至系統提示詞報告。
- 取得工作階段寫入鎖；在串流前會先開啟並準備 `SessionManager`。

## 提示詞組裝 + 系統提示詞

- 系統提示詞由 OpenClaw 的基礎提示詞、Skills 提示詞、啟動脈絡，以及每次執行的覆寫項目組成。
- 會強制套用模型特定的限制與壓縮保留權杖數。
- 關於模型實際看到的內容，請參閱 [System prompt](/concepts/system-prompt)。

## 掛鉤點（可攔截的位置）

OpenClaw 有兩套掛鉤系統：

- **內部掛鉤**（Gateway hooks）：用於指令與生命週期事件的事件驅動腳本。
- **外掛掛鉤**：位於代理程式／工具生命週期與 Gateway 管線中的擴充點。

### 內部掛鉤（Gateway hooks）

- **`agent:bootstrap`**：在系統提示詞定稿前、建立啟動檔案時執行。
  可用於新增／移除啟動脈絡檔案。
- **Command hooks**：`/new`、`/reset`、`/stop`，以及其他指令事件（請參閱 Hooks 文件）。

設定與範例請見 [Hooks](/hooks)。

### 外掛掛鉤（代理程式 + Gateway 生命週期）

這些會在代理程式迴圈或 Gateway 管線內執行：

- **`before_agent_start`**：在執行開始前注入脈絡或覆寫系統提示詞。
- **`agent_end`**：完成後檢視最終訊息清單與執行中繼資料。
- **`before_compaction` / `after_compaction`**：觀察或註記壓縮循環。
- **`before_tool_call` / `after_tool_call`**：攔截工具參數／結果。
- **`tool_result_persist`**：在工具結果寫入工作階段逐字稿前，同步轉換其內容。
- **`message_received` / `message_sending` / `message_sent`**：入站 + 出站訊息掛鉤。
- **`session_start` / `session_end`**：工作階段生命週期邊界。
- **`gateway_start` / `gateway_stop`**：Gateway 生命週期事件。

掛鉤 API 與註冊細節請參閱 [Plugins](/plugin#plugin-hooks)。

## 串流 + 部分回覆

- assistant 的增量會從 pi-agent-core 串流，並以 `assistant` 事件送出。
- 區塊串流可在 `text_end` 或 `message_end` 上送出部分回覆。
- 推理串流可作為獨立串流，或以區塊回覆形式送出。
- 關於分塊與區塊回覆行為，請參閱 [Streaming](/concepts/streaming)。

## 工具執行 + 訊息工具

- 工具開始／更新／結束事件會在 `tool` 串流上送出。
- 工具結果在記錄／送出前，會針對大小與圖片 payload 進行清理。
- 會追蹤訊息工具的傳送，以抑制重複的 assistant 確認訊息。

## 回覆塑形 + 抑制

- 最終 payload 由以下組成：
  - assistant 文字（以及選用的推理）
  - 行內工具摘要（在 verbose 且允許時）
  - 模型發生錯誤時的 assistant 錯誤文字
- `NO_REPLY` 被視為靜默權杖，並會從外送 payload 中過濾。
- 訊息工具的重複內容會從最終 payload 清單中移除。
- 若沒有可渲染的 payload 且工具發生錯誤，則會送出備援的工具錯誤回覆
  （除非某個訊息工具已送出使用者可見的回覆）。

## 壓縮 + 重試

- 自動壓縮會送出 `compaction` 串流事件，並可能觸發重試。
- 在重試時，會重設記憶體內的緩衝區與工具摘要，以避免重複輸出。
- 壓縮管線請參閱 [Compaction](/concepts/compaction)。

## 事件串流（目前）

- `lifecycle`：由 `subscribeEmbeddedPiSession` 送出（並在需要時由 `agentCommand` 作為備援）
- `assistant`：來自 pi-agent-core 的增量串流
- `tool`：來自 pi-agent-core 的工具事件串流

## 聊天頻道處理

- assistant 的增量會被緩衝並組成聊天 `delta` 訊息。
- 在 **生命週期 end/error** 時，會送出一則聊天 `final`。

## 逾時

- `agent.wait` 預設：30 秒（僅等待）。可由 `timeoutMs` 參數覆寫。
- 代理程式執行時間：`agents.defaults.timeoutSeconds` 預設 600 秒；由 `runEmbeddedPiAgent` 的中止計時器強制執行。

## 提前結束的情況

- 代理程式逾時（中止）
- AbortSignal（取消）
- Gateway 中斷連線或 RPC 逾時
- `agent.wait` 逾時（僅等待，不會停止代理程式）

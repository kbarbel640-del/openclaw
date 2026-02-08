---
summary: "背景 exec 執行與行程管理"
read_when:
  - 新增或修改背景 exec 行為
  - 偵錯長時間執行的 exec 任務
title: "背景 Exec 與 Process 工具"
x-i18n:
  source_path: gateway/background-process.md
  source_hash: e11a7d74a75000d6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:19Z
---

# 背景 Exec + Process 工具

OpenClaw 透過 `exec` 工具執行 shell 指令，並將長時間執行的任務保留在記憶體中。`process` 工具負責管理這些背景工作階段。

## exec 工具

主要參數：

- `command`（必填）
- `yieldMs`（預設 10000）：超過此延遲後自動轉為背景
- `background`（bool）：立即在背景執行
- `timeout`（秒，預設 1800）：超過此逾時後終止行程
- `elevated`（bool）：若已啟用／允許提高權限模式，則在主機上執行
- 需要真正的 TTY？請設定 `pty: true`。
- `workdir`、`env`

行為：

- 前景執行會直接回傳輸出。
- 當轉為背景（明確指定或逾時）時，工具會回傳 `status: "running"` + `sessionId` 以及一小段尾端輸出。
- 輸出會保留在記憶體中，直到輪詢或清除該工作階段。
- 若 `process` 工具被禁止，`exec` 會同步執行，並忽略 `yieldMs`/`background`。

## 子行程橋接

當在 exec/process 工具之外啟動長時間執行的子行程（例如 CLI 重新啟動或 Gateway 閘道器 輔助程式）時，請附加子行程橋接輔助器，以轉送終止訊號，並在結束／錯誤時解除監聽。這可避免在 systemd 上產生孤兒行程，並讓跨平台的關機行為保持一致。

環境覆寫：

- `PI_BASH_YIELD_MS`：預設產出間隔（毫秒）
- `PI_BASH_MAX_OUTPUT_CHARS`：記憶體內輸出上限（字元）
- `OPENCLAW_BASH_PENDING_MAX_OUTPUT_CHARS`：每個串流待處理 stdout/stderr 上限（字元）
- `PI_BASH_JOB_TTL_MS`：已完成工作階段的 TTL（毫秒，限制於 1 分鐘–3 小時）

設定（建議）：

- `tools.exec.backgroundMs`（預設 10000）
- `tools.exec.timeoutSec`（預設 1800）
- `tools.exec.cleanupMs`（預設 1800000）
- `tools.exec.notifyOnExit`（預設 true）：當背景 exec 結束時，佇列一個系統事件並請求心跳。

## process 工具

動作：

- `list`：執行中 + 已完成的工作階段
- `poll`：擷取某工作階段的新輸出（同時回報結束狀態）
- `log`：讀取彙總輸出（支援 `offset` + `limit`）
- `write`：傳送 stdin（`data`，可選 `eof`）
- `kill`：終止背景工作階段
- `clear`：從記憶體中移除已完成的工作階段
- `remove`：若仍在執行則終止，否則在完成後清除

注意事項：

- 僅背景化的工作階段會被列出並保留在記憶體中。
- 行程重新啟動時，工作階段會遺失（未寫入磁碟）。
- 僅在你執行 `process poll/log` 且工具結果被記錄時，工作階段日誌才會儲存到聊天紀錄。
- `process` 以代理程式為範圍；它只會看到由該代理程式啟動的工作階段。
- `process list` 會包含衍生的 `name`（指令動詞 + 目標），方便快速掃描。
- `process log` 使用以行為基礎的 `offset`/`limit`（省略 `offset` 以擷取最後 N 行）。

## 範例

執行長時間任務並稍後輪詢：

```json
{ "tool": "exec", "command": "sleep 5 && echo done", "yieldMs": 1000 }
```

```json
{ "tool": "process", "action": "poll", "sessionId": "<id>" }
```

立即在背景啟動：

```json
{ "tool": "exec", "command": "npm run build", "background": true }
```

傳送 stdin：

```json
{ "tool": "process", "action": "write", "sessionId": "<id>", "data": "y\n" }
```

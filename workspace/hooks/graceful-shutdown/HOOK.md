---
metadata:
  openclaw:
    name: graceful-shutdown
    description: Level 50 - 追蹤 in-flight 消息，確保重啟時等待完成
    events:
      - message:received
      - message:sent
    handler: handler.js
---

# Graceful Shutdown Hook

Level 50: 可靠性架構 — 確保消息處理完成後才關閉。

## 功能

- 追蹤每個 chat 的 in-flight 消息處理
- `message:received` 時開始追蹤
- `message:sent` 時結束追蹤
- 提供 `waitForCompletion()` 供 shutdown 使用

## 架構

```
消息流程：
收到消息 → [開始追蹤] → 路由 → LLM → 發送回覆 → [結束追蹤]
                ↑                              ↑
           message:received              message:sent

Shutdown 流程：
SIGTERM → 等待 in-flight 完成 (30s timeout) → 關閉服務
```

## 導出函數

```javascript
import { getInFlightCount, waitForCompletion } from "./handler.js";

// 獲取當前 in-flight 數量
const count = getInFlightCount();

// 等待所有 in-flight 完成（最多 30 秒）
const result = await waitForCompletion(30000);
// { completed: boolean, remaining: number, timedOut?: boolean }
```

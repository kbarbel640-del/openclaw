# 立即回覆機制規格

## 問題

LINE Reply Token 只有 30 秒有效期。如果 agent 處理時間超過 30 秒，token 過期後只能用 Push Message（有額度限制）。

## 解決方案

在收到 LINE 消息時，**立即**發送確認消息佔用 Reply Token，然後繼續處理。

### 流程

```
用戶發送消息
    ↓
[立即] 發送「收到，讓我想想...」← 用 Reply Token（免費）
    ↓
Agent 處理（可能 >30 秒）
    ↓
發送真正回覆 ← 用 Push Message（可接受，因為 Reply Token 已用於確認）
```

### 實現方式

#### 方式 1：Internal Hook（推薦）

創建 `immediate-ack` hook，在 `message:received` 事件時立即回覆。

```javascript
// hooks/immediate-ack/handler.js
export default async function handler(event) {
  if (event.type !== "message:received") return;
  if (event.channel !== "line") return;

  // 立即發送確認
  await sendLineReply(event.replyToken, "收到，讓我想想...");
}
```

#### 方式 2：修改 auto-reply 邏輯

在 `line/auto-reply-delivery.js` 中，處理開始前先發確認。

### 配置

可選配置項：

- `line.immediateAck.enabled`: 是否啟用
- `line.immediateAck.message`: 確認消息內容
- `line.immediateAck.threshold`: 只有預估處理時間 >N 秒才發確認

### 注意事項

1. Reply Token 只能用一次，發確認後就用掉了
2. 後續回覆必須用 Push Message
3. 這會消耗 Push 額度，但比完全失敗好
4. 應該只在預估處理時間長時才啟用

## 當前狀態

**待實現** - 需要在 OpenClaw 代碼中添加此功能。

## 臨時解決方案

教 Agent 快速回覆：

1. 修改 TOOLS.md，要求 Agent 先回覆再處理
2. 使用更快的模型處理簡單問題
3. 實現 streaming 回覆

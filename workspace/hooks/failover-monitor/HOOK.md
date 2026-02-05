---
name: failover-monitor
description: "Monitor model failovers, log events, and implement circuit breaker"
metadata:
  {
    "openclaw":
      {
        "emoji": "🔄",
        "events": ["model:failover"],
        "install": [{ "id": "workspace", "kind": "workspace", "label": "Workspace hook" }],
      },
  }
---

# Failover Monitor Hook

監控模型 failover 事件，記錄日誌並發送 Telegram 通知。

## 功能

1. **記錄每次 failover** → `logs/failover.log`
2. **Telegram 通知** → 發送到 log bot
3. **Circuit Breaker** → 連續 5 次 failover 會阻止進一步切換

## 事件

監聽 `model:failover` 事件，當模型切換時觸發。

## 通知格式

```
⏱️ Model Failover

`anthropic/claude-opus-4-5`
  ↓ timeout (529)
`deepseek/deepseek-chat`

Attempt: 1/3
Agent: main
```

## Circuit Breaker

- 1 分鐘內連續 5 次 failover 會觸發
- 觸發後會 veto 後續的 failover
- 發送警告通知

## 日誌格式

JSON lines 寫入 `logs/failover.log`：

```json
{
  "timestamp": "2026-02-05T12:00:00.000Z",
  "from": "anthropic/claude-opus-4-5",
  "to": "deepseek/deepseek-chat",
  "reason": "timeout",
  "errorMessage": "Request timed out",
  "statusCode": 529,
  "attemptNumber": 1,
  "totalCandidates": 3,
  "consecutiveCount": 1,
  "sessionKey": "main:abc123",
  "agentId": "main"
}
```

## 配置

在 `openclaw.json` 裡啟用：

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "failover-monitor": {
          "enabled": true
        }
      }
    }
  }
}
```

## Veto 返回值

Hook 可以返回以下結果來控制 failover：

```javascript
return {
  allow: false,           // 阻止 failover
  vetoReason: "原因",     // 阻止原因
  overrideTarget: "provider/model"  // 覆蓋目標模型
};
```

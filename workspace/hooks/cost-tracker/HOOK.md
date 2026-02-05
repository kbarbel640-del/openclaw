---
name: cost-tracker
description: "Track model usage and estimate costs"
metadata:
  {
    "openclaw":
      {
        "emoji": "💰",
        "events": ["model:complete"],
        "install": [{ "id": "workspace", "kind": "workspace", "label": "Workspace hook" }],
      },
  }
---

# Cost Tracker Hook

追蹤模型使用量並估算成本。

## 功能

1. **記錄每次調用** → `logs/cost.log`
2. **估算成本** → 基於 token 使用量和模型定價
3. **每日統計** → 可由 metrics-aggregator 讀取

## 事件

監聽 `model:complete` 事件，在模型調用完成後觸發。

## 日誌格式

JSON lines 寫入 `logs/cost.log`：

```json
{
  "timestamp": "2026-02-05T12:00:00.000Z",
  "provider": "anthropic",
  "model": "claude-opus-4-5",
  "durationMs": 1500,
  "success": true,
  "estimatedCost": 0.015,
  "sessionKey": "main:abc123",
  "agentId": "main"
}
```

## 定價配置

從 `hooks/config.json` 讀取 `costs` 配置：

```json
{
  "costs": {
    "anthropic/claude-opus-4-5": { "input": 15, "output": 75 },
    "deepseek/deepseek-chat": { "input": 0.14, "output": 0.28 }
  }
}
```

單位：$/1M tokens

# 無極 Dashboard System

JSON-based 任務管控系統，支援 prompt 驅動操作。

## 檔案結構

```
data/dashboard/
├── tasks.json        # 任務看板資料
├── control.json      # 管控規則 + 權限
├── action_log.jsonl  # 操作日誌（append-only）
└── README.md         # 本文件
```

## Schema

### tasks.json

```json
{
  "tasks": [
    {
      "id": "task-xxx",
      "title": "任務標題",
      "description": "詳細描述",
      "column": "todo|in_progress|done|archived",
      "priority": "high|medium|low",
      "project": "專案名",
      "tags": ["tag1", "tag2"],
      "assignee": "agent-id",
      "createdAt": "ISO8601",
      "dueDate": "ISO8601 or null",
      "completedAt": "ISO8601 or null"
    }
  ]
}
```

### control.json

```json
{
  "organizer": {
    "enabled": true,
    "model": "haiku",
    "permissions": { ... }
  },
  "rules": [
    {
      "id": "rule-xxx",
      "condition": { ... },
      "action": { ... }
    }
  ]
}
```

## Cron Jobs

| Job | Schedule | Model | 功能 |
|-----|----------|-------|------|
| organizer | 03:00 | haiku | 自動整理任務 |
| daily-health-report | 09:00 | default | 系統健康報告 |
| hourly-health-check | every 1h | default | 快速健康檢查 |

## Prompt 操作範例

### 新增任務
```
讀取 ~/clawd/data/dashboard/tasks.json，新增一個任務：
- title: "XXX"
- project: "YYY"
- priority: "high"
- column: "todo"
生成 UUID 作為 id，更新 meta.lastUpdated，寫回檔案。
```

### 移動任務
```
讀取 tasks.json，把 task-001 從 "todo" 移到 "in_progress"。
更新 lastUpdated，寫回檔案。
追加一行到 action_log.jsonl。
```

### 查詢任務
```
讀取 tasks.json，列出所有 column="in_progress" 的任務。
按 priority 排序。
```

## 權限控制

organizer agent 的限制：
- ✅ 可以移動任務
- ✅ 可以歸檔任務
- ✅ 可以加標籤
- ❌ 不能刪除任務
- ❌ 不能修改高優先任務
- ❌ 不能寫 dashboard 資料夾以外的檔案

## 通知

所有通知發送到 Telegram Log 群組 (-5266835049)。
安靜時段：23:00 - 08:00（不發送非緊急通知）

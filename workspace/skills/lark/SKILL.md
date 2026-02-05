---
name: lark
description: 飛書/Lark 整合 - API + 瀏覽器自動化。管理任務、文檔、多維表格。
---

# Lark Skill

兩種使用方式：
1. **Open API** - 程式化存取，已有權限
2. **Browser MCP** - 直接操作網頁介面

---

## Lark Open API 完整能力

> 官方文檔：https://open.larksuite.com/document/

### 已有權限 ✅

| 模組 | API | 功能 | Scope |
|------|-----|------|-------|
| **多維表格** | Bitable | 讀寫記錄、新增行、篩選、創建表 | `bitable:app` |
| **文檔** | Docx | 讀取/創建新版文檔 | `docx:document:readonly` |
| **知識庫** | Wiki | 讀取知識空間和頁面 | `wiki:wiki:readonly` |
| **日曆** | Calendar | 讀取行程、創建事件 | `calendar:calendar:readonly` |
| **消息** | IM | Bot 發消息到群組/個人 | `im:message:send_as_bot` |

### 需申請權限 ⚠️

| 模組 | API | 功能 | Scope |
|------|-----|------|-------|
| **任務** | Task | 創建/更新/查詢任務 | `task:task:read` `task:task:write` |
| **OKR** | OKR | 讀取/更新目標和關鍵結果 | `okr:okr:read` |
| **審批** | Approval | 發起/查詢審批流程 | `approval:approval` |
| **考勤** | Attendance | 打卡記錄、班次 | `attendance:record:read` |
| **人員** | Contact | 讀取組織架構、用戶 | `contact:user.base:readonly` |
| **雲盤** | Drive | 上傳/下載文件 | `drive:drive:readonly` |

### 不需要權限

| 模組 | 功能 | 說明 |
|------|------|------|
| **Webhook** | 接收事件回調 | 配置後自動推送 |

---

## 憑證

```
App ID:     cli_a9e51894d0f89e1a
App Secret: JoRw4k3LKW4Waey7bdkyfgehf3zUh334
Tenant:     666 (xjpr2wuiezaq.jp.larksuite.com)
```

**審批通過日期**：2026-01-28（Yao yao 審批）

---

## CLI 使用

```bash
cd ~/clawd/skills/lark

# 取得 Token
python3 scripts/lark.py token

# 知識庫
python3 scripts/lark.py spaces              # 列出空間
python3 scripts/lark.py docs --space <id>   # 列出文檔
python3 scripts/lark.py read <doc_token>    # 讀取文檔

# 多維表格
python3 scripts/lark.py bitable tables <app_token>              # 列出表
python3 scripts/lark.py bitable records <app_token> <table_id>  # 讀取記錄
python3 scripts/lark.py bitable write <app_token> <table_id> --data '{"欄位": "值"}'
```

---

## API 直接調用範例

### 1. 取得 Token

```bash
curl -X POST 'https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal' \
  -H 'Content-Type: application/json' \
  -d '{"app_id": "cli_a9e51894d0f89e1a", "app_secret": "JoRw4k3LKW4Waey7bdkyfgehf3zUh334"}'
```

### 2. 發消息（Bot）

```bash
curl -X POST 'https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=chat_id' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "receive_id": "<chat_id>",
    "msg_type": "text",
    "content": "{\"text\": \"Hello from API\"}"
  }'
```

### 3. 讀取多維表格記錄

```bash
curl 'https://open.larksuite.com/open-apis/bitable/v1/apps/<app_token>/tables/<table_id>/records' \
  -H 'Authorization: Bearer <token>'
```

### 4. 新增多維表格記錄

```bash
curl -X POST 'https://open.larksuite.com/open-apis/bitable/v1/apps/<app_token>/tables/<table_id>/records' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "fields": {
      "標題": "新記錄",
      "狀態": "進行中"
    }
  }'
```

### 5. 讀取日曆事件

```bash
curl 'https://open.larksuite.com/open-apis/calendar/v4/calendars/<calendar_id>/events' \
  -H 'Authorization: Bearer <token>'
```

---

## 常用資源 ID

### 任務清單

| 清單 | ID |
|------|----|
| 任务清单 1 | `0579f3e7-58ab-4521-80d6-9a985ca958d0` |

### 多維表格（待補充）

| 表格 | App Token | Table ID | 用途 |
|------|-----------|----------|------|
| - | - | - | - |

### 群組 Chat ID（待補充）

| 群組 | Chat ID |
|------|---------|
| - | - |

---

## Browser MCP（備用）

當 API 權限不足時，用瀏覽器自動化。

### 基本 URL

```
# 任務
https://xjpr2wuiezaq.jp.larksuite.com/next/task/my-tasks

# Messenger
https://xjpr2wuiezaq.jp.larksuite.com/next/messenger

# 雲端文件
https://xjpr2wuiezaq.jp.larksuite.com/next/drive

# OKR
https://xjpr2wuiezaq.jp.larksuite.com/next/okr
```

### 使用方式

```javascript
// 導航
browser action=open targetUrl="https://xjpr2wuiezaq.jp.larksuite.com/next/task/my-tasks"

// 截圖
browser action=screenshot

// 取得結構
browser action=snapshot
```

---

## 待開發功能

| 功能 | 優先級 | 說明 |
|------|--------|------|
| 日曆事件讀取 | 高 | 會議提醒 |
| 任務 API | 中 | 創建/完成任務 |
| OKR API | 中 | 自動更新進度 |
| 日報自動填寫 | 高 | 每日打卡 |
| Webhook 接收 | 低 | 事件驅動 |

---

## 注意事項

1. **Token 有效期 2 小時** — 過期需重新獲取
2. **API 限流** — 每分鐘 100 次
3. **權限變更需審批** — 找 Yao yao
4. **Tenant 專屬 URL** — 使用 `xjpr2wuiezaq.jp.larksuite.com`

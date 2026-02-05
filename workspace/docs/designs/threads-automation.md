# Threads 自動發文系統設計文檔

> 版本：1.0 | 更新日期：2025-02-04

## 1. 專案整合分析

### 來源專案

| 專案 | 路徑 | 說明 |
|------|------|------|
| threads-playwright-publisher | `~/Documents/threads-playwright-publisher/` | 核心發布工具 |
| threads-post | `~/Documents/threads-post/` | 完整內容管理系統 |

### 功能對比

| 功能 | threads-playwright-publisher | threads-post |
|------|------------------------------|--------------|
| Playwright 自動發文 | ✅ | ✅ |
| Facebook 自動發文 | ✅ | ✅ |
| Session 持久化 | ✅ | ✅ |
| 反偵測（Stealth） | ✅ | ✅ |
| Dashboard 管理 | ❌ | ✅ |
| AI 生成貼文 | ❌ | ✅ |
| 成效追蹤 | ❌ | ✅ |
| MCP Server | ❌ | ✅ |

### 核心檔案對比

```
兩專案完全相同的檔案：
- src/playwright_publisher.py     (18,536 bytes)
- src/playwright_facebook_publisher.py
- src/config.py                   (1,292 bytes)
- app.py                          (29,385 bytes)
```

**結論**：`threads-playwright-publisher` 是 `threads-post` 的**完整子集**。

---

## 2. 系統架構

```
┌─────────────────────────────────────────────────────────────┐
│                     threads-post 系統                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Claude/MCP   │───▶│  posts.json  │◀───│  Dashboard   │  │
│  │   Server     │    │   (數據庫)   │    │   (Web UI)   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                             │                               │
│                             ▼                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │               app.py (Flask API, Port 8787)          │  │
│  │  - /publish: 發布排程貼文                            │  │
│  │  - /generate: 從 posts.json 生成貼文                 │  │
│  │  - /sync-scheduled: 同步 Threads 排程               │  │
│  └──────────────────────────────────────────────────────┘  │
│                             │                               │
│                             ▼                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           src/playwright_publisher.py                │  │
│  │  - PlaywrightThreadsPublisher                        │  │
│  │  - Firefox/WebKit/Chromium 支援                      │  │
│  │  - Session 持久化                                    │  │
│  │  - 反偵測策略                                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                             │                               │
│                             ▼                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │               Threads.net / Facebook.com             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 核心元件說明

### 3.1 PlaywrightThreadsPublisher

**位置**：`src/playwright_publisher.py`

**功能**：
- 初始化 Playwright 瀏覽器（支援 Firefox/WebKit/Chromium）
- Session 持久化（`storage_state.json`）
- 反偵測策略（playwright-stealth for Chromium）
- 檢查登入狀態
- 創建排程貼文（10 步驟流程）

**使用方式**：
```python
from src.playwright_publisher import PlaywrightThreadsPublisher
from datetime import datetime, timedelta

publisher = PlaywrightThreadsPublisher(
    headless=False,          # 是否無頭模式
    browser_type="firefox",  # 推薦 Firefox
    user_data_dir="./playwright_user_data"
)

publisher.init_driver()
publisher.navigate_to_threads()

if publisher.check_login_status():
    result = publisher.create_post(
        content="你的貼文內容",
        schedule_time=datetime.now() + timedelta(hours=24)
    )

publisher.close()
```

### 3.2 Flask API (app.py)

**端點**：

| 端點 | 方法 | 說明 |
|------|------|------|
| `/health` | GET | 健康檢查 |
| `/publish` | POST | 發布排程貼文到 Threads |
| `/generate` | POST | 從 posts.json 生成貼文 |
| `/sync-scheduled` | POST | 同步 Threads 排程貼文 |
| `/scrape-home` | POST | 抓取 Threads 首頁貼文 |

### 3.3 Dashboard API (dashboard_api.py)

**端點**（Port 5001）：

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/posts` | GET | 獲取所有貼文 |
| `/api/posts/:id/feedback` | POST | 更新貼文反饋 |
| `/api/posts/:id/schedule` | POST | 設定貼文排程 |
| `/api/posts/:id/performance` | POST | 更新成效數據 |

---

## 4. 反偵測策略

### 4.1 瀏覽器選擇

| 瀏覽器 | 推薦度 | 說明 |
|--------|--------|------|
| Firefox | ⭐⭐⭐ | 最佳，原生較難偵測 |
| WebKit | ⭐⭐ | Safari 引擎，備選 |
| Chromium | ⭐ | 容易被封鎖 |

### 4.2 反偵測措施

1. **Firefox 專用設定**
```python
firefox_user_prefs={
    "dom.webdriver.enabled": False,
    "useAutomationExtension": False,
    "general.platform.override": "MacIntel",
}
```

2. **Human-like 行為**
```python
def human_like_delay(self, min_ms=500, max_ms=1500):
    delay = random.randint(min_ms, max_ms)
    self.page.wait_for_timeout(delay)
```

3. **Chromium Stealth Plugin**
```python
from playwright_stealth import stealth_sync
stealth_sync(self.page)
```

---

## 5. 數據結構

### posts.json

```json
{
  "ready_to_publish_posts": [
    {
      "id": "P01",
      "theme": "創業反思",
      "type": "個人故事",
      "content": "貼文內容...",
      "is_posted": false,
      "is_scheduled": false,
      "scheduled_time": "2025-02-05T10:00:00",
      "ai_prediction": {
        "predicted_likes": 150,
        "predicted_comments": 23,
        "predicted_shares": 8
      },
      "actual_performance": {
        "likes": null,
        "comments": null,
        "shares": null,
        "synced_at": null
      },
      "feedback_status": "pending",
      "feedback_notes": ""
    }
  ]
}
```

---

## 6. 歸檔建議

### ✅ 可歸檔：threads-playwright-publisher

**原因**：
1. 所有核心功能已被 `threads-post` 包含
2. `playwright_publisher.py` 完全相同
3. 維護兩個重複專案會造成同步問題

**歸檔步驟**：
```bash
# 1. 確認 threads-post 可正常運作
cd ~/Documents/threads-post
python3 app.py  # 測試 API

# 2. 歸檔舊專案
mv ~/Documents/threads-playwright-publisher ~/Documents/_archived/threads-playwright-publisher-$(date +%Y%m%d)

# 3. 更新任何參照
# - 檢查 cron jobs
# - 檢查其他專案的 import
```

### ✅ 保留：threads-post

作為主要的 Threads 自動化系統。

---

## 7. 萃取為 Skill（可選）

如果未來需要在其他專案中使用發文功能，可以萃取為獨立 skill：

**路徑**：`~/clawd/skills/threads-publisher/`

**結構**：
```
threads-publisher/
├── SKILL.md
├── lib/
│   └── threads_publisher.py
├── config.json
└── requirements.txt
```

**優點**：
- 其他專案可直接引用
- 與 threads-post 分離維護
- 版本控制更清晰

---

## 8. 限制與注意事項

1. **僅支援排程發布**：不支援立即發布
2. **需要手動首次登入**：Session 會過期
3. **每日限額**：25 篇/天
4. **Threads UI 變動風險**：選擇器可能需要更新

---

## 9. 參考資料

- [Playwright Python 文檔](https://playwright.dev/python/)
- [playwright-stealth](https://github.com/AtuboDad/playwright_stealth)
- threads-post README: `~/Documents/threads-post/README.md`

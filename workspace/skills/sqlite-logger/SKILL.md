# SQLite Logger Skill

## 概述
自動記錄所有對話到 SQLite 資料庫，提供結構化查詢、統計分析、自動摘要功能，取代手動記錄。

## 核心功能
1. **自動記錄**：所有收到的消息和 AI 回覆自動寫入 DB
2. **結構化查詢**：依時間、發送者、關鍵字、標籤查詢
3. **統計分析**：活躍時段、發言頻率、對話模式
4. **自動摘要**：AI 生成對話摘要，支援蒸餾到 MEMORY.md
5. **無縫整合**：與現有 memory 系統共存，逐步取代

## 安裝與設定

### 前置需求
```bash
# 安裝 Python 依賴
pip install sqlite3 aiosqlite
```

### 設定檔
建立 `config.json`：
```json
{
  "database_path": "/home/node/clawd/data/conversations.db",
  "auto_summary": true,
  "summary_interval_hours": 24,
  "enable_analytics": true,
  "retention_days": 90
}
```

## Schema 設計

```sql
-- 主消息表
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_key TEXT NOT NULL,           -- Moltbot session key
  channel TEXT,                        -- 頻道類型 (telegram, line, discord)
  chat_id TEXT,                        -- 群組/聊天室 ID
  sender_name TEXT,                    -- 發送者名稱
  sender_id TEXT,                      -- 發送者 ID
  message_id TEXT,                     -- 原始消息 ID
  message_type TEXT DEFAULT 'text',    -- 消息類型 (text, image, voice, file)
  content TEXT,                        -- 消息內容（文字或摘要）
  raw_content TEXT,                    -- 原始完整內容（可選）
  is_ai BOOLEAN DEFAULT 0,             -- 是否為 AI 回覆
  is_reply_to TEXT,                    -- 回覆的消息 ID
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 標籤表（多對多）
CREATE TABLE message_tags (
  message_id INTEGER,
  tag TEXT,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, tag)
);

-- 摘要表
CREATE TABLE summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_key TEXT,
  start_time DATETIME,
  end_time DATETIME,
  summary TEXT,                        -- AI 生成的摘要
  key_points TEXT,                     -- 關鍵要點 (JSON)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 統計快照表
CREATE TABLE analytics_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE,
  session_key TEXT,
  total_messages INTEGER,
  ai_messages INTEGER,
  unique_senders INTEGER,
  top_senders TEXT,                    -- JSON: [{name, count}]
  peak_hour INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 索引優化
```sql
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
CREATE INDEX idx_messages_session ON messages(session_key);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_chat ON messages(chat_id);
CREATE INDEX idx_tags_message ON message_tags(message_id);
CREATE INDEX idx_tags_tag ON message_tags(tag);
```

## 自動化觸發機制

### 1. 消息攔截器
```python
# 攔截所有收到的消息
def on_message_received(message_data):
    """
    message_data 結構：
    {
      "session_key": "main",
      "channel": "telegram",
      "chat_id": "-1001234567890",
      "sender_name": "杜甫",
      "sender_id": "8090790323",
      "message_id": "5145",
      "content": "方向正確，授權你獨自...",
      "is_ai": false,
      "timestamp": "2026-01-31 15:26:00"
    }
    """
    db.insert_message(message_data)
    
    # 自動標籤
    auto_tag_message(message_data)
    
    # 觸發摘要檢查
    check_summary_trigger(message_data.session_key)
```

### 2. AI 回覆攔截器
```python
def on_ai_response(original_message, ai_response):
    """
    記錄 AI 回覆
    """
    message_data = {
        "session_key": original_message.session_key,
        "channel": original_message.channel,
        "chat_id": original_message.chat_id,
        "sender_name": "無極",
        "sender_id": "ai_wuji",
        "message_id": generate_message_id(),
        "content": ai_response,
        "is_ai": True,
        "is_reply_to": original_message.message_id,
        "timestamp": datetime.now()
    }
    db.insert_message(message_data)
```

### 3. 自動標籤系統
```python
def auto_tag_message(message_data):
    tags = []
    
    # 關鍵字標籤
    keywords = {
        "指令": ["幫我", "去做", "查一下", "發給"],
        "決策": ["決定", "選擇", "方案", "採用"],
        "數據": ["數字", "報表", "統計", "分析"],
        "錯誤": ["錯了", "修正", "問題", "bug"],
        "重要": ["重要", "緊急", "優先", "關鍵"]
    }
    
    content = message_data["content"].lower()
    for tag, keyword_list in keywords.items():
        if any(keyword in content for keyword in keyword_list):
            tags.append(tag)
    
    # 發送者標籤
    if message_data["sender_id"] == "8090790323":
        tags.append("杜甫")
    elif message_data["is_ai"]:
        tags.append("AI回覆")
    
    # 保存標籤
    for tag in tags:
        db.add_tag(message_data["id"], tag)
```

## 查詢功能

### 1. 基礎查詢 API
```python
class ConversationQuery:
    def by_time_range(self, start_time, end_time, session_key=None):
        """依時間範圍查詢"""
        pass
    
    def by_sender(self, sender_id, limit=100):
        """依發送者查詢"""
        pass
    
    def by_keyword(self, keyword, session_key=None):
        """關鍵字搜尋"""
        pass
    
    def by_tag(self, tag, session_key=None):
        """依標籤查詢"""
        pass
    
    def get_conversation_thread(self, message_id, depth=10):
        """取得對話線程"""
        pass
```

### 2. 統計分析
```python
class ConversationAnalytics:
    def message_count_by_hour(self, session_key, days=7):
        """每小時消息數量"""
        pass
    
    def top_senders(self, session_key, limit=10, days=30):
        """最活躍發送者"""
        pass
    
    def ai_response_ratio(self, session_key, days=30):
        """AI 回覆比例"""
        pass
    
    def conversation_topics(self, session_key, days=7):
        """對話主題分析"""
        pass
```

### 3. 摘要生成
```python
class ConversationSummarizer:
    def generate_daily_summary(self, session_key, date):
        """生成每日摘要"""
        # 取得當日所有對話
        messages = db.get_messages_by_date(session_key, date)
        
        # 使用 AI 生成摘要
        prompt = f"""
        以下是 {date} 在 {session_key} 的對話記錄：
        {format_messages_for_summary(messages)}
        
        請生成一份摘要，包含：
        1. 主要討論主題
        2. 重要決策
        3. 待辦事項
        4. 關鍵數據
        5. 後續行動建議
        
        摘要格式：簡潔、重點突出、可執行。
        """
        
        summary = ai_generate(prompt)
        db.save_summary(session_key, date, summary)
        return summary
    
    def auto_distill_to_memory(self, session_key, date):
        """自動蒸餾到 MEMORY.md"""
        summary = self.generate_daily_summary(session_key, date)
        
        # 提取值得長期記憶的內容
        long_term_points = extract_long_term_points(summary)
        
        # 更新 MEMORY.md
        update_memory_md(long_term_points)
```

## 與現有系統整合

### 1. 取代 memory_search
```python
def enhanced_memory_search(query):
    """
    增強版記憶搜尋：先搜 DB，再搜檔案
    """
    # 1. 搜尋 SQLite
    db_results = db.search_messages(query)
    
    if db_results:
        return format_db_results(db_results)
    
    # 2. 備用：搜尋檔案系統
    return original_memory_search(query)
```

### 2. 自動備份機制
```python
def backup_to_daily_log():
    """
    每日將 DB 數據備份到 daily log
    """
    yesterday = datetime.now() - timedelta(days=1)
    messages = db.get_messages_by_date("main", yesterday)
    
    if messages:
        # 生成 daily log 格式
        log_content = format_daily_log(messages)
        
        # 寫入 memory/YYYY-MM-DD.md
        write_daily_log(yesterday, log_content)
```

### 3. 遷移現有數據
```python
def migrate_existing_logs():
    """
    遷移現有的 daily logs 到 SQLite
    """
    # 掃描所有 memory/*.md 檔案
    log_files = glob.glob("memory/*.md")
    
    for log_file in log_files:
        # 解析日期
        date = extract_date_from_filename(log_file)
        
        # 解析內容
        messages = parse_daily_log(log_file)
        
        # 寫入 DB
        db.bulk_insert_messages(messages, f"migrated_{date}")
```

## 使用範例

### 1. 查詢今日對話
```bash
# 使用 skill 提供的 CLI
python sqlite_logger.py query --today --session main
```

### 2. 生成週報
```bash
python sqlite_logger.py summary --week --session main
```

### 3. 統計分析
```bash
python sqlite_logger.py analytics --month --session main
```

### 4. 搜尋特定主題
```bash
python sqlite_logger.py search "SQLite skill" --session main --days 7
```

## 部署步驟

### 步驟 1：初始化資料庫
```bash
python sqlite_logger.py init
```

### 步驟 2：啟動監聽服務
```bash
python sqlite_logger.py start
```

### 步驟 3：驗證功能
```bash
python sqlite_logger.py test
```

### 步驟 4：設定自動啟動
```bash
# 建立 systemd 服務或 cron job
```

## 故障排除

### 常見問題
1. **DB 鎖定**：確保單一進程訪問
2. **磁碟空間**：定期清理舊數據
3. **性能問題**：添加索引、分區表
4. **備份失敗**：檢查檔案權限

### 監控指標
- 消息寫入延遲
- DB 檔案大小
- 查詢響應時間
- 摘要生成成功率

## 未來擴展

### 短期
1. **即時儀表板**：Web UI 查看對話統計
2. **情感分析**：分析對話情緒變化
3. **意圖識別**：自動分類對話意圖

### 中期
1. **跨 session 分析**：比較不同群組的對話模式
2. **預測模型**：預測活躍時段、話題趨勢
3. **知識圖譜**：建立對話關聯圖

### 長期
1. **完全自動化**：AI 自主決策基於歷史對話
2. **個性化適應**：學習用戶偏好和習慣
3. **預警系統**：異常對話模式警報

---

## 驗收標準

### 功能驗證
- [ ] 所有消息自動記錄
- [ ] AI 回覆正確標記
- [ ] 查詢功能正常
- [ ] 摘要生成準確
- [ ] 與現有系統整合無縫

### 性能驗證
- [ ] 消息寫入延遲 < 100ms
- [ ] 查詢響應時間 < 1s
- [ ] DB 檔案增長可控
- [ ] 記憶體使用穩定

### 穩定性驗證
- [ ] 7x24 小時運行無故障
- [ ] 異常恢復能力
- [ ] 數據完整性
- [ ] 備份還原功能

---

**版本**: 1.0.0  
**最後更新**: 2026-01-31  
**作者**: 無極 (Wuji)  
**狀態**: 開發中
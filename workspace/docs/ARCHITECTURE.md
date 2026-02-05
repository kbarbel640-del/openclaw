# ARCHITECTURE.md - 無極架構升級設計

> 目標：擺脫 exec 依賴，建立穩定可靠的整合層

---

## 🔴 現狀問題

```
目前架構：
┌─────────────┐
│   Clawdbot  │
│   (無極)    │
└──────┬──────┘
       │ exec (脆弱!)
       ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Python    │     │   rclone    │     │   其他CLI   │
│  (Telethon) │     │  (GDrive)   │     │             │
└──────┬──────┘     └──────┬──────┘     └─────────────┘
       │                   │
       ▼                   ▼
   Telegram            Google Drive
```

**問題：**
- exec spawn 失敗 = 全部掛掉
- 每次呼叫都是新 process
- 無法維持長連接（如 Telegram session）
- 錯誤難以處理和恢復

---

## 🟢 目標架構

```
┌─────────────────────────────────────────────────────────┐
│                      Clawdbot (無極)                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │ message │  │  read   │  │  write  │  │  cron   │    │
│  │  tool   │  │  tool   │  │  tool   │  │  tool   │    │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │
└───────┬─────────────┬─────────────┬─────────────┬───────┘
        │             │             │             │
        │ HTTP/WS     │ HTTP        │ HTTP        │ HTTP
        ▼             ▼             ▼             ▼
┌───────────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│  Telegram     │ │  Database │ │  Google   │ │  Custom   │
│  Bridge       │ │  Bridge   │ │  Bridge   │ │  Bridge   │
│  (常駐服務)   │ │  (常駐)   │ │  (常駐)   │ │           │
└───────┬───────┘ └─────┬─────┘ └─────┬─────┘ └───────────┘
        │               │             │
        ▼               ▼             ▼
    Telegram        MySQL/PG      Google APIs
```

**優點：**
- Bridge 是常駐服務，不會每次 spawn
- 通過 HTTP/WebSocket 通訊，穩定可靠
- 各 Bridge 獨立，一個掛不影響其他
- 可以加 health check 和自動重啟

---

## 📦 Bridge 設計

### 1. Telegram Bridge (telegram-bridge)

**功能：**
- 維持 Telethon session 長連接
- 提供 REST API 讀取群組訊息
- WebSocket 推送新訊息（可選）

**API 設計：**
```
GET  /chats                    # 列出所有對話
GET  /chats/:id/messages       # 讀取訊息
POST /chats/:id/messages       # 發送訊息
GET  /health                   # 健康檢查
```

**實作：**
```python
# telegram_bridge.py
from flask import Flask, jsonify
from telethon import TelegramClient
import asyncio

app = Flask(__name__)
client = None  # 長駐連接

@app.route('/chats/<int:chat_id>/messages')
def get_messages(chat_id):
    messages = asyncio.run(fetch_messages(chat_id))
    return jsonify(messages)

@app.route('/health')
def health():
    return {'status': 'ok', 'connected': client.is_connected()}
```

**部署：**
```bash
# systemd 或 launchd 管理
# 開機自動啟動
# 崩潰自動重啟
```

---

### 2. Database Bridge (db-bridge)

**功能：**
- 維持資料庫連接池
- 提供 REST API 執行查詢
- 支援多個資料庫（BG666、24Bet）

**API 設計：**
```
POST /query                    # 執行 SQL
GET  /databases                # 列出資料庫
GET  /health                   # 健康檢查
```

**安全考量：**
- 只允許 SELECT
- 白名單 table
- Query 參數化

---

### 3. Google Bridge (google-bridge)

**功能：**
- OAuth token 管理
- Drive 檔案存取
- Sheets 讀寫

**API 設計：**
```
GET  /drive/files              # 列出檔案
GET  /drive/files/:id          # 下載檔案
POST /drive/files              # 上傳檔案
GET  /sheets/:id               # 讀取表格
POST /sheets/:id               # 寫入表格
```

---

## 🔧 實作優先級

### Phase 1: Telegram Bridge（最急）
- 解決讀群組的問題
- 2-3 天可完成

### Phase 2: Database Bridge
- 解決站會日報的問題
- 需要 ZeroTier 穩定

### Phase 3: Google Bridge
- 解決幣塔 Drive 存取
- 可以暫時用 rclone

---

## 🏃 快速原型

**今天可以先做：**

```python
# ~/clawd/bridges/telegram_bridge.py
from flask import Flask, jsonify, request
from telethon.sync import TelegramClient
import json

app = Flask(__name__)

# 載入設定
with open('../skills/telegram-userbot/config.json') as f:
    cfg = json.load(f)['telegram']

client = TelegramClient(
    f"{cfg['session_dir']}/{cfg['session_name']}",
    cfg['api_id'],
    cfg['api_hash']
)

@app.route('/chats/<int:chat_id>/messages')
def get_messages(chat_id):
    limit = request.args.get('limit', 20, type=int)
    with client:
        messages = client.get_messages(chat_id, limit=limit)
        return jsonify([{
            'id': m.id,
            'date': m.date.isoformat(),
            'sender': m.sender.first_name if m.sender else None,
            'text': m.text
        } for m in messages if m.text])

@app.route('/health')
def health():
    return {'status': 'ok'}

if __name__ == '__main__':
    app.run(port=5100)
```

**啟動後，Clawdbot 可以用：**
```
web_fetch http://localhost:5100/chats/-5173465395/messages?limit=10
```

不需要 exec！

---

## 📋 待辦

- [ ] 建立 bridges/ 資料夾
- [ ] 實作 telegram_bridge.py
- [ ] 測試 HTTP 呼叫
- [ ] 設定 launchd 自動啟動
- [ ] 文檔化 API

---

## 🤔 討論點

1. **MCP vs HTTP Bridge**
   - MCP 是標準，但 Clawdbot 支援程度？
   - HTTP 更通用，任何工具都能用

2. **認證方式**
   - localhost 不需要？
   - 還是加個 token？

3. **日誌和監控**
   - Bridge 自己記 log
   - 還是統一到 Clawdbot？

---

*設計者：無極*
*日期：2026-01-28*

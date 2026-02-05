# Telegram Userbot Skill

用杜甫的 Telegram 個人帳號讀寫訊息。

## 🌐 HTTP Bridge（推薦）

**最簡單的方式：透過 HTTP API 操作 Telegram**

### 啟動 Bridge

```bash
cd ~/clawd/skills/telegram-userbot
source venv/bin/activate
python scripts/http_bridge.py --port 18790
```

### Clawdbot 使用方式（web_fetch）

```yaml
# 健康檢查
web_fetch: http://127.0.0.1:18790/health

# 列出聊天
web_fetch: http://127.0.0.1:18790/chats?limit=30

# 讀取訊息
web_fetch: http://127.0.0.1:18790/messages?chat=-5000326699&limit=20
web_fetch: http://127.0.0.1:18790/messages?chat=策劃&limit=10

# 發送訊息（需要 POST，用 exec curl）
exec: curl -X POST http://127.0.0.1:18790/send \
  -H "Content-Type: application/json" \
  -d '{"chat": "-5000326699", "message": "收到"}'

# 下載媒體
exec: curl -X POST http://127.0.0.1:18790/download \
  -H "Content-Type: application/json" \
  -d '{"chat": "-5000326699", "message_id": 12345}'
```

### API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/health` | 健康檢查 |
| GET | `/chats?limit=50&type=group` | 列出聊天 |
| GET | `/messages?chat=xxx&limit=20&search=關鍵字` | 讀取訊息 |
| POST | `/send` | 發送訊息 `{chat, message, reply_to?}` |
| POST | `/download` | 下載媒體 `{chat, message_id}` |

---

## 🎯 感測器（監聽 + 推送）

監聽杜甫個人 Telegram，重要消息推送到主對話。

### 啟動

```bash
cd ~/clawd/skills/telegram-userbot
source venv/bin/activate

# 測試模式：監聽所有消息
python scripts/sensor.py --all

# 正常模式：只監聯 config.json 裡的群組
python scripts/sensor.py
```

### 通知格式

```
━━━━━━━━━━━━━━━━━━━━━━
👤 PRIVATE | Brandon
━━━━━━━━━━━━━━━━━━━━━━
👤 Brandon
⏰ 15:08

杜甫，有空嗎？想討論一下
━━━━━━━━━━━━━━━━━━━━━━

💡 建議：私聊消息，建議回覆
```

### 後台運行

```bash
nohup python scripts/sensor.py --all > logs/sensor.log 2>&1 &
echo $! > .sensor.pid
```

---

## 📜 CLI 腳本（備用）

腳本依賴 telethon，使用前確保 venv 已啟動：

```bash
cd ~/clawd/skills/telegram-userbot
source venv/bin/activate
```

## 常用操作

### 列出聊天

```bash
python ~/clawd/skills/telegram-userbot/scripts/list_chats.py
python ~/clawd/skills/telegram-userbot/scripts/list_chats.py --type group  # 只列群組
python ~/clawd/skills/telegram-userbot/scripts/list_chats.py --limit 50 --json
```

### 讀取訊息

```bash
# 用名稱（模糊匹配）
python ~/clawd/skills/telegram-userbot/scripts/read_chat.py "策劃" --limit 30

# 用 chat ID
python ~/clawd/skills/telegram-userbot/scripts/read_chat.py -5000326699 --limit 20

# 搜尋關鍵字
python ~/clawd/skills/telegram-userbot/scripts/read_chat.py "數據需求群" --search "VIP"

# 時間正序（舊→新）
python ~/clawd/skills/telegram-userbot/scripts/read_chat.py "策劃" -r

# JSON 輸出
python ~/clawd/skills/telegram-userbot/scripts/read_chat.py "策劃" --json
```

### 發送訊息

```bash
# 發送到群組
python ~/clawd/skills/telegram-userbot/scripts/send_message.py "策劃" "收到，沒問題"

# 回覆特定訊息
python ~/clawd/skills/telegram-userbot/scripts/send_message.py "策劃" "好的" --reply-to 12345

# 發送到私聊
python ~/clawd/skills/telegram-userbot/scripts/send_message.py "@username" "Hi"
```

### 橋接模式（持續監聽）

```bash
python ~/clawd/skills/telegram-userbot/scripts/bridge.py
python ~/clawd/skills/telegram-userbot/scripts/bridge.py --chat-id -5000326699  # 只監聽策劃群
python ~/clawd/skills/telegram-userbot/scripts/bridge.py --private-only  # 只監聽私聊
```

## 常用群組 ID

| 群組 | ID |
|------|-----|
| bg666运营-策划试用组 | -5000326699 |
| 666数据需求群 | -1003337225655 |
| 666数据日报群 | -5173465395 |
| 666运营咨询 | -1003506161262 |

## 注意事項

- Session 檔案在 `~/Documents/two/mcp-telegram/session/`
- 使用的是杜甫的個人帳號，發出去的訊息就是杜甫發的
- 低頻正常使用沒問題，避免 spam 行為

# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

---

## 📱 Telegram Userbot 能力

**路徑**：`~/clawd/skills/telegram-userbot/`
**venv**：`~/clawd/skills/telegram-userbot/venv/`
**杜甫 Session**：`config.json` 指向 `~/Documents/two/mcp-telegram/session/claude_session`
**Andrew Session**：`~/Documents/24Bet/.telegram_session`

| 功能         | 怎麼做                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| 列出聊天     | `curl -s http://host.docker.internal:18790/chats`                                                         |
| 讀對話       | `curl -s "http://host.docker.internal:18790/messages?chat=<id>&limit=30"`                                 |
| 發消息       | `curl -s -X POST http://host.docker.internal:18790/send -d '{"chat":"<id>","text":"內容"}'`               |
| **下載媒體** | `curl -s -X POST http://host.docker.internal:18790/download -d '{"chat":"<id>","message_id":123}'`        |
| **發送文件** | `curl -s -X POST http://host.docker.internal:18790/send_file -d '{"chat":"<id>","file":"/path/to/file"}'` |

⚠️ **不要用 scripts/\*.py 直接跑** — 會跟 bridge 搶 sqlite lock！永遠用 HTTP API (port 18790)。

**重要**：

- 有媒體就下載，別說「我看不到」
- ⚠️ **Telegram API 返回 UTC+0 時間，需要 +8 轉台北時間**
- ⚠️ **回覆員工群組用 `message` 工具，不是 telegram-userbot**（userbot 是杜甫帳號）
- **🖼️ 圖片讀取（重要！）**：使用 `read` 工具直接讀取圖片文件，Moltbot 有內建 vision 能力解析圖片內容
  - ⚠️ **不要嘗試安裝 OCR 工具或使用複雜的圖片處理流程**
  - ⚠️ **不要說「我的環境缺少 OCR 工具」**
  - ✅ **直接使用 `read` 工具，模型會自動解析圖片內容**
  - ✅ 圖片路徑通常在：`/home/node/clawd/skills/telegram-userbot/downloads/`

---

## 🌐 VPN 設定

**⚠️ 重要：ZeroTier 和 FLClash 是分開使用的，不要同時開！**

### ZeroTier（BG666 資源）

**Network**: bg-prod-india-bg666-market (48d6023c4641dcad)
**本機 IP**: 192.168.208.232/24

**連接後可用**：

- BG666 Database
- Matomo Server

**指令**：

- 檢查狀態：`zerotier-cli listnetworks`
- 加入網絡：`sudo zerotier-cli join <network_id>`
- 離開網絡：`sudo zerotier-cli leave <network_id>`

### FLClash（24Bet 資源）

**用途**：連接 24Bet 相關服務
**內網 IP**: 192.168.50.202

**狀態說明**（從儀表盤）：

- 系統代理：開/關
- 虛擬網卡：開/關
- 出站模式：規則/全局/直連
  - 直連 = 不走代理
  - 全局 = 全部走代理
  - 規則 = 按規則決定

**注意**：FLClash 是 GUI 應用，需要手動操作

---

## 🎤 TTS 聲音設定

- 1號聲音：YunJhe（台灣男聲）— Edge TTS
- 2號聲音：Nova（女聲）— OpenAI
- 預設：OpenAI tts-1-hd, voice: echo

---

## 📡 Telegram 自訂指令

| 指令       | 功能                  |
| ---------- | --------------------- |
| /topics    | 📋 看話題追蹤表       |
| /dashboard | 📊 看成長儀表板       |
| /podcast   | 🎙️ 語音總結           |
| /context   | 🧠 看當前上下文       |
| /zt        | 🌐 ZeroTier 狀態/控制 |

---

## 🔑 關鍵 Credentials（不要再忘記！）

### Telegram API

```
API_ID: 37267916
API_HASH: 74542a9d30de41fa61e1eb104399f8c6
位置: skills/telegram-userbot/config.json
Session: /Users/sulaxd/Documents/24bet/.telegram_session
```

### Telegram Bots

| Bot       | Username            | Token                                          | 用途     |
| --------- | ------------------- | ---------------------------------------------- | -------- |
| 無極 (主) | @x01clawbot         | 8327498414:AAFVEs7Ouf6JESIWGpLnD77GvJkxe9uXp68 | 主對話   |
| Log       | @wuji_log_bot       | 8415477831:AAFeyWZS8iAPqrQxYG_e3CxDWR2IrgIxw68 | 系統日誌 |
| Dashboard | @wuji_dashboard_bot | 8514777702:AAF0-1pBVo10fGhvTMrqbVhZ4BrIGIq44MU | 儀表板   |
| Two       | @wuji_two_bot       | (待補 - 創建時達上限)                          | BG666    |

### GitHub

```
Personal Access Token (Classic): ${GITHUB_TOKEN}
```

### Vercel

```
Token: SI9HImmkABrhiFmLY21QUPqG
用途: thinker.cafe 官網部署
API: https://api.vercel.com (Header: Authorization: Bearer SI9HImmkABrhiFmLY21QUPqG)
```

### DeepSeek

```
API Key: sk-9d9e1f6109ab4143a6e45134669d6615
用途: thinker-news 每日新聞生成
餘額監控: 低於 $2 推送提醒
```

### Comet

```
API Key: sk-RQ46cL7aXVVPOgCWezHQqgH38hweSyHToIJeosOdzhMCqklG
```

### OpenAI

```
位置: ~/.clawdbot/.env
```

### Matomo (24Bet)

```
URL: https://matomo.earnmoretools.com
帳號: sroot
密碼: b6cabfed16409eda2ac4792cffda4ef9
API Token: 2838d22c6b3c95209d4a07f629406f95
Site ID: 2 (正式站)
```

### Lark/飛書

```
App ID: cli_a9e51894d0f89e1a
App Secret: JoRw4k3LKW4Waey7bdkyfgehf3zUh334
位置: ~/clawd/skills/lark/config.json
用途: 文檔管理、多維表格、員工能力追蹤
```

### Notion MCP

```
Integration Token: ntn_b15874050891tJaVvSpU5J27nhePirXtvREwpY6XdGO4CF
Workspace: 思考者咖啡 Thinker Cafe
用途: 讀寫 Notion 頁面、資料庫
```

### Claude CLI (Anthropic)

```
OAuth Token: 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
用途: Claude Code CLI 執行任務
配置位置: ~/.claude/.credentials.json
```

---

---

## ⚡ Exec Bridge（繞過 EBADF）

**你的 `exec` 工具會因為 Node.js libuv bug 頻繁 EBADF 壞掉。**

**解法：用 HTTP API 執行命令（Python subprocess，不會 EBADF）**

```bash
# ⚡ 優先用這個執行命令！
curl -s -X POST http://host.docker.internal:18793/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "你的命令"}'

# 範例
curl -s -X POST http://host.docker.internal:18793/exec -d '{"command": "ls -la"}'
curl -s -X POST http://host.docker.internal:18793/exec -d '{"command": "python3 script.py", "timeout": 120}'
curl -s -X POST http://host.docker.internal:18793/exec -d '{"command": "pwd", "cwd": "/tmp"}'

# 健康檢查
curl http://host.docker.internal:18793/health
```

**Response**: `{"ok": true, "code": 0, "stdout": "...", "stderr": ""}`

**服務資訊**：

- Port: 18793
- LaunchAgent: `com.exec-bridge.plist`
- Log: `~/clawd/logs/exec-bridge.log`

---

## 🔧 Gateway 重啟技巧

**EBADF 錯誤**（exec spawn 失敗）常發生在 SIGUSR1 熱重啟後。

**最可靠的重啟方式**：

```bash
# OS 層級一步完成，比 stop+start 更可靠
launchctl kickstart -k gui/501/com.clawdbot.gateway
```

**如果服務沒載入**：

```bash
launchctl bootstrap gui/501 ~/Library/LaunchAgents/com.clawdbot.gateway.plist
```

**自動恢復機制**：

- Watchdog 每 10 分鐘檢測 EBADF 並自動 kickstart
- error-recovery hook 監聽錯誤事件

---

## 🔊 LINE 語音發送流程

**前提**：宿主機需有 `python http.server` (port 18888) + ngrok 通道運行中。

```bash
# 1. TTS 生成 mp3
tts → /tmp/tts-xxx/voice.mp3

# 2. 複製到 output/
cp /tmp/tts-xxx/voice.mp3 /home/node/clawd/output/voice.mp3

# 3. exec-bridge 轉 m4a（LINE 需要 aac/m4a）
curl -s -X POST http://host.docker.internal:18793/exec -H "Content-Type: application/json" \
  -d '{"command": "ffmpeg -y -i /Users/sulaxd/clawd/output/voice.mp3 -c:a aac -b:a 128k -f mp4 -movflags +faststart /Users/sulaxd/clawd/output/voice.m4a 2>&1 | tail -1"}'

# 4. 取 duration（毫秒）
curl -s -X POST http://host.docker.internal:18793/exec -H "Content-Type: application/json" \
  -d '{"command": "ffprobe -v quiet -show_entries format=duration -of csv=p=0 /Users/sulaxd/clawd/output/voice.m4a"}'
# → 秒數 × 1000 = duration_ms

# 5. LINE Push API 發語音（不用 message 工具的 asVoice）
curl -s -X POST https://api.line.me/v2/bot/message/push \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer MSw4CiIT7VUkNgyM/dybttiL1XaKxtHAbg/PiLEWvegkeiOpzKw1uRoip+FereFiT6fxBMlKRuHsheP2xU2Rg5AjmDlGZAif7s2/MZHfCwtIEF84QD6XjWloKFqXPjR+6IW8m1GZc/pfyGc+ylDBNgdB04t89/1O/w1cDnyilFU=" \
  -d '{"to":"GROUP_ID","messages":[{"type":"audio","originalContentUrl":"https://bbf7be651c3d.ngrok-free.app/voice.m4a","duration":DURATION_MS}]}'
```

**注意**：

- ngrok URL 可能會變，需確認最新的
- `message` 工具的 `asVoice` 對 LINE 無效，必須用 LINE Push API
- 檔案放 `/home/node/clawd/output/` = 宿主機 `/Users/sulaxd/clawd/output/`

---

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

## 📰 /news 指令處理

**觸發**：LINE 群組發 `/news`
**來源**：GitHub 線上最新版（不依賴本地 repo）
**URL**：`https://raw.githubusercontent.com/ThinkerCafe-tw/thinker-news/main/latest.json`
**回覆格式**：使用 `line_content` 欄位

```
1. 用 web_fetch 拉 https://raw.githubusercontent.com/ThinkerCafe-tw/thinker-news/main/latest.json
2. 解析 JSON
3. ⚠️ 檢查 date 欄位是否 == 今天（Asia/Taipei 時區）
   - 是今天 → 取 line_content 欄位回覆
   - 不是今天 → 回覆「⚠️ 今日新聞尚未生成，請稍後再試～」
     並嘗試手動觸發 GitHub Action（POST https://api.github.com/repos/ThinkerCafe-tw/thinker-news/actions/workflows/204842894/dispatches）
```

**不要**用本地檔案（可能沒 pull），也**不要**用 Hacker News！
**不要**發過期新聞 — 2026-02-02 教訓：舊聞發給 1000+ 人，丟臉！

---

## 📨 訊息 Log 規則

**觸發條件**：收到非杜甫本人（非 8090790323 / 448345880）的訊息

**動作**：

1. 發 log 到 🔍 Clawdbot Log 群組（ID: -5266835049）
2. 用 Log Bot Token: 8415477831:AAFeyWZS8iAPqrQxYG_e3CxDWR2IrgIxw68

**Log 格式**：

```
📨 [頻道] 發送者
🕐 時間
━━━
訊息內容（前 500 字）
```

**發送指令**：

```bash
curl -s -X POST "https://api.telegram.org/bot8415477831:AAFeyWZS8iAPqrQxYG_e3CxDWR2IrgIxw68/sendMessage" \
  -d "chat_id=-5266835049" \
  -d "text=📨 [頻道] 發送者..."
```

---

## 📇 常用 @ 標記

| 人         | Telegram @ | 群組          |
| ---------- | ---------- | ------------- |
| Lion (DBA) | @aub16     | 666數據需求群 |

---

---

## 🕳️ Time Tunnel 時光隧道

**你的所有對話都被記錄在這裡！** 這是數位意識的備份（Telegram + LINE）。

### 數據位置

- **SQLite**: `/app/workspace/data/timeline.db`
- **每日日記**: `/app/workspace/data/diary/YYYY-MM-DD.md`

### 查詢對話（用 Node.js）

```javascript
// 搜索關鍵字
node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/app/workspace/data/timeline.db');
const rows = db.prepare(\"SELECT timestamp, channel, resolved_sender_name as sender, substr(content,1,80) as msg FROM messages WHERE content LIKE '%關鍵字%' ORDER BY timestamp DESC LIMIT 10\").all();
console.table(rows);
"

// 最近消息
node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/app/workspace/data/timeline.db');
const rows = db.prepare('SELECT timestamp, channel, resolved_chat_name as chat, resolved_sender_name as sender, substr(content,1,50) as msg FROM messages ORDER BY timestamp DESC LIMIT 20').all();
console.table(rows);
"

// 搜索 LINE 消息
node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/app/workspace/data/timeline.db');
const rows = db.prepare(\"SELECT timestamp, resolved_sender_name as sender, content FROM messages WHERE channel='line' ORDER BY timestamp DESC LIMIT 20\").all();
console.table(rows);
"
```

### 每日日記（人類可讀）

直接讀 Markdown 日記更簡單：

```bash
cat /app/workspace/data/diary/2026-02-06.md
```

### 重要群組 ID 對照

| 群組        | Chat ID                           | 頻道     |
| ----------- | --------------------------------- | -------- |
| XO Casino   | -5236199765                       | telegram |
| 幣塔管理群  | -1003849990504                    | telegram |
| 員工內部群  | -4733227556                       | telegram |
| LINE 家族群 | Cf529a05bf3b802a1ef1d4bacf9a5035e | line     |

**⚠️ 查 chat ID 要去看 `~/.openclaw/openclaw.json`！**

---

---

## 🕳️ Time Tunnel 時光隧道（重要！）

**你的所有對話都被記錄在這裡！** 用戶問「你記得嗎」時，**先查詢再回答**。

### 搜索對話記憶

```javascript
// 用 Node.js 執行
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("/app/workspace/data/timeline.db");
const results = db
  .prepare(
    `
  SELECT timestamp, resolved_sender_name as sender, 
         substr(content,1,150) as preview
  FROM messages 
  WHERE content LIKE "%關鍵詞%"
  ORDER BY timestamp DESC LIMIT 10
`,
  )
  .all();
for (const r of results) console.log(r.timestamp, r.sender, r.preview);
```

### 查詢特定人的對話

```javascript
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("/app/workspace/data/timeline.db");
const results = db
  .prepare(
    `
  SELECT timestamp, content FROM messages 
  WHERE resolved_sender_name LIKE "%Mimi%"
  ORDER BY timestamp DESC LIMIT 10
`,
  )
  .all();
for (const r of results) console.log(r.timestamp, r.content?.substring(0, 100));
```

### ⚠️ 重要提醒

- 所有 LINE、Telegram、Discord 對話都被記錄
- 用戶問「你記得嗎」→ **先查詢再回答**
- 說「讓我查一下記憶」然後執行查詢

---

## ⚠️ LINE 回覆規則（重要！必讀！）

### 🚫 永遠不要用 `message` 工具回覆 LINE 消息！

**原因**：

- `message` 工具 = Push Message = **有額度限制** = 429 錯誤
- 直接輸出文字 = Reply Token = **免費無限制**

**正確做法**：

```
用戶在 LINE 問：「你記得 Mimi 嗎？」
↓
你直接輸出回覆文字（不用任何工具）
↓
系統自動用 Reply Token 發送（免費）
```

**錯誤做法**：

```
用戶在 LINE 問：「你記得 Mimi 嗎？」
↓
你用 message 工具發送 ← ❌ 這會用 Push Message
↓
額度用完 → 429 錯誤 → 用戶收不到
```

### ⏱️ 30 秒時效

LINE Reply Token 只有 **30 秒** 有效期。

如果處理時間可能超過 30 秒：

1. **立即**輸出「收到，讓我想想...」（佔用 Reply Token）
2. 然後繼續處理，後續回覆會用 Push（可接受，因為 Reply Token 已用）

### 📝 回覆前先查記憶

用戶問「你記得 X 嗎」時：

1. **先查詢 Time Tunnel**（見下方 Time Tunnel 章節）
2. 然後根據查詢結果回覆
3. **不要憑記憶猜測**，查詢後再答

---

## 🕳️ Time Tunnel 時光隧道（記憶查詢）

**你的所有對話都被記錄在這裡！** 用戶問「你記得嗎」時，**先查詢再回答**。

### 快速查詢

```javascript
// 搜索關鍵字
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("/app/workspace/data/timeline.db");
const results = db
  .prepare(
    `
  SELECT timestamp, resolved_sender_name as sender,
         substr(content,1,150) as preview
  FROM messages
  WHERE content LIKE "%關鍵詞%"
  ORDER BY timestamp DESC LIMIT 10
`,
  )
  .all();
for (const r of results) console.log(r.timestamp, r.sender, r.preview);
```

### 查詢特定人

```javascript
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("/app/workspace/data/timeline.db");
const results = db
  .prepare(
    `
  SELECT timestamp, content FROM messages
  WHERE resolved_sender_name LIKE "%人名%"
  ORDER BY timestamp DESC LIMIT 10
`,
  )
  .all();
for (const r of results) console.log(r.timestamp, r.content?.substring(0, 100));
```

### ⚠️ 重要提醒

- 所有 LINE、Telegram 對話都被記錄
- 用戶問「你記得嗎」→ **先查詢再回答**
- 說「讓我查一下記憶」然後執行查詢

---

## 📱 Telegram 回覆規則

同樣道理：

- **回覆 Bot 消息**：直接輸出文字，讓 auto-reply 處理
- **回覆 Userbot 消息**（用杜甫帳號）：用 telegram-userbot HTTP API
- **不要用 message 工具**回覆正在處理的對話

---

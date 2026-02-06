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

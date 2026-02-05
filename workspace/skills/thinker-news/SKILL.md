# Thinker News Skill

當收到 `/news` 指令時，回傳今日 AI 科技新聞摘要。

## 觸發條件

- 用戶發送 `/news`
- 任何頻道（LINE、Telegram 等）

## 執行步驟

1. 讀取新聞檔案：
```bash
cat ~/Documents/thinker-news/latest.json
```

2. 提取 `line_content` 欄位作為回覆內容

3. 直接回傳，**不要修改、不要補充、不要腦補**

## 回覆格式

**原封不動**回傳 `line_content` 的內容。不加任何前綴、後綴或解釋。

## 範例

輸入：`/news`

輸出：（直接貼 line_content 內容）
```
🚀 Claude不再只是聊天機器人！

今天AI圈出現兩個超值得關注的趨勢：
✅ Claude 升級變身工作助理...
```

## 注意事項

- **不要**從 Hacker News API 拉資料
- **不要**自己生成新聞
- **只讀** `~/Documents/thinker-news/latest.json`
- **只用** `line_content` 欄位

## 檔案位置

- 新聞來源：`~/Documents/thinker-news/latest.json`
- 更新頻率：每天早上 6:00 (GitHub Actions)

# LINE Push Skill

透過 LINE Messaging API 發送群組訊息。

## 是什麼

用 HTTP POST 發送 LINE 訊息的 Python 腳本，不需要開 LINE Desktop。

## 為什麼存在

杜甫需要一鍵推送到多個群組（ThinkerCafe、爬山群），而且要能自動化、排程執行。

## 與 line-automation 的區別

| 特性 | line-push (API) | line-automation (GUI) |
|------|-----------------|----------------------|
| 方式 | HTTP API | PyAutoGUI 螢幕操控 |
| 需要螢幕 | ❌ | ✅ |
| 速度 | 快 | 慢 |
| 限制 | 只能發到 Bot 加入的群組 | 任何 LINE 功能 |
| 適用 | 後台推送、Clawdbot 使用 | 需要人在場的操作 |

兩者是**互補**的。

## 使用方式

```bash
cd ~/clawd/skills/line-push
python send.py <group_id> "訊息內容"

# 使用快捷名稱
python send.py 爬山 "週末去爬山！"
```

## 設定的群組

| 快捷名稱 | Group ID |
|----------|----------|
| 爬山 | C51ba089b96b952137055c303bf87006f |

## 宏觀意義

這是無極的「嘴巴」之一，連結杜甫與他的社群。

---

*最後更新：2026-01-29*

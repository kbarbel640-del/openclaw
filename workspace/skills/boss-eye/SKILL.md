---
name: boss-eye
description: 老領班風控偵測系統 - 數據抓取 → AI 推理 → 老領班點評完整閉環
---

# 🕵️ 老領班風控偵測系統 (Boss Eye)

**系統角色**：在柬埔寨西港做了15年的老領班，黑白兩道通吃，一眼看穿盤口貓膩。

## 🎯 核心功能

### 1. 風控偵測 SQL
- **極速重複注單**：同一秒內下注多筆（腳本特徵）
- **整數大額下注**：打水團隊特徵（5000, 10000 等整數）
- **充提轉化分析**：Matomo 點擊 vs 實際入帳對比

### 2. Matomo 漏斗追蹤
- 充值按鈕點擊數
- 實際成功充值數
- 轉化率分析

### 3. AI 老領班點評
- 江湖口吻分析
- 直接點名異常 ID
- 盤口貓膩偵測

## 🚀 快速開始

```bash
# 執行老領班風控偵測
python /home/node/clawd/skills/boss-eye/boss_eye.py

# 設定 Cron Job（每15分鐘）
*/15 * * * * cd /home/node/clawd/skills/boss-eye && python boss_eye.py >> /tmp/boss_eye.log 2>&1
```

## 📊 輸出示例

```
🕵️ 老領班風控報告 - 2026-01-31 17:30

【今日盤口掃描】
1. 疑似腳本特徵：發現 3 個用戶在同一秒內下注 3+ 筆
   - 用戶 ID: 8848 (5筆/秒)
   - 用戶 ID: 6666 (4筆/秒)

2. 疑似打水特徵：發現 2 個用戶規律整數下注
   - 用戶 ID: 7777 (10筆 5000元)
   - 用戶 ID: 8888 (8筆 10000元)

3. 充值通道分析：
   - Matomo 點擊：500 次
   - 實際入帳：20 筆
   - 轉化率：4% (⚠️ 通道可能漏水)

【老領班點評】
今天的盤，有兩幫人在『偷雞』：
1. ID 8848、6666 這兩個崽種在用腳本刷單，同一秒連發，不是手點。
2. ID 7777、8888 在打水，下注金額太漂亮，散戶不會這樣玩。

門口的『路』有點堵：500人點充值，只有20人進來，要查查支付通道是不是被風控了。

誰在搞鬼？上面四個 ID 先鎖了，今晚請他們喝茶。
```

## 🔧 技術架構

### 數據層
```python
# BG666 數據庫
- Host: bg666-market-readonly.czsks2mguhd5.ap-south-1.rds.amazonaws.com
- Database: ry-cloud
- Tables: bet_logs, deposits, sys_player 等

# Matomo 數據庫
- Host: 13.205.188.209 (SSH) → 10.188.4.51:3306
- Database: matomo
- Tables: matomo_log_visit, matomo_log_action 等
```

### AI 推理層
```python
# 老領班提示詞模板
"""
系統角色：你是在柬埔寨西港做了15年的老領班，黑白兩道通吃，一眼看穿盤口貓膩。

當前現場數據：
1. 疑似腳本特徵（同一秒連發）：{flash_bets}
2. 疑似打水特徵（整數規律下注）：{patterns}
3. 實時成功充值金額：{real_income}
4. Matomo 前端行為（充值按鈕點擊數）：{matomo_data}

請用江湖口吻交待三件事：
- 今天的盤，有沒有人『偷雞』？（分析打水行為）
- 門口的『路』通不通？（分析充值點擊多但錢沒進來的漏水情況）
- 誰在搞鬼？（直接點名異常 ID）
"""
```

### 輸出層
- Telegram 私密頻道推送
- 本地日誌記錄
- JSON 格式數據存儲

## 📁 檔案結構

```
boss-eye/
├── SKILL.md              # 技能說明
├── boss_eye.py           # 主程式
├── config/
│   ├── database.yaml     # 數據庫配置
│   └── telegram.yaml     # Telegram 配置
├── sql/
│   ├── risk_detection.sql    # 風控 SQL
│   └── matomo_funnel.sql     # Matomo 漏斗 SQL
└── logs/
    └── boss_eye_YYYYMMDD.log # 日誌檔案
```

## 🔗 與現有系統整合

### 1. 使用現有 bg666-db 連線
```python
# 重用現有的查詢工具
from skills.bg666-db.scripts.query import BG666Query
from skills.bg666-db.scripts.matomo import MatomoQuery
```

### 2. 整合 Telegram 推送
```python
# 使用現有的 tg.py
from skills.bg666-db.scripts.tg import send_to_channel
```

### 3. 與 daily_report 系統結合
- 風控數據納入每日報告
- 異常警報即時推送

## ⚙️ 配置說明

### 數據庫配置 (config/database.yaml)
```yaml
bg666:
  host: "bg666-market-readonly.czsks2mguhd5.ap-south-1.rds.amazonaws.com"
  database: "ry-cloud"
  user: "readonly_user"
  password: "{{ENV:BG666_DB_PASSWORD}}"

matomo:
  ssh_host: "13.205.188.209"
  ssh_user: "ubuntu"
  ssh_key: "~/.ssh/id_rsa"
  mysql_host: "10.188.4.51"
  mysql_port: 3306
  database: "matomo"
  user: "matomo_user"
  password: "{{ENV:MATOMO_DB_PASSWORD}}"
```

### Telegram 配置 (config/telegram.yaml)
```yaml
channels:
  boss_report: "-1001234567890"  # 老領班私密頻道
  data_team: "-1003337225655"    # 數據需求群
  daily_report: "-5173465395"    # 數據日報群

bot_token: "{{ENV:TELEGRAM_BOT_TOKEN}}"
```

## 🚨 異常處理

### 1. 數據庫連線失敗
- 自動重試機制
- ZeroTier 網絡檢查
- SSH tunnel 健康檢查

### 2. AI 推理失敗
- 備用模板輸出
- 原始數據回退
- 錯誤日誌記錄

### 3. Telegram 推送失敗
- 本地日誌備份
- 郵件通知備援
- 重試隊列機制

## 📈 進階功能

### 1. 自學習風控規則
- 異常模式自動標記
- 規則庫動態更新
- 誤報率優化

### 2. 實時警報系統
- Webhook 觸發
- 頻率控制
- 警報升級機制

### 3. 數據可視化
- 風險熱力圖
- 時間序列分析
- 玩家畫像構建

## 👥 使用場景

### 運營團隊
- 實時監控盤口異常
- 快速鎖定風險玩家
- 優化充值通道

### 風控團隊
- 自動化風險偵測
- 數據驅動決策
- 規則驗證與優化

### 管理層
- 每日風控簡報
- 關鍵指標追蹤
- 戰略決策支持
```

---

**最後更新**：2026-01-31  
**狀態**：🟢 設計完成，待實作
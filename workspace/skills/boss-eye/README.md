# 🕵️ 老領班風控偵測系統 (Boss Eye)

**系統角色**：在柬埔寨西港做了15年的老領班，黑白兩道通吃，一眼看穿盤口貓膩。

## 🎯 核心價值

> 「數據抓取 → AI 推理 → 老領班點評」完整閉環

### 偵測目標：
1. **打水團隊** - 整數規律下注，算水方便
2. **腳本機器人** - 同一秒連發，人類無法做到
3. **通道漏水** - 點擊多但錢沒進來
4. **異常玩家** - VIP 玩家的風險行為

## 🚀 快速開始

### 1. 安裝依賴
```bash
# 運行安裝腳本
chmod +x setup.sh
./setup.sh
```

### 2. 配置環境
```bash
# 複製環境變數模板
cp .env.example .env

# 編輯配置
nano .env
```

### 3. 測試運行
```bash
# 測試腳本
./test_run.sh

# 或直接運行
python boss_eye.py
```

### 4. 設置定時任務
```bash
# 每15分鐘執行一次
crontab -e
# 添加：*/15 * * * * cd /path/to/boss-eye && .venv/bin/python boss_eye.py >> logs/cron.log 2>&1
```

## 📊 系統架構

```
boss-eye/
├── boss_eye.py          # 主程式
├── config/
│   └── database.yaml    # 數據庫配置
├── sql/
│   └── risk_detection.sql  # 風控 SQL 查詢
├── logs/                # 日誌目錄
├── reports/             # 報告目錄
├── data/                # 數據緩存
├── .env.example         # 環境變數模板
├── requirements.txt     # Python 依賴
├── setup.sh            # 安裝腳本
├── test_run.sh         # 測試腳本
└── README.md           # 本文檔
```

## 🔧 技術特性

### 1. 智能風控偵測
```sql
-- 極速注單：同一秒內 >2 筆
SELECT user_id, COUNT(*) as flash_bets
FROM bet_logs 
GROUP BY user_id, UNIX_TIMESTAMP(bet_time)
HAVING flash_bets > 2;

-- 整數下注：打水特徵
SELECT user_id, COUNT(*) as pattern_count
FROM bet_logs 
WHERE amount IN (1000, 5000, 10000, ...)
GROUP BY user_id 
HAVING pattern_count > 4;
```

### 2. 雙數據源驗證
- **BG666 RDS**：真實交易數據
- **Matomo**：前端行為數據
- **對比分析**：點擊 vs 實際轉化

### 3. AI 老領班點評
```python
# 江湖口吻分析
prompt = """
你是在柬埔寨西港做了15年的老領班...
今天的盤，有沒有人『偷雞』？
門口的『路』通不通？
誰在搞鬼？
"""
```

### 4. 多渠道輸出
- Telegram 私密頻道
- 本地日誌文件
- JSON 數據報告
- 控制台實時輸出

## ⚙️ 配置說明

### 環境變數 (.env)
```bash
# BG666 數據庫
BG666_DB_HOST=bg666-market-readonly.czsks2mguhd5.ap-south-1.rds.amazonaws.com
BG666_DB_PASSWORD=your_password

# Matomo
MATOMO_TOKEN=your_matomo_token

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_BOSS_CHANNEL=-1001234567890

# AI API
AI_API_KEY=your_ai_api_key
```

### 風控參數 (config/database.yaml)
```yaml
detection:
  thresholds:
    flash_bets: 3      # 同一秒內下注筆數閾值
    pattern_count: 5   # 整數下注模式次數閾值
    time_window_minutes: 10  # 偵測時間窗口
```

## 📈 輸出示例

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

## 🔗 與現有系統整合

### 1. 使用 bg666-db 基礎設施
```python
# 重用現有的數據庫連接
from skills.bg666-db.scripts.query import BG666Query
```

### 2. 整合 Telegram 通知
```python
# 使用現有的 tg.py
from skills.bg666-db.scripts.tg import send_to_channel
```

### 3. 納入每日報告系統
- 風控數據自動納入日報
- 異常警報即時推送
- 歷史趨勢分析

## 🚨 異常處理

### 數據庫連接失敗
- 自動重試機制
- ZeroTier 網絡檢查
- 備用數據源切換

### AI 服務不可用
- 模板化報告回退
- 原始數據輸出
- 錯誤日誌記錄

### Telegram 推送失敗
- 本地日誌備份
- 重試隊列機制
- 郵件通知備援

## 📊 監控指標

### 業務指標
- 異常玩家檢測率
- 風險訂單攔截率
- 充值轉化率提升

### 系統指標
- 數據庫查詢響應時間
- AI 推理延遲
- 報告生成成功率

### 質量指標
- 誤報率 (False Positive)
- 漏報率 (False Negative)
- 警報準確率

## 👥 使用場景

### 運營團隊
- 實時監控盤口異常
- 快速鎖定風險玩家
- 優化充值通道效率

### 風控團隊
- 自動化風險偵測
- 數據驅動決策支持
- 規則驗證與優化

### 管理層
- 每日風控簡報
- 關鍵指標儀表板
- 戰略決策數據支持

## 🔮 未來擴展

### 短期規劃
1. 實時 Webhook 警報
2. 風險玩家畫像構建
3. 自學習風控規則

### 中期規劃
1. 多平台數據整合
2. 預測性風險分析
3. 自動化處置流程

### 長期規劃
1. 風控知識圖譜
2. 聯防聯控生態
3. 合規審計自動化

## 📞 支持與反饋

### 問題排查
1. 檢查日誌：`tail -f logs/boss_eye_*.log`
2. 測試連接：`python -c "import pymysql; print('OK')"`
3. 驗證配置：`python boss_eye.py --validate`

### 性能優化
1. 數據庫索引優化
2. 查詢緩存機制
3. 批量處理優化

### 安全建議
1. 環境變數加密存儲
2. API 令牌輪換
3. 訪問日誌審計

## 📝 版本歷史

### v1.0.0 (2026-01-31)
- 初始版本發布
- 基礎風控偵測功能
- 老領班 AI 點評
- 多通道輸出支持

### 待開發功能
- [ ] 實時 Webhook 警報
- [ ] 風險玩家畫像
- [ ] 自學習規則引擎
- [ ] 可視化儀表板

---

**最後更新**：2026-01-31  
**狀態**：🟢 生產就緒  
**維護者**：無極 (Wuji) AI 系統總工程師  
**聯繫**：通過 Telegram @DufuTheSage
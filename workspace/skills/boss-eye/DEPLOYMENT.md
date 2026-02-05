# 🚀 老領班風控偵測系統 - 部署指南

## 📋 部署前檢查清單

### 1. 系統要求
- [ ] Python 3.8+
- [ ] MySQL/MariaDB 客戶端庫
- [ ] ZeroTier 網絡連接（BG666 RDS）
- [ ] SSH 訪問權限（Matomo 數據庫）
- [ ] 網絡訪問：Telegram API、AI API

### 2. 權限要求
- [ ] BG666 數據庫只讀權限
- [ ] Matomo API token（讀取權限）
- [ ] Telegram Bot 管理權限
- [ ] 文件系統寫入權限（日誌、報告）

### 3. 配置準備
- [ ] BG666 數據庫連接資訊
- [ ] Matomo API token
- [ ] Telegram Bot token
- [ ] AI API key（可選）
- [ ] 通知頻道 ID

## 🛠️ 部署步驟

### 步驟 1：環境準備
```bash
# 克隆或複製技能目錄
cd /home/node/clawd/skills/
cp -r boss-eye /your/deployment/path/
cd /your/deployment/path/boss-eye

# 設置文件權限
chmod +x *.sh
chmod +x boss_eye.py
```

### 步驟 2：安裝依賴
```bash
# 方法 A：使用安裝腳本（推薦）
./setup.sh

# 方法 B：手動安裝
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 步驟 3：配置系統
```bash
# 複製環境變數模板
cp .env.example .env

# 編輯配置文件
nano .env
nano config/database.yaml
```

### 步驟 4：測試運行
```bash
# 測試模式（使用模擬數據）
./test_run.sh

# 完整測試（連接真實數據庫）
python boss_eye.py --verbose
```

### 步驟 5：設置定時任務
```bash
# 編輯 crontab
crontab -e

# 添加以下行（每15分鐘執行）
*/15 * * * * cd /your/deployment/path/boss-eye && /your/deployment/path/boss-eye/.venv/bin/python boss_eye.py >> /your/deployment/path/boss-eye/logs/cron.log 2>&1

# 每天凌晨清理舊日誌
0 2 * * * find /your/deployment/path/boss-eye/logs -name "*.log" -mtime +7 -delete
```

### 步驟 6：驗證部署
```bash
# 檢查定時任務
crontab -l

# 手動觸發一次運行
cd /your/deployment/path/boss-eye
./boss_eye.py

# 檢查日誌
tail -f logs/boss_eye_*.log
tail -f logs/cron.log
```

## 🔧 配置詳解

### 環境變數 (.env)
```bash
# ========== BG666 數據庫 ==========
BG666_DB_HOST=bg666-market-readonly.czsks2mguhd5.ap-south-1.rds.amazonaws.com
BG666_DB_PORT=3306
BG666_DB_NAME=ry-cloud
BG666_DB_USER=readonly_user
BG666_DB_PASSWORD=實際密碼  # 🔐 重要！

# ========== Matomo 配置 ==========
MATOMO_URL=https://your-matomo-domain.com/index.php
MATOMO_TOKEN=實際_token     # 🔐 重要！
MATOMO_SITE_ID=1

# ========== Telegram 配置 ==========
TELEGRAM_BOT_TOKEN=實際_bot_token  # 🔐 重要！
TELEGRAM_BOSS_CHANNEL=-1001234567890  # 老領班私密頻道
TELEGRAM_DATA_TEAM=-1003337225655     # 數據需求群

# ========== AI API 配置 ==========
AI_PROVIDER=anthropic  # anthropic | openai | deepseek
AI_MODEL=claude-3-opus-20240229
AI_API_KEY=實際_api_key  # 🔐 重要！

# ========== 系統配置 ==========
LOG_LEVEL=INFO  # DEBUG | INFO | WARNING | ERROR
REPORT_RETENTION_DAYS=30
CRON_SCHEDULE="*/15 * * * *"
```

### 配置文件 (config/database.yaml)
```yaml
# 表名映射（根據實際數據庫調整）
bg666:
  tables:
    bet_logs: "bet_logs"              # 注單記錄表
    deposits: "player_recharge_order" # 充值訂單表
    players: "sys_player"             # 玩家主表

# 風控參數
detection:
  thresholds:
    flash_bets: 3      # 同一秒內下注筆數閾值
    pattern_count: 5   # 整數下注模式次數閾值
    time_window_minutes: 10
    pattern_window_hours: 1
```

## 📊 監控與維護

### 日常監控
```bash
# 查看最近日誌
tail -n 100 logs/boss_eye_*.log

# 檢查錯誤
grep -i "error\|failed\|exception" logs/*.log

# 查看定時任務執行情況
tail -f logs/cron.log

# 檢查磁碟空間
du -sh logs/ reports/ data/
```

### 性能監控
```bash
# 查看執行時間
grep "任務完成" logs/boss_eye_*.log | tail -5

# 數據庫查詢性能
grep "數據庫連接" logs/boss_eye_*.log | tail -5

# 內存使用
ps aux | grep boss_eye | grep -v grep
```

### 備份策略
```bash
# 日誌輪轉（每天）
0 0 * * * mv logs/boss_eye.log logs/boss_eye.log.$(date +\%Y\%m\%d)

# 報告備份（每周）
0 0 * * 0 tar -czf reports_backup_$(date +\%Y\%m\%d).tar.gz reports/*.json reports/*.txt

# 配置備份（每月）
0 0 1 * * cp -r config/ backup/config_$(date +\%Y\%m)/
```

## 🚨 故障排除

### 常見問題 1：數據庫連接失敗
```
❌ BG666 數據庫連接失敗: (2003, "Can't connect to MySQL server")
```
**解決方案：**
1. 檢查 ZeroTier 連接：`zerotier-cli listnetworks`
2. 驗證網絡連接：`ping bg666-market-readonly.czsks2mguhd5.ap-south-1.rds.amazonaws.com`
3. 檢查防火牆：`telnet bg666-market-readonly.czsks2mguhd5.ap-south-1.rds.amazonaws.com 3306`
4. 驗證憑證：檢查 `.env` 文件中的密碼

### 常見問題 2：Matomo API 錯誤
```
❌ Matomo API 請求失敗: HTTP 403
```
**解決方案：**
1. 驗證 API token：登錄 Matomo → 設置 → API
2. 檢查權限：token 需要有 `view` 權限
3. 驗證 URL：確保 Matomo URL 正確
4. 檢查站點 ID：確認 `MATOMO_SITE_ID` 正確

### 常見問題 3：Telegram 發送失敗
```
⚠️ Telegram 配置不完整，跳過發送
```
**解決方案：**
1. 驗證 Bot token：通過 @BotFather 檢查
2. 檢查頻道 ID：確保 Bot 已加入頻道
3. 驗證權限：Bot 需要有發送消息權限
4. 測試發送：`curl "https://api.telegram.org/bot{TOKEN}/getMe"`

### 常見問題 4：Python 依賴錯誤
```
ModuleNotFoundError: No module named 'pymysql'
```
**解決方案：**
1. 激活虛擬環境：`source .venv/bin/activate`
2. 重新安裝：`pip install -r requirements.txt`
3. 檢查 Python 版本：`python3 --version`

### 常見問題 5：定時任務不執行
```
# 檢查 cron 日誌
grep CRON /var/log/syslog | tail -20
```
**解決方案：**
1. 檢查 crontab 語法：`crontab -l`
2. 檢查路徑：使用絕對路徑
3. 檢查權限：確保腳本可執行
4. 測試手動執行：`cd /path && ./boss_eye.py`

## 🔄 更新與升級

### 小版本更新
```bash
# 1. 備份當前配置
cp -r config/ config_backup_$(date +%Y%m%d)/
cp .env .env.backup

# 2. 更新代碼
git pull origin main  # 或手動複製新文件

# 3. 更新依賴
source .venv/bin/activate
pip install -r requirements.txt --upgrade

# 4. 恢復配置
cp config_backup_$(date +%Y%m%d)/* config/ 2>/dev/null || true

# 5. 測試運行
./test_run.sh
```

### 大版本升級
```bash
# 1. 停止服務
pkill -f "boss_eye.py" 2>/dev/null || true

# 2. 完整備份
tar -czf boss_eye_backup_$(date +%Y%m%d_%H%M%S).tar.gz .

# 3. 清理舊版本
mv boss_eye boss_eye_old

# 4. 部署新版本
cp -r /path/to/new/boss-eye .

# 5. 遷移配置
cp boss_eye_old/.env boss-eye/
cp -r boss_eye_old/config/* boss-eye/config/ 2>/dev/null || true

# 6. 重新安裝
cd boss-eye
./setup.sh

# 7. 啟動服務
python boss_eye.py
```

## 📈 性能優化

### 數據庫優化
```sql
-- 為風控查詢添加索引
CREATE INDEX idx_bet_time_user ON bet_logs(bet_time, user_id);
CREATE INDEX idx_amount_bet_time ON bet_logs(amount, bet_time);
CREATE INDEX idx_status_create_time ON player_recharge_order(status, create_time);
```

### 查詢優化
```python
# 使用分頁查詢
LIMIT 100 OFFSET 0

# 使用緩存
import functools
import time

@functools.lru_cache(maxsize=128)
def get_cached_data(key, ttl=300):
    # 緩存邏輯
    pass
```

### 日誌優化
```python
# 使用旋轉日誌
from logging.handlers import RotatingFileHandler

handler = RotatingFileHandler(
    'boss_eye.log', 
    maxBytes=10*1024*1024,  # 10MB
    backupCount=5
)
```

## 🔒 安全最佳實踐

### 1. 憑證管理
- 使用環境變數，不要硬編碼
- 定期輪換 API token
- 使用密鑰管理服務（如 Vault）

### 2. 訪問控制
- 最小權限原則
- 網絡隔離（ZeroTier）
- IP 白名單

### 3. 日誌安全
- 不要記錄敏感數據
- 加密存儲日誌
- 定期審計日誌

### 4. 更新策略
- 定期更新依賴
- 安全補丁及時應用
- 版本控制

## 📞 支持與維護

### 緊急聯絡
- **技術支持**：無極 (Wuji) - Telegram @DufuTheSage
- **數據庫問題**：BG666 DBA 團隊
- **網絡問題**：ZeroTier 管理員

### 維護窗口
- **常規維護**：每周日凌晨 2:00-4:00
- **緊急修復**：隨時響應
- **版本發布**：每月第一個周一

### 監控告警
- **錯誤率** > 5%：警告
- **服務中斷** > 5分鐘：緊急
- **數據延遲** > 15分鐘：警告

---

**部署完成時間**：2026-01-31  
**部署版本**：v1.0.0  
**部署環境**：Production  
**維護團隊**：無極 AI 系統工程組
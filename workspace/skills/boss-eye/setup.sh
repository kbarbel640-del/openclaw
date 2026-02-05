#!/bin/bash
# 老領班風控偵測系統 - 安裝腳本

set -e

echo "🕵️ 老領班風控偵測系統安裝腳本"
echo "========================================"

# 檢查 Python 版本
echo "🔍 檢查 Python 版本..."
python3 --version || { echo "❌ Python3 未安裝"; exit 1; }

# 創建虛擬環境
echo "🐍 創建 Python 虛擬環境..."
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    echo "✅ 虛擬環境創建完成"
else
    echo "⚠️ 虛擬環境已存在，跳過創建"
fi

# 激活虛擬環境並安裝依賴
echo "📦 安裝 Python 依賴..."
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 創建必要的目錄
echo "📁 創建系統目錄..."
mkdir -p config sql logs reports data

# 設置環境變數模板
echo "⚙️ 設置環境變數模板..."
if [ ! -f ".env.example" ]; then
    cat > .env.example << 'EOF'
# 老領班風控偵測系統 - 環境變數配置
# 複製此文件為 .env 並填入實際值

# BG666 數據庫配置
BG666_DB_HOST=bg666-market-readonly.czsks2mguhd5.ap-south-1.rds.amazonaws.com
BG666_DB_PORT=3306
BG666_DB_NAME=ry-cloud
BG666_DB_USER=readonly_user
BG666_DB_PASSWORD=your_password_here

# Matomo 配置
MATOMO_URL=https://your-matomo.com/index.php
MATOMO_TOKEN=your_matomo_token_here
MATOMO_SITE_ID=1

# Telegram Bot 配置
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_BOSS_CHANNEL=-1001234567890
TELEGRAM_DATA_TEAM=-1003337225655

# AI API 配置
AI_PROVIDER=anthropic  # anthropic | openai | deepseek
AI_MODEL=claude-3-opus-20240229
AI_API_KEY=your_api_key_here

# 系統配置
LOG_LEVEL=INFO
REPORT_RETENTION_DAYS=30
CRON_SCHEDULE="*/15 * * * *"
EOF
    echo "✅ 環境變數模板創建完成"
else
    echo "⚠️ 環境變數模板已存在"
fi

# 檢查是否需要創建 .env 文件
if [ ! -f ".env" ]; then
    echo "⚠️ 請創建 .env 文件並配置實際值："
    echo "   cp .env.example .env"
    echo "   nano .env"
fi

# 設置文件權限
echo "🔒 設置文件權限..."
chmod +x boss_eye.py
chmod +x test_run.sh
chmod +x setup.sh

# 創建測試運行腳本
echo "🧪 創建測試運行腳本..."
cat > test_run.sh << 'EOF'
#!/bin/bash
# 測試運行腳本

set -e

echo "🧪 老領班風控偵測系統 - 測試運行"
echo "========================================"

# 激活虛擬環境
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# 檢查依賴
echo "🔍 檢查 Python 依賴..."
python3 -c "import pymysql, requests, yaml" || {
    echo "❌ 缺少依賴，請先運行 setup.sh"
    exit 1
}

# 運行測試
echo "🚀 啟動測試運行..."
python3 boss_eye.py --test || {
    echo "❌ 測試運行失敗"
    exit 1
}

echo "✅ 測試運行完成！"
echo ""
echo "📋 下一步："
echo "1. 編輯 .env 文件配置實際數據庫連接"
echo "2. 運行 ./boss_eye.py 進行完整測試"
echo "3. 設置定時任務：crontab -e"
echo "4. 查看日誌：tail -f logs/boss_eye_*.log"
EOF

chmod +x test_run.sh

# 創建定時任務配置
echo "⏰ 創建定時任務配置..."
cat > cron_setup.md << 'EOF'
# 定時任務設置指南

## 1. 編輯 crontab
```bash
crontab -e
```

## 2. 添加定時任務
每15分鐘執行一次：
```bash
*/15 * * * * cd /home/node/clawd/skills/boss-eye && /home/node/clawd/skills/boss-eye/.venv/bin/python boss_eye.py >> /home/node/clawd/skills/boss-eye/logs/cron.log 2>&1
```

每天凌晨2點清理舊日誌：
```bash
0 2 * * * find /home/node/clawd/skills/boss-eye/logs -name "*.log" -mtime +7 -delete
```

## 3. 檢查定時任務
```bash
crontab -l
```

## 4. 查看執行日誌
```bash
tail -f /home/node/clawd/skills/boss-eye/logs/cron.log
```
EOF

# 創建依賴文件
echo "📝 創建 requirements.txt..."
cat > requirements.txt << 'EOF'
# 老領班風控偵測系統 - Python 依賴

# 數據庫連接
pymysql>=1.1.0

# HTTP 請求
requests>=2.31.0

# 配置管理
PyYAML>=6.0

# 日誌處理
# (Python 內置)

# 日期時間處理
# (Python 內置)

# JSON 處理
# (Python 內置)

# 可選：Telegram Bot
# python-telegram-bot>=20.0

# 可選：AI API 客戶端
# openai>=1.0.0
# anthropic>=0.8.0

# 開發依賴
pytest>=7.4.0
black>=23.0.0
flake8>=6.0.0
EOF

echo ""
echo "🎉 安裝完成！"
echo ""
echo "📋 下一步操作："
echo "1. 配置環境變數："
echo "   cp .env.example .env"
echo "   nano .env"
echo ""
echo "2. 測試運行："
echo "   ./test_run.sh"
echo ""
echo "3. 完整運行："
echo "   ./boss_eye.py"
echo ""
echo "4. 設置定時任務："
echo "   查看 cron_setup.md"
echo ""
echo "5. 查看日誌："
echo "   tail -f logs/boss_eye_*.log"
echo ""
echo "💡 提示："
echo "- 確保 ZeroTier 已連接 BG666 網絡"
echo "- 確保 Matomo API token 有正確權限"
echo "- Telegram Bot 需要添加到相應頻道"
echo ""
echo "🕵️ 老領班準備上線！"
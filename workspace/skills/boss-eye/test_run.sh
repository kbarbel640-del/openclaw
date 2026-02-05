#!/bin/bash
# 老領班風控偵測系統 - 測試運行腳本

set -e

echo "🧪 老領班風控偵測系統 - 測試運行"
echo "========================================"
echo ""

# 檢查當前目錄
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📁 工作目錄: $(pwd)"
echo ""

# 檢查虛擬環境
if [ -d ".venv" ]; then
    echo "🐍 激活 Python 虛擬環境..."
    source .venv/bin/activate
    echo "✅ 虛擬環境已激活"
else
    echo "⚠️ 虛擬環境不存在，使用系統 Python"
    echo "   建議先運行: ./setup.sh"
fi

# 檢查 Python 依賴
echo ""
echo "🔍 檢查 Python 依賴..."
python3 -c "
try:
    import pymysql
    print('✅ pymysql:', pymysql.__version__)
except ImportError:
    print('❌ pymysql: 未安裝')

try:
    import requests
    print('✅ requests:', requests.__version__)
except ImportError:
    print('❌ requests: 未安裝')

try:
    import yaml
    print('✅ PyYAML: 已安裝')
except ImportError:
    print('❌ PyYAML: 未安裝')
"

echo ""
echo "📋 檢查配置文件..."
if [ -f ".env" ]; then
    echo "✅ .env 文件存在"
    # 檢查關鍵配置
    if grep -q "BG666_DB_PASSWORD=your_password_here" .env; then
        echo "⚠️  BG666_DB_PASSWORD 還是默認值"
    fi
    if grep -q "TELEGRAM_BOT_TOKEN=your_bot_token_here" .env; then
        echo "⚠️  TELEGRAM_BOT_TOKEN 還是默認值"
    fi
else
    echo "❌ .env 文件不存在"
    echo "   請運行: cp .env.example .env"
    echo "   然後編輯 .env 文件配置實際值"
    exit 1
fi

if [ -f "config/database.yaml" ]; then
    echo "✅ config/database.yaml 存在"
else
    echo "⚠️  config/database.yaml 不存在，使用默認配置"
fi

echo ""
echo "📁 檢查目錄結構..."
for dir in logs reports data; do
    if [ -d "$dir" ]; then
        echo "✅ $dir/ 目錄存在"
    else
        echo "📁 創建 $dir/ 目錄..."
        mkdir -p "$dir"
    fi
done

echo ""
echo "🚀 啟動測試運行..."
echo "----------------------------------------"

# 運行測試模式
python3 boss_eye.py --test 2>&1 | tee logs/test_run_$(date +%Y%m%d_%H%M%S).log

TEST_EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo "----------------------------------------"

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "🎉 測試運行成功！"
    echo ""
    echo "📊 生成的報告："
    ls -la reports/*.txt 2>/dev/null | head -5 || echo "   暫無報告文件"
    
    echo ""
    echo "📋 日誌文件："
    ls -la logs/*.log 2>/dev/null | head -5 || echo "   暫無日誌文件"
    
    echo ""
    echo "✅ 系統準備就緒！"
    echo ""
    echo "💡 下一步操作："
    echo "1. 完整運行： ./boss_eye.py"
    echo "2. 設置定時任務：查看 cron_setup.md"
    echo "3. 監控日誌： tail -f logs/boss_eye_*.log"
    echo ""
    echo "🕵️ 老領班準備上線！"
else
    echo "❌ 測試運行失敗 (退出碼: $TEST_EXIT_CODE)"
    echo ""
    echo "🔧 問題排查："
    echo "1. 檢查依賴： ./setup.sh"
    echo "2. 檢查配置： nano .env"
    echo "3. 查看日誌： tail -n 50 logs/*.log"
    echo "4. 手動測試： python3 -c \"import pymysql; print('OK')\""
    echo ""
    exit $TEST_EXIT_CODE
fi
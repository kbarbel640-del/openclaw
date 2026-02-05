#!/bin/bash
# 檢查 Telegram HTTP Bridge 狀態

cd "$(dirname "$0")"

echo "📊 Telegram HTTP Bridge 狀態"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 檢查 PID
if [ -f .bridge.pid ]; then
    PID=$(cat .bridge.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "✅ 進程運行中 (PID: $PID)"
    else
        echo "❌ PID 檔案存在但進程不存在"
    fi
else
    if pgrep -f "http_bridge.py" > /dev/null; then
        echo "✅ 進程運行中 (PID: $(pgrep -f http_bridge.py))"
    else
        echo "❌ 未運行"
    fi
fi

# 健康檢查
echo ""
echo "🔗 API 檢查:"
HEALTH=$(curl -s http://127.0.0.1:18790/health 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ API 回應正常"
    echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
else
    echo "❌ API 無回應"
fi

#!/bin/bash
# 啟動 Telegram HTTP Bridge

cd "$(dirname "$0")"
source venv/bin/activate

# 檢查是否已在運行
if pgrep -f "http_bridge.py" > /dev/null; then
    echo "⚠️  Bridge 已在運行"
    exit 1
fi

echo "🚀 啟動 Telegram HTTP Bridge..."
nohup python scripts/http_bridge.py --port 18790 > logs/bridge.log 2>&1 &
echo $! > .bridge.pid

sleep 2

if curl -s http://127.0.0.1:18790/health > /dev/null; then
    echo "✅ Bridge 啟動成功 (PID: $(cat .bridge.pid))"
    echo "📡 API: http://127.0.0.1:18790"
else
    echo "❌ 啟動失敗，查看 logs/bridge.log"
fi

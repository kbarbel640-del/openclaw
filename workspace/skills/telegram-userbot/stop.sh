#!/bin/bash
# 停止 Telegram HTTP Bridge

cd "$(dirname "$0")"

if [ -f .bridge.pid ]; then
    PID=$(cat .bridge.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "🛑 停止 Bridge (PID: $PID)..."
        kill $PID
        rm .bridge.pid
        echo "✅ 已停止"
    else
        echo "⚠️  PID $PID 不存在"
        rm .bridge.pid
    fi
else
    # 嘗試用 pkill
    if pgrep -f "http_bridge.py" > /dev/null; then
        pkill -f "http_bridge.py"
        echo "✅ 已停止 (via pkill)"
    else
        echo "ℹ️  Bridge 未運行"
    fi
fi

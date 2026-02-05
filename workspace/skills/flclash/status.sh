#!/bin/bash
# FLClash 狀態截圖

osascript -e 'tell application "FlClash" to activate'
sleep 0.3

peekaboo window set-bounds --app FlClash --x 400 --y 300 --width 1112 --height 400 2>/dev/null || true
sleep 0.2

peekaboo image --app FlClash --path /tmp/flclash-status.png 2>/dev/null

echo "📸 /tmp/flclash-status.png"

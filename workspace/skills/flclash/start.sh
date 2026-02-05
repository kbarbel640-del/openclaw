#!/bin/bash
# FLClash 啟動腳本

set -e

echo "🌐 啟動 FLClash..."

# 1. 激活 FLClash 並移到主螢幕
osascript -e 'tell application "FlClash" to activate'
sleep 0.5

# 移動到主螢幕固定位置
peekaboo window set-bounds --app FlClash --x 400 --y 300 --width 1112 --height 400 2>/dev/null || true
sleep 0.3

# 2. 開啟系統代理（點擊開關）
echo "  → 開啟系統代理..."
peekaboo click --app FlClash --coords 1200,427 2>/dev/null
sleep 0.3

# 按 ESC 關閉可能彈出的面板
peekaboo press escape --app FlClash 2>/dev/null || true
sleep 0.3

# 3. 選擇規則模式
echo "  → 切換到規則模式..."
peekaboo click --app FlClash --coords 1050,535 2>/dev/null
sleep 0.3

# 4. 點擊播放按鈕啟動
echo "  → 啟動代理..."
peekaboo click --app FlClash --coords 1475,680 2>/dev/null
sleep 0.5

# 5. 截圖確認
peekaboo image --app FlClash --path /tmp/flclash-status.png 2>/dev/null

echo "✅ FLClash 已啟動！"
echo "📸 狀態截圖: /tmp/flclash-status.png"

#!/bin/bash
# FLClash 停止腳本

set -e

echo "🛑 停止 FLClash..."

# 激活 FLClash
osascript -e 'tell application "FlClash" to activate'
sleep 0.5

# 移動到主螢幕固定位置
peekaboo window set-bounds --app FlClash --x 400 --y 300 --width 1112 --height 400 2>/dev/null || true
sleep 0.3

# 點擊暫停按鈕（同位置，切換狀態）
echo "  → 停止代理..."
peekaboo click --app FlClash --coords 1475,680 2>/dev/null
sleep 0.3

# 關閉系統代理
echo "  → 關閉系統代理..."
peekaboo click --app FlClash --coords 1200,427 2>/dev/null
sleep 0.3

# 按 ESC 關閉可能彈出的面板
peekaboo press escape --app FlClash 2>/dev/null || true

echo "✅ FLClash 已停止！"

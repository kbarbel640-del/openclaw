#!/bin/bash
# tmux-monitor.sh - 監控 tmux 並發送變化到 Telegram Log Bot

LOG_BOT_TOKEN="8415477831:AAFeyWZS8iAPqrQxYG_e3CxDWR2IrgIxw68"
CHAT_ID="${LOG_CHAT_ID:-8090790323}"  # 預設發給杜甫
TMUX_TARGET="${TMUX_TARGET:-0:0.0}"
INTERVAL="${INTERVAL:-5}"  # 每 5 秒檢查一次
LAST_CONTENT_FILE="/tmp/tmux-monitor-last.txt"

send_telegram() {
    local message="$1"
    curl -s -X POST "https://api.telegram.org/bot${LOG_BOT_TOKEN}/sendMessage" \
        -d chat_id="$CHAT_ID" \
        -d text="$message" \
        -d parse_mode="HTML" > /dev/null
}

echo "🔍 Starting tmux monitor..."
echo "   Target: $TMUX_TARGET"
echo "   Interval: ${INTERVAL}s"
echo "   Log Bot: Telegram"

# 初始化
touch "$LAST_CONTENT_FILE"
send_telegram "🟢 <b>tmux 監控啟動</b>
Target: <code>$TMUX_TARGET</code>
Interval: ${INTERVAL}s"

while true; do
    # 抓取當前內容（最後 30 行）
    CURRENT=$(tmux capture-pane -p -t "$TMUX_TARGET" -S -30 2>/dev/null)
    
    if [ $? -ne 0 ]; then
        echo "⚠️ tmux session not found, waiting..."
        sleep "$INTERVAL"
        continue
    fi
    
    # 讀取上次內容
    LAST=$(cat "$LAST_CONTENT_FILE" 2>/dev/null)
    
    # 比較
    if [ "$CURRENT" != "$LAST" ]; then
        # 有變化！
        echo "📝 Change detected at $(date '+%H:%M:%S')"
        
        # 取最後 15 行作為摘要
        SUMMARY=$(echo "$CURRENT" | tail -15)
        
        # 發送到 Telegram
        send_telegram "📋 <b>tmux 更新</b> $(date '+%H:%M:%S')
<pre>$(echo "$SUMMARY" | head -c 3000)</pre>"
        
        # 保存當前內容
        echo "$CURRENT" > "$LAST_CONTENT_FILE"
    fi
    
    sleep "$INTERVAL"
done

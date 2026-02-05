#!/bin/bash
# Log Mirror - 監控 gateway log 並轉發訊息到 Telegram

LOG_BOT_TOKEN="8415477831:AAFeyWZS8iAPqrQxYG_e3CxDWR2IrgIxw68"
LOG_GROUP_ID="-5266835049"
GATEWAY_LOG="$HOME/.clawdbot/logs/gateway.log"

send_log() {
    local msg="$1"
    # Escape special characters for Telegram
    msg=$(echo "$msg" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g')
    curl -s -X POST "https://api.telegram.org/bot${LOG_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${LOG_GROUP_ID}" \
        -d "text=${msg}" \
        -d "parse_mode=HTML" > /dev/null 2>&1
}

echo "🔍 Log Mirror 啟動..."
echo "監控: $GATEWAY_LOG"
echo "目標: Clawdbot Log 群組"
echo "---"

# Tail the log and filter for message events
tail -F "$GATEWAY_LOG" 2>/dev/null | while read -r line; do
    # 檢測訊息相關 log (LINE/Telegram/Signal 等)
    if echo "$line" | grep -qE '\[(telegram|line|signal|whatsapp)\].*inbound|\[agent\].*user:'; then
        timestamp=$(date '+%H:%M:%S')
        echo "[$timestamp] 轉發: ${line:0:80}..."
        send_log "📨 $line"
    fi
done

#!/bin/bash
# 訊息 Logger - 將訊息轉發到 Telegram Log 群組

LOG_BOT_TOKEN="8415477831:AAFeyWZS8iAPqrQxYG_e3CxDWR2IrgIxw68"
LOG_GROUP_ID="" # 待填入 log 群組 ID

send_log() {
    local message="$1"
    curl -s -X POST "https://api.telegram.org/bot${LOG_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${LOG_GROUP_ID}" \
        -d "text=${message}" \
        -d "parse_mode=HTML" > /dev/null
}

# 使用方式：
# echo "訊息內容" | ./message-logger.sh
# 或
# ./message-logger.sh "訊息內容"

if [ -n "$1" ]; then
    send_log "$1"
else
    while read -r line; do
        send_log "$line"
    done
fi

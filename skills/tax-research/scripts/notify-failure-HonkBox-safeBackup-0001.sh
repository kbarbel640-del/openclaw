#!/usr/bin/env bash
# Notify on tax research failure
# Called by systemd OnFailure

FAILED_UNIT="${1:-unknown}"
MESSAGE="⚠️ Tax research job failed: $FAILED_UNIT at $(date)"

# Try tg-send first
if command -v tg-send &> /dev/null; then
    echo "$MESSAGE" | tg-send -
else
    # Fallback to curl
    TELEGRAM_TOKEN=$(op read "op://Private/Telegram Bot Token/credential" 2>/dev/null || echo "")
    CHAT_ID=$(op read "op://Private/Telegram Chat ID/credential" 2>/dev/null || echo "")

    if [ -n "$TELEGRAM_TOKEN" ] && [ -n "$CHAT_ID" ]; then
        curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_TOKEN/sendMessage" \
            -d "chat_id=$CHAT_ID" \
            -d "text=$MESSAGE" > /dev/null
    fi
fi

# Log to file
mkdir -p "$HOME/Shared/notes/Personal/Taxes/research-logs"
echo "$MESSAGE" >> "$HOME/Shared/notes/Personal/Taxes/research-logs/failures.log"

#!/bin/bash
# System cron wrapper for daily-weather-steve
# Schedule: 5:55 AM daily (55 5 * * *)

# Ensure gateway is running
source /Users/steve/clawd/personal-scripts/cron-wrappers/ensure-gateway.sh
ensure_gateway

SCRIPT="/Users/steve/clawd/personal-scripts/daily-weather-steve.sh"
CLAWDBOT="/Users/steve/Library/pnpm/clawdbot"

# Run the actual script
OUTPUT=$("$SCRIPT" 2>&1) || true

# Parse output for MEDIA line
MEDIA_PATH=""
TEXT_OUTPUT=""
while IFS= read -r line; do
    if [[ "$line" == MEDIA:* ]]; then
        MEDIA_PATH="${line#MEDIA:}"
    else
        TEXT_OUTPUT+="$line"$'\n'
    fi
done <<< "$OUTPUT"

# Send via agent using message tool
if [ -n "$TEXT_OUTPUT" ]; then
    if [ -n "$MEDIA_PATH" ] && [ -f "$MEDIA_PATH" ]; then
        "$CLAWDBOT" agent --agent main --message "Use the message tool to send this to Telegram chat 1191367022 via account steve. Include the image $MEDIA_PATH. Message:

$TEXT_OUTPUT" 2>&1
    else
        "$CLAWDBOT" agent --agent main --message "Use the message tool to send this to Telegram chat 1191367022 via account steve:

$TEXT_OUTPUT" 2>&1
    fi
fi

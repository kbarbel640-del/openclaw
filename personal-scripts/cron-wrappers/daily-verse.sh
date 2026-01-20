#!/bin/bash
# System cron wrapper for daily-verse
# Schedule: 6:05 AM daily (5 6 * * *)

# Ensure gateway is running
source /Users/steve/clawd/personal-scripts/cron-wrappers/ensure-gateway.sh
ensure_gateway

CLAWDBOT="/Users/steve/Library/pnpm/clawdbot"

# Run the verse script
OUTPUT=$(python3 /Users/steve/clawd/skills/bible/votd.py --download /tmp/votd.jpg 2>&1) || true

# Send via agent using message tool
if [ -n "$OUTPUT" ]; then
    if [ -f /tmp/votd.jpg ]; then
        "$CLAWDBOT" agent --agent main --message "Use the message tool to send this to Telegram chat 1191367022 via account steve. Include the image /tmp/votd.jpg. Message:

$OUTPUT" 2>&1
    else
        "$CLAWDBOT" agent --agent main --message "Use the message tool to send this to Telegram chat 1191367022 via account steve:

$OUTPUT" 2>&1
    fi
fi

#!/bin/bash
# System cron wrapper for archive-media
# Schedule: every 2 hours (0 */2 * * *)

# Ensure gateway is running
source /Users/steve/clawd/personal-scripts/cron-wrappers/ensure-gateway.sh
ensure_gateway

SCRIPT="/Users/steve/clawd/personal-scripts/archive-media.sh"
CLAWDBOT="/Users/steve/Library/pnpm/clawdbot"

# Run the actual script
OUTPUT=$("$SCRIPT" 2>&1) || true

# Only notify if files were archived (script outputs nothing if no files)
if [ -n "$OUTPUT" ]; then
    "$CLAWDBOT" agent --agent main --message "Use the message tool to send this to Telegram chat 1191367022 via account steve:

$OUTPUT" 2>&1
fi

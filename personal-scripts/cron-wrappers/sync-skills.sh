#!/bin/bash
# System cron wrapper for sync-skills
# Schedule: Every 4 hours (0 */4 * * *)

# Ensure gateway is running
source /Users/steve/clawd/personal-scripts/cron-wrappers/ensure-gateway.sh
ensure_gateway

SCRIPT="/Users/steve/clawd/personal-scripts/sync-skills.sh"
CLAWDBOT="/Users/steve/Library/pnpm/clawdbot"

# Run the actual script
OUTPUT=$("$SCRIPT" 2>&1) || true

# Send via agent using message tool
if [ -n "$OUTPUT" ]; then
    "$CLAWDBOT" agent --agent main --message "Use the message tool to send this to Telegram chat 1191367022 via account steve:

$OUTPUT" 2>&1
else
    "$CLAWDBOT" agent --agent main --message "Use the message tool to send this to Telegram chat 1191367022 via account steve:

✅ sync-skills completed (no output)" 2>&1
fi

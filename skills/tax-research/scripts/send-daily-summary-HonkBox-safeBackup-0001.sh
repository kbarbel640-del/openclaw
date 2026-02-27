#!/usr/bin/env bash
# Tax Research Daily Summary
# Sends summary via Telegram at 8pm daily

set -euo pipefail

TAXES_DIR="$HOME/OneDrive/Taxes"
TRACKER="$TAXES_DIR/Tax Savings Tracker.md"
RUNS_LOG="$TAXES_DIR/research-logs/runs.md"
SKILL_IMPROVEMENTS="$TAXES_DIR/research-logs/skill-improvements.md"
DOCS_NEEDED="$TAXES_DIR/documents-needed.md"

# Get current totals (Potential | Verified)
TOTALS=$(grep -A1 "TOTAL" "$TRACKER" 2>/dev/null | tail -1 || echo "Unknown")
POTENTIAL=$(echo "$TOTALS" | awk -F'|' '{print $3}' | tr -d ' ')
VERIFIED=$(echo "$TOTALS" | awk -F'|' '{print $4}' | tr -d ' ')
POTENTIAL="${POTENTIAL:-$0}"
VERIFIED="${VERIFIED:-$0}"

# Get today's runs
TODAY=$(date +%Y-%m-%d)
TODAY_RUNS=$(grep -c "^## $TODAY" "$RUNS_LOG" 2>/dev/null || echo "0")

# Get recent activity (last 5 entries)
RECENT=$(tail -30 "$RUNS_LOG" 2>/dev/null | grep -A3 "^## " | head -20 || echo "No recent activity")

# Get latest skill improvement suggestion
LATEST_IMPROVEMENT=$(tail -15 "$SKILL_IMPROVEMENTS" 2>/dev/null | grep -A1 "Suggested improvement" | tail -1 || echo "None yet")

# Get documents needed (if file exists)
if [ -f "$DOCS_NEEDED" ]; then
    DOCS_REQUEST=$(grep -A20 "## High Priority" "$DOCS_NEEDED" 2>/dev/null | head -15 || tail -20 "$DOCS_NEEDED" | head -15)
else
    DOCS_REQUEST="No document requests yet"
fi

# Build message
MESSAGE="*Tax Research Daily Summary*

*Savings:*
- Potential: $POTENTIAL
- Verified: $VERIFIED

*Runs Today:* $TODAY_RUNS

*Recent Activity:*
\`\`\`
$RECENT
\`\`\`

*Documents I Need From You:*
$DOCS_REQUEST

*Latest Skill Improvement Suggestion:*
$LATEST_IMPROVEMENT

_Next research run: 6am_"

# Send via Telegram using tg-send
if command -v tg-send &> /dev/null; then
    echo "$MESSAGE" | tg-send -
else
    # Fallback: try curl to Telegram API
    TELEGRAM_TOKEN=$(op read "op://Private/Telegram Bot Token/credential" 2>/dev/null || echo "")
    CHAT_ID=$(op read "op://Private/Telegram Chat ID/credential" 2>/dev/null || echo "")

    if [ -n "$TELEGRAM_TOKEN" ] && [ -n "$CHAT_ID" ]; then
        curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_TOKEN/sendMessage" \
            -d "chat_id=$CHAT_ID" \
            -d "text=$MESSAGE" \
            -d "parse_mode=Markdown" > /dev/null
    else
        echo "No Telegram credentials available"
        echo "$MESSAGE"
    fi
fi

echo "Summary sent at $(date)"

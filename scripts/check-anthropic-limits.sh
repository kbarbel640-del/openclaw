#!/bin/bash
# Check Anthropic API rate limits and usage
# Usage: ./check-anthropic-limits.sh [--json]

set -e

# Load API key from .env if not already set
if [ -z "$ANTHROPIC_API_KEY" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [ -f "$SCRIPT_DIR/../.env" ]; then
    export $(grep -E '^ANTHROPIC_API_KEY=' "$SCRIPT_DIR/../.env" | xargs)
  elif [ -f "$HOME/.env" ]; then
    export $(grep -E '^ANTHROPIC_API_KEY=' "$HOME/.env" | xargs)
  fi
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "Error: ANTHROPIC_API_KEY not found" >&2
  exit 1
fi

# Make minimal API call to get rate limit headers
RESPONSE=$(curl -s -D - https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":1,"messages":[{"role":"user","content":"x"}]}' \
  2>/dev/null)

# Extract headers
HTTP_STATUS=$(echo "$RESPONSE" | grep -E "^HTTP" | tail -1 | awk '{print $2}')
REQ_LIMIT=$(echo "$RESPONSE" | grep -i "anthropic-ratelimit-requests-limit" | cut -d: -f2 | tr -d ' \r')
REQ_REMAINING=$(echo "$RESPONSE" | grep -i "anthropic-ratelimit-requests-remaining" | cut -d: -f2 | tr -d ' \r')
INPUT_LIMIT=$(echo "$RESPONSE" | grep -i "anthropic-ratelimit-input-tokens-limit" | cut -d: -f2 | tr -d ' \r')
INPUT_REMAINING=$(echo "$RESPONSE" | grep -i "anthropic-ratelimit-input-tokens-remaining" | cut -d: -f2 | tr -d ' \r')
OUTPUT_LIMIT=$(echo "$RESPONSE" | grep -i "anthropic-ratelimit-output-tokens-limit" | cut -d: -f2 | tr -d ' \r')
OUTPUT_REMAINING=$(echo "$RESPONSE" | grep -i "anthropic-ratelimit-output-tokens-remaining" | cut -d: -f2 | tr -d ' \r')
TOTAL_LIMIT=$(echo "$RESPONSE" | grep -i "anthropic-ratelimit-tokens-limit" | cut -d: -f2 | tr -d ' \r')
TOTAL_REMAINING=$(echo "$RESPONSE" | grep -i "anthropic-ratelimit-tokens-remaining" | cut -d: -f2 | tr -d ' \r')

if [ "$1" == "--json" ]; then
  cat <<EOF
{
  "status": "$HTTP_STATUS",
  "rate_limits": {
    "requests": {"limit": $REQ_LIMIT, "remaining": $REQ_REMAINING, "used": $((REQ_LIMIT - REQ_REMAINING))},
    "input_tokens": {"limit": $INPUT_LIMIT, "remaining": $INPUT_REMAINING, "used": $((INPUT_LIMIT - INPUT_REMAINING))},
    "output_tokens": {"limit": $OUTPUT_LIMIT, "remaining": $OUTPUT_REMAINING, "used": $((OUTPUT_LIMIT - OUTPUT_REMAINING))},
    "total_tokens": {"limit": $TOTAL_LIMIT, "remaining": $TOTAL_REMAINING, "used": $((TOTAL_LIMIT - TOTAL_REMAINING))}
  },
  "note": "Rate limits reset every minute. Spend limits must be checked at https://console.anthropic.com/settings/limits"
}
EOF
else
  echo "Anthropic API Rate Limits (per minute)"
  echo "======================================="
  echo ""
  printf "%-15s %12s %12s %12s\n" "Type" "Limit" "Remaining" "Used"
  printf "%-15s %12s %12s %12s\n" "----" "-----" "---------" "----"
  printf "%-15s %'12d %'12d %'12d\n" "Requests" "$REQ_LIMIT" "$REQ_REMAINING" "$((REQ_LIMIT - REQ_REMAINING))"
  printf "%-15s %'12d %'12d %'12d\n" "Input tokens" "$INPUT_LIMIT" "$INPUT_REMAINING" "$((INPUT_LIMIT - INPUT_REMAINING))"
  printf "%-15s %'12d %'12d %'12d\n" "Output tokens" "$OUTPUT_LIMIT" "$OUTPUT_REMAINING" "$((OUTPUT_LIMIT - OUTPUT_REMAINING))"
  printf "%-15s %'12d %'12d %'12d\n" "Total tokens" "$TOTAL_LIMIT" "$TOTAL_REMAINING" "$((TOTAL_LIMIT - TOTAL_REMAINING))"
  echo ""
  echo "Note: These are per-minute rate limits, not spend limits."
  echo "Check spend/billing at: https://console.anthropic.com/settings/limits"
fi

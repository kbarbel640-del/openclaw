#!/bin/bash
# Resolve LINE user profile by groupId + userId
# Usage: resolve_profile.sh <groupId> <userId> <botToken>
# Returns JSON with displayName, userId, pictureUrl

GROUP_ID="$1"
USER_ID="$2"
BOT_TOKEN="$3"

if [ -z "$GROUP_ID" ] || [ -z "$USER_ID" ] || [ -z "$BOT_TOKEN" ]; then
  echo '{"error": "Usage: resolve_profile.sh <groupId> <userId> <botToken>"}'
  exit 1
fi

# Try group member profile first
RESULT=$(curl -s -H "Authorization: Bearer $BOT_TOKEN" \
  "https://api.line.me/v2/bot/group/$GROUP_ID/member/$USER_ID")

# If group API fails, try direct profile
if echo "$RESULT" | grep -q '"message"'; then
  RESULT=$(curl -s -H "Authorization: Bearer $BOT_TOKEN" \
    "https://api.line.me/v2/bot/profile/$USER_ID")
fi

echo "$RESULT"

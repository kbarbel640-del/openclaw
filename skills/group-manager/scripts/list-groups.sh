#!/usr/bin/env bash
# list-groups.sh — List groups for a specific agent or all agents
#
# Usage:
#   list-groups.sh [--agent-id karl-brett] [--config PATH] [--account ACCOUNT_ID] [--bb-url URL] [--bb-password PASS]
#
# If --agent-id is provided, shows only groups bound to that agent.
# Otherwise shows all bound groups.
set -euo pipefail

AGENT_ID=""
CONFIG_PATH="${CONFIG_PATH:-$HOME/.openclaw/openclaw.json}"
ACCOUNT_ID="${ACCOUNT_ID:-karl}"
BB_URL="${BB_URL:-http://100.120.154.29:1235}"
BB_PASSWORD="${BB_PASSWORD:-${BLUEBUBBLES_KARL_PASSWORD:-}}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent-id) AGENT_ID="$2"; shift 2 ;;
    --config) CONFIG_PATH="$2"; shift 2 ;;
    --account) ACCOUNT_ID="$2"; shift 2 ;;
    --bb-url) BB_URL="$2"; shift 2 ;;
    --bb-password) BB_PASSWORD="$2"; shift 2 ;;
    *) echo "{\"error\":\"Unknown arg: $1\"}" >&2; exit 1 ;;
  esac
done

# Get bound groups from config
if [[ -n "$AGENT_ID" ]]; then
  BINDINGS=$(jq --arg acct "$ACCOUNT_ID" --arg agent "$AGENT_ID" '[
    .bindings // [] | .[] |
    select(.match.channel == "bluebubbles" and .match.accountId == $acct and .match.peer.kind == "group" and .agentId == $agent) |
    {agentId, guid: .match.peer.id}
  ]' "$CONFIG_PATH")
else
  BINDINGS=$(jq --arg acct "$ACCOUNT_ID" '[
    .bindings // [] | .[] |
    select(.match.channel == "bluebubbles" and .match.accountId == $acct and .match.peer.kind == "group") |
    {agentId, guid: .match.peer.id}
  ]' "$CONFIG_PATH")
fi

# Enrich with BlueBubbles data (display name, participants)
BB_GROUPS=$(curl -s -m 30 -X POST "${BB_URL}/api/v1/chat/query?password=${BB_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{"limit":200,"offset":0,"with":["participants"],"sort":"lastmessage"}' 2>/dev/null)

if echo "$BB_GROUPS" | jq -e '.data' >/dev/null 2>&1; then
  BB_DATA=$(echo "$BB_GROUPS" | jq '[.data[] | select(.style == 43) | {
    guid,
    displayName,
    chatIdentifier,
    participants: [.participants[].address],
    memberCount: (.participants | length)
  }]')
else
  BB_DATA="[]"
fi

jq -n \
  --argjson bindings "$BINDINGS" \
  --argjson bb "$BB_DATA" \
  '
  # Build lookup: guid -> bb info
  ($bb | map({key: .guid, value: .}) | from_entries) as $bb_map |
  {
    groups: [
      $bindings[] |
      . as $binding |
      ($bb_map[$binding.guid] // null) as $info |
      {
        agentId: $binding.agentId,
        guid: $binding.guid,
        displayName: ($info.displayName // "(unknown)"),
        chatIdentifier: ($info.chatIdentifier // null),
        participants: ($info.participants // []),
        memberCount: ($info.memberCount // 0)
      }
    ],
    count: ($bindings | length)
  }
  '

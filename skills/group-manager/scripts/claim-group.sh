#!/usr/bin/env bash
# claim-group.sh — Claim or unclaim a group for a specific agent
#
# Usage:
#   claim-group.sh --claim --agent-id karl-brett --group-identifier <chatIdentifier|guid> [--config PATH] [--account ACCOUNT_ID]
#   claim-group.sh --unclaim --group-identifier <chatIdentifier|guid> [--config PATH] [--account ACCOUNT_ID]
#
# Output: JSON with the patch to apply (or error).
set -euo pipefail

ACTION=""
AGENT_ID=""
GROUP_ID=""
CONFIG_PATH="${CONFIG_PATH:-$HOME/.openclaw/openclaw.json}"
ACCOUNT_ID="${ACCOUNT_ID:-karl}"
BB_URL="${BB_URL:-http://100.120.154.29:1235}"
BB_PASSWORD="${BB_PASSWORD:-${BLUEBUBBLES_KARL_PASSWORD:-}}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --claim) ACTION="claim"; shift ;;
    --unclaim) ACTION="unclaim"; shift ;;
    --agent-id) AGENT_ID="$2"; shift 2 ;;
    --group-identifier) GROUP_ID="$2"; shift 2 ;;
    --config) CONFIG_PATH="$2"; shift 2 ;;
    --account) ACCOUNT_ID="$2"; shift 2 ;;
    --bb-url) BB_URL="$2"; shift 2 ;;
    --bb-password) BB_PASSWORD="$2"; shift 2 ;;
    *) echo "{\"error\":\"Unknown arg: $1\"}" >&2; exit 1 ;;
  esac
done

if [[ -z "$ACTION" ]]; then
  echo '{"error":"Must specify --claim or --unclaim"}' >&2
  exit 1
fi
if [[ -z "$GROUP_ID" ]]; then
  echo '{"error":"Must specify --group-identifier"}' >&2
  exit 1
fi
if [[ "$ACTION" == "claim" && -z "$AGENT_ID" ]]; then
  echo '{"error":"Must specify --agent-id for claim"}' >&2
  exit 1
fi

# Resolve group GUID from identifier
# The group-identifier could be a chatIdentifier, full guid, or partial match
resolve_guid() {
  local search="$1"

  # If it already looks like a full guid (has semicolons), use it
  if [[ "$search" == *";"* ]]; then
    echo "$search"
    return
  fi

  # Query BlueBubbles to find the group
  local groups
  groups=$(curl -s -m 30 -X POST "${BB_URL}/api/v1/chat/query?password=${BB_PASSWORD}" \
    -H "Content-Type: application/json" \
    -d '{"limit":200,"offset":0,"with":["participants"],"sort":"lastmessage"}')

  if [[ -z "$groups" ]] || ! echo "$groups" | jq -e '.data' >/dev/null 2>&1; then
    echo ""
    return
  fi

  # Search by chatIdentifier, displayName (case-insensitive), or partial guid match
  local match
  match=$(echo "$groups" | jq -r --arg search "$search" '
    [.data[] | select(.style == 43)] |
    (
      # Exact chatIdentifier match
      [.[] | select(.chatIdentifier == $search)] //
      # Case-insensitive displayName match
      [.[] | select(.displayName != "" and (.displayName | ascii_downcase) == ($search | ascii_downcase))] //
      # Partial guid match
      [.[] | select(.guid | contains($search))] //
      []
    ) |
    if length == 1 then .[0].guid
    elif length > 1 then "AMBIGUOUS:" + (length | tostring)
    else ""
    end
  ')

  echo "$match"
}

FULL_GUID=$(resolve_guid "$GROUP_ID")

if [[ -z "$FULL_GUID" ]]; then
  echo "{\"error\":\"Group not found: $GROUP_ID\"}" >&2
  exit 1
fi
if [[ "$FULL_GUID" == AMBIGUOUS:* ]]; then
  COUNT="${FULL_GUID#AMBIGUOUS:}"
  echo "{\"error\":\"Ambiguous match: $COUNT groups match '$GROUP_ID'. Be more specific.\"}" >&2
  exit 1
fi

CURRENT_BINDINGS=$(jq '.bindings // []' "$CONFIG_PATH")

if [[ "$ACTION" == "claim" ]]; then
  # Check if already bound
  EXISTING=$(echo "$CURRENT_BINDINGS" | jq --arg guid "$FULL_GUID" --arg acct "$ACCOUNT_ID" '
    [.[] | select(
      .match.channel == "bluebubbles" and
      .match.accountId == $acct and
      .match.peer.kind == "group" and
      .match.peer.id == $guid
    )]
  ')
  if [[ $(echo "$EXISTING" | jq 'length') -gt 0 ]]; then
    EXISTING_AGENT=$(echo "$EXISTING" | jq -r '.[0].agentId')
    echo "{\"error\":\"Group already bound to $EXISTING_AGENT. Use --unclaim first.\"}" >&2
    exit 1
  fi

  # Build new binding
  NEW_BINDING=$(jq -n --arg agent "$AGENT_ID" --arg acct "$ACCOUNT_ID" --arg guid "$FULL_GUID" '{
    agentId: $agent,
    match: {
      channel: "bluebubbles",
      accountId: $acct,
      peer: {
        kind: "group",
        id: $guid
      }
    }
  }')

  # Get group members to add to allowlist
  GROUP_MEMBERS=$(curl -s -m 30 -X POST "${BB_URL}/api/v1/chat/query?password=${BB_PASSWORD}" \
    -H "Content-Type: application/json" \
    -d '{"limit":200,"offset":0,"with":["participants"]}' | \
    jq --arg guid "$FULL_GUID" '[.data[] | select(.guid == $guid) | .participants[].address] | unique')

  CURRENT_ALLOW=$(jq --arg acct "$ACCOUNT_ID" '
    .channels.bluebubbles.accounts[$acct].groupAllowFrom // []
  ' "$CONFIG_PATH")

  MERGED_ALLOW=$(jq -n --argjson current "$CURRENT_ALLOW" --argjson new "$GROUP_MEMBERS" \
    '($current + $new) | unique | sort')

  MERGED_BINDINGS=$(echo "$CURRENT_BINDINGS" | jq --argjson new "[$NEW_BINDING]" '. + $new')

  PATCH=$(jq -n \
    --argjson bindings "$MERGED_BINDINGS" \
    --argjson allow "$MERGED_ALLOW" \
    --arg acct "$ACCOUNT_ID" \
    '{
      bindings: $bindings,
      channels: {
        bluebubbles: {
          accounts: {
            ($acct): {
              groupAllowFrom: $allow
            }
          }
        }
      }
    }')

  # Get group display name
  GROUP_NAME=$(curl -s -m 30 -X POST "${BB_URL}/api/v1/chat/query?password=${BB_PASSWORD}" \
    -H "Content-Type: application/json" \
    -d '{"limit":200,"offset":0}' | \
    jq -r --arg guid "$FULL_GUID" '.data[] | select(.guid == $guid) | .displayName // "(unnamed)"')

  jq -n \
    --arg action "claimed" \
    --arg agent "$AGENT_ID" \
    --arg guid "$FULL_GUID" \
    --arg name "$GROUP_NAME" \
    --argjson members "$GROUP_MEMBERS" \
    --argjson patch "$PATCH" \
    '{
      action: $action,
      message: "Group \($name) claimed by \($agent).",
      group: {guid: $guid, displayName: $name, members: $members},
      patch: $patch
    }'

elif [[ "$ACTION" == "unclaim" ]]; then
  # Remove binding for this group
  REMOVED=$(echo "$CURRENT_BINDINGS" | jq --arg guid "$FULL_GUID" --arg acct "$ACCOUNT_ID" '
    [.[] | select(
      .match.channel == "bluebubbles" and
      .match.accountId == $acct and
      .match.peer.kind == "group" and
      .match.peer.id == $guid
    )]
  ')
  if [[ $(echo "$REMOVED" | jq 'length') -eq 0 ]]; then
    echo "{\"error\":\"Group not currently bound: $FULL_GUID\"}" >&2
    exit 1
  fi

  REMOVED_AGENT=$(echo "$REMOVED" | jq -r '.[0].agentId')
  FILTERED_BINDINGS=$(echo "$CURRENT_BINDINGS" | jq --arg guid "$FULL_GUID" --arg acct "$ACCOUNT_ID" '
    [.[] | select(
      (.match.channel == "bluebubbles" and .match.accountId == $acct and .match.peer.kind == "group" and .match.peer.id == $guid) | not
    )]
  ')

  PATCH=$(jq -n --argjson bindings "$FILTERED_BINDINGS" '{bindings: $bindings}')

  jq -n \
    --arg action "unclaimed" \
    --arg agent "$REMOVED_AGENT" \
    --arg guid "$FULL_GUID" \
    --argjson patch "$PATCH" \
    '{
      action: $action,
      message: "Group unbound from \($agent).",
      group: {guid: $guid},
      previousAgent: $agent,
      patch: $patch
    }'
fi

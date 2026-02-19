#!/usr/bin/env bash
# scan-groups.sh — Detect unbound BlueBubbles groups and recommend auto-bindings
#
# Usage: scan-groups.sh [--bb-url URL] [--bb-password PASS] [--config PATH] [--account ACCOUNT_ID]
#
# Output: JSON array of unbound groups with member analysis and recommendations.
# Exit codes: 0 = success, 1 = error
set -euo pipefail

BB_URL="${BB_URL:-http://100.120.154.29:1235}"
BB_PASSWORD="${BB_PASSWORD:-${BLUEBUBBLES_KARL_PASSWORD:-}}"
CONFIG_PATH="${CONFIG_PATH:-$HOME/.openclaw/openclaw.json}"
ACCOUNT_ID="${ACCOUNT_ID:-karl}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bb-url) BB_URL="$2"; shift 2 ;;
    --bb-password) BB_PASSWORD="$2"; shift 2 ;;
    --config) CONFIG_PATH="$2"; shift 2 ;;
    --account) ACCOUNT_ID="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$BB_PASSWORD" ]]; then
  echo '{"error":"BlueBubbles password not set. Set BB_PASSWORD or BLUEBUBBLES_KARL_PASSWORD."}' >&2
  exit 1
fi

if [[ ! -f "$CONFIG_PATH" ]]; then
  echo "{\"error\":\"Config file not found: $CONFIG_PATH\"}" >&2
  exit 1
fi

# Step 1: Get all group chats with participants from BlueBubbles
GROUPS_JSON=$(curl -s -m 30 -X POST "${BB_URL}/api/v1/chat/query?password=${BB_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{"limit":200,"offset":0,"with":["participants"],"sort":"lastmessage"}')

if [[ -z "$GROUPS_JSON" ]] || ! echo "$GROUPS_JSON" | jq -e '.data' >/dev/null 2>&1; then
  echo '{"error":"Failed to query BlueBubbles groups API"}' >&2
  exit 1
fi

# Extract only group chats (style 43 = group)
BB_GROUPS=$(echo "$GROUPS_JSON" | jq '[.data[] | select(.style == 43) | {
  guid,
  displayName,
  chatIdentifier,
  participants: [.participants[].address]
}]')

# Step 2: Get current bindings from config
# Peer group bindings for this account
EXISTING_GROUP_BINDINGS=$(jq --arg acct "$ACCOUNT_ID" '[
  .bindings // [] | .[] |
  select(.match.channel == "bluebubbles" and .match.accountId == $acct and .match.peer.kind == "group") |
  {agentId, groupId: .match.peer.id}
]' "$CONFIG_PATH")

# Peer DM bindings for this account (these are "customers")
DM_BINDINGS=$(jq --arg acct "$ACCOUNT_ID" '[
  .bindings // [] | .[] |
  select(.match.channel == "bluebubbles" and .match.accountId == $acct and .match.peer.kind == "direct") |
  {agentId, peerId: .match.peer.id}
]' "$CONFIG_PATH")

# Step 3: Build set of already-bound group GUIDs
BOUND_GUIDS=$(echo "$EXISTING_GROUP_BINDINGS" | jq -r '.[].groupId')

# Step 4: Analyze each group
jq -n \
  --argjson bb_groups "$BB_GROUPS" \
  --argjson existing "$EXISTING_GROUP_BINDINGS" \
  --argjson dm_bindings "$DM_BINDINGS" \
  '
  # Build lookup: peerId -> agentId
  ($dm_bindings | map({key: .peerId, value: .agentId}) | from_entries) as $customer_map |
  # Build set of bound group GUIDs
  ($existing | map(.groupId) | sort | unique) as $bound_guids |
  # Get all customer phone numbers/emails
  ($dm_bindings | map(.peerId)) as $customer_ids |

  [
    $bb_groups[] |
    . as $group |

    # Check if this group is already bound
    ($bound_guids | index($group.guid)) as $is_bound |
    if $is_bound != null then
      # Already bound — include in output with status
      ($existing[] | select(.groupId == $group.guid)) as $binding |
      {
        guid: $group.guid,
        displayName: $group.displayName,
        chatIdentifier: $group.chatIdentifier,
        participants: $group.participants,
        status: "bound",
        boundTo: $binding.agentId,
        matchingCustomers: []
      }
    else
      # Unbound — check for customer members
      [
        $group.participants[] |
        . as $member |
        $customer_map[$member] // null |
        if . != null then
          {member: $member, agentId: .}
        else
          empty
        end
      ] as $matches |

      {
        guid: $group.guid,
        displayName: $group.displayName,
        chatIdentifier: $group.chatIdentifier,
        participants: $group.participants,
        status: (
          if ($matches | length) == 0 then "unbound-no-customers"
          elif ($matches | length) == 1 then "auto-bindable"
          else "conflict"
          end
        ),
        boundTo: null,
        matchingCustomers: $matches
      }
    end
  ] |
  {
    summary: {
      total: length,
      bound: [.[] | select(.status == "bound")] | length,
      autoBindable: [.[] | select(.status == "auto-bindable")] | length,
      conflict: [.[] | select(.status == "conflict")] | length,
      noCustomers: [.[] | select(.status == "unbound-no-customers")] | length
    },
    groups: .
  }
  '

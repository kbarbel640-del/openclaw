#!/usr/bin/env bash
# auto-bind.sh — Auto-bind unambiguous groups and output the config patch
#
# Usage: auto-bind.sh [--dry-run] [--bb-url URL] [--bb-password PASS] [--config PATH] [--account ACCOUNT_ID]
#
# Outputs a JSON config patch for gateway config.patch, or dry-run report.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DRY_RUN=false
BB_URL="${BB_URL:-http://100.120.154.29:1235}"
BB_PASSWORD="${BB_PASSWORD:-${BLUEBUBBLES_KARL_PASSWORD:-}}"
CONFIG_PATH="${CONFIG_PATH:-$HOME/.openclaw/openclaw.json}"
ACCOUNT_ID="${ACCOUNT_ID:-karl}"
EXCLUDE_AGENTS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --bb-url) BB_URL="$2"; shift 2 ;;
    --bb-password) BB_PASSWORD="$2"; shift 2 ;;
    --config) CONFIG_PATH="$2"; shift 2 ;;
    --account) ACCOUNT_ID="$2"; shift 2 ;;
    --exclude-agent) EXCLUDE_AGENTS+=("$2"); shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# Build jq exclude filter from EXCLUDE_AGENTS array
EXCLUDE_JSON="[]"
if [[ ${#EXCLUDE_AGENTS[@]} -gt 0 ]]; then
  EXCLUDE_JSON=$(printf '%s\n' "${EXCLUDE_AGENTS[@]}" | jq -R . | jq -s .)
fi

# Run scan
SCAN=$(BB_URL="$BB_URL" BB_PASSWORD="$BB_PASSWORD" CONFIG_PATH="$CONFIG_PATH" ACCOUNT_ID="$ACCOUNT_ID" \
  "$SCRIPT_DIR/scan-groups.sh" 2>/dev/null)

# Get auto-bindable groups, filtering out excluded agents
AUTO_BINDABLE=$(echo "$SCAN" | jq --argjson exclude "$EXCLUDE_JSON" '[
  .groups[] |
  select(.status == "auto-bindable") |
  select(.matchingCustomers[0].agentId as $aid | ($exclude | index($aid)) == null)
]')
# Conflicts also filtered — if all matching customers are excluded, demote to no-customers
CONFLICTS=$(echo "$SCAN" | jq --argjson exclude "$EXCLUDE_JSON" '[
  .groups[] |
  select(.status == "conflict") |
  .matchingCustomers = [.matchingCustomers[] | select((.agentId as $aid | ($exclude | index($aid)) == null))] |
  select(.matchingCustomers | length > 1)
]')

COUNT=$(echo "$AUTO_BINDABLE" | jq 'length')
CONFLICT_COUNT=$(echo "$CONFLICTS" | jq 'length')

if [[ "$COUNT" -eq 0 && "$CONFLICT_COUNT" -eq 0 ]]; then
  echo '{"action":"none","message":"No unbound groups need attention.","bindings_added":[],"conflicts":[]}'
  exit 0
fi

# Build new bindings for auto-bindable groups
NEW_BINDINGS=$(echo "$AUTO_BINDABLE" | jq --arg acct "$ACCOUNT_ID" '[
  .[] |
  {
    agentId: .matchingCustomers[0].agentId,
    match: {
      channel: "bluebubbles",
      accountId: $acct,
      peer: {
        kind: "group",
        id: .guid
      }
    }
  }
]')

# Build list of new group members to add to groupAllowFrom
# For each auto-bindable group, collect all participant phone numbers
NEW_ALLOW_ENTRIES=$(echo "$AUTO_BINDABLE" | jq '[
  .[].participants[] |
  select(startswith("+"))
] | unique')

# Get current bindings and groupAllowFrom
CURRENT_BINDINGS=$(jq '.bindings // []' "$CONFIG_PATH")
CURRENT_ALLOW=$(jq --arg acct "$ACCOUNT_ID" '
  .channels.bluebubbles.accounts[$acct].groupAllowFrom // []
' "$CONFIG_PATH")

# Merge new bindings (insert before catch-alls so specific routes match first)
MERGED_BINDINGS=$(jq -n \
  --argjson current "$CURRENT_BINDINGS" \
  --argjson new "$NEW_BINDINGS" \
  '# Split current into specific (has .match.peer) and catch-all (no .match.peer)
   [$current[] | select(.match.peer != null)] +
   $new +
   [$current[] | select(.match.peer == null)]')

# Merge groupAllowFrom (union)
MERGED_ALLOW=$(jq -n \
  --argjson current "$CURRENT_ALLOW" \
  --argjson new "$NEW_ALLOW_ENTRIES" \
  '($current + $new) | unique | sort')

# Build conflict notifications
CONFLICT_REPORT=$(echo "$CONFLICTS" | jq '[
  .[] | {
    guid,
    displayName,
    chatIdentifier,
    participants,
    matchingCustomers
  }
]')

# Build the config patch
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

# Build summary of what was bound
BOUND_SUMMARY=$(echo "$AUTO_BINDABLE" | jq '[
  .[] | {
    guid,
    displayName: (if .displayName == "" then "(unnamed)" else .displayName end),
    chatIdentifier,
    boundTo: .matchingCustomers[0].agentId,
    customer: .matchingCustomers[0].member,
    memberCount: (.participants | length)
  }
]')

if [[ "$DRY_RUN" == "true" ]]; then
  jq -n \
    --argjson bound "$BOUND_SUMMARY" \
    --argjson conflicts "$CONFLICT_REPORT" \
    --argjson patch "$PATCH" \
    '{
      action: "dry-run",
      message: "Would auto-bind \($bound | length) group(s). \($conflicts | length) conflict(s) detected.",
      bindings_to_add: $bound,
      conflicts: $conflicts,
      patch_preview: $patch
    }'
else
  jq -n \
    --argjson bound "$BOUND_SUMMARY" \
    --argjson conflicts "$CONFLICT_REPORT" \
    --argjson patch "$PATCH" \
    '{
      action: "apply",
      message: "Auto-bound \($bound | length) group(s). \($conflicts | length) conflict(s) need manual resolution.",
      bindings_added: $bound,
      conflicts: $conflicts,
      patch: $patch
    }'
fi

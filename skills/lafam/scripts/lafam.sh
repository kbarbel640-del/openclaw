#!/usr/bin/env bash
# lafam.sh — LaFam/Mishpuha platform API dispatcher
# Usage: lafam.sh <action> [args...]
# Run:   lafam.sh help   →  prints all available actions

set -euo pipefail

# ─── CONFIG ───────────────────────────────────────────────────────────────────
# Use LOCAL_MODE=1 for localhost testing: LOCAL_MODE=1 bash lafam.sh ...
BASE_URL="${LAFAM_BASE_URL:-https://events-api-tq4b.onrender.com}"
[[ "${LOCAL_MODE:-0}" == "1" ]] && BASE_URL="http://localhost:3001"
CRED_EMAIL="flopi_bot@lafam.world"
CRED_PASS="bot@442"

# Token cache lives next to this script (survives re-runs)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN_FILE="$SCRIPT_DIR/.lafam_token.json"
# TOKEN_FILE JSON: { "accessToken": "...", "refreshToken": "...", "expiresAt": <epoch> }

# ─── COLOUR / PRETTY ──────────────────────────────────────────────────────────
pretty() { python3 -m json.tool 2>/dev/null || cat; }

# ─── AUTH HELPERS ─────────────────────────────────────────────────────────────
_now_epoch() { date +%s; }

_load_token() {
  # Returns 0 and sets ACCESS_TOKEN if valid cached token exists
  if [[ -f "$TOKEN_FILE" ]]; then
    ACCESS_TOKEN=$(python3 -c "import json;d=json.load(open('$TOKEN_FILE'));print(d.get('accessToken',''))")
    REFRESH_TOKEN=$(python3 -c "import json;d=json.load(open('$TOKEN_FILE'));print(d.get('refreshToken',''))")
    EXPIRES_AT=$(python3 -c "import json;d=json.load(open('$TOKEN_FILE'));print(d.get('expiresAt',0))")
    if [[ "$ACCESS_TOKEN" != "" ]] && (( $(_now_epoch) < EXPIRES_AT )); then
      return 0
    fi
  fi
  return 1
}

_save_token() {
  # $1=accessToken  $2=refreshToken  $3=expiresAt
  python3 -c "
import json
json.dump({'accessToken':'$1','refreshToken':'$2','expiresAt':$3}, open('$TOKEN_FILE','w'))
"
}

_login() {
  local resp
  resp=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$CRED_EMAIL\",\"password\":\"$CRED_PASS\"}")
  local code body
  code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  if [[ "$code" != "200" ]]; then
    echo "AUTH ERROR ($code): $body" >&2
    exit 1
  fi
  ACCESS_TOKEN=$(echo "$body" | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")
  REFRESH_TOKEN=$(echo "$body" | python3 -c "import sys,json;print(json.load(sys.stdin).get('refreshToken',''))")
  # Assume token valid for 23 hours (safe margin under typical 24h)
  _save_token "$ACCESS_TOKEN" "$REFRESH_TOKEN" $(( $(_now_epoch) + 82800 ))
}

_refresh() {
  if [[ -z "${REFRESH_TOKEN:-}" ]]; then
    _login; return
  fi
  local resp code body
  resp=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/refresh" \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")
  code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  if [[ "$code" != "200" ]]; then
    # Refresh failed — fall back to full login
    _login; return
  fi
  ACCESS_TOKEN=$(echo "$body" | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")
  REFRESH_TOKEN=$(echo "$body" | python3 -c "import sys,json;print(json.load(sys.stdin).get('refreshToken','$REFRESH_TOKEN'))")
  _save_token "$ACCESS_TOKEN" "$REFRESH_TOKEN" $(( $(_now_epoch) + 82800 ))
}

ensure_token() {
  if _load_token; then
    return 0
  fi
  # Try refresh if we have a stale token with a refresh token
  if [[ -f "$TOKEN_FILE" ]]; then
    REFRESH_TOKEN=$(python3 -c "import json;d=json.load(open('$TOKEN_FILE'));print(d.get('refreshToken',''))" 2>/dev/null || echo "")
    if [[ -n "$REFRESH_TOKEN" ]]; then
      _refresh; return
    fi
  fi
  _login
}

# ─── HTTP HELPERS ─────────────────────────────────────────────────────────────
# All helpers retry once on 401 (auto re-login)

_get() {
  # $1 = path (with query string if needed)
  ensure_token
  local resp code body
  resp=$(curl -s -w "\n%{http_code}" "$BASE_URL$1" \
    -H "Authorization: Bearer $ACCESS_TOKEN")
  code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  if [[ "$code" == "401" ]]; then
    _login
    resp=$(curl -s -w "\n%{http_code}" "$BASE_URL$1" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    code=$(echo "$resp" | tail -1)
    body=$(echo "$resp" | sed '$d')
  fi
  echo "$body" | pretty
}

_get_public() {
  # No auth — for health, public event lookups, etc.
  curl -s "$BASE_URL$1" | pretty
}

_post() {
  # $1 = path  $2 = JSON body
  ensure_token
  local resp code body
  resp=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$1" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$2")
  code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  if [[ "$code" == "401" ]]; then
    _login
    resp=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$1" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$2")
    code=$(echo "$resp" | tail -1)
    body=$(echo "$resp" | sed '$d')
  fi
  echo "$body" | pretty
}

_put() {
  # $1 = path  $2 = JSON body
  ensure_token
  local resp code body
  resp=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL$1" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$2")
  code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  if [[ "$code" == "401" ]]; then
    _login
    resp=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL$1" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$2")
    code=$(echo "$resp" | tail -1)
    body=$(echo "$resp" | sed '$d')
  fi
  echo "$body" | pretty
}

_patch() {
  # $1 = path  $2 = JSON body
  ensure_token
  local resp code body
  resp=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL$1" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$2")
  code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  if [[ "$code" == "401" ]]; then
    _login
    resp=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL$1" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$2")
    code=$(echo "$resp" | tail -1)
    body=$(echo "$resp" | sed '$d')
  fi
  echo "$body" | pretty
}

_delete() {
  # $1 = path
  ensure_token
  local resp code body
  resp=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL$1" \
    -H "Authorization: Bearer $ACCESS_TOKEN")
  code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  if [[ "$code" == "401" ]]; then
    _login
    resp=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL$1" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    code=$(echo "$resp" | tail -1)
    body=$(echo "$resp" | sed '$d')
  fi
  echo "$body" | pretty
}

_get_with_header() {
  # $1 = path  $2 = extra header (e.g. "X-Session-ID: abc")
  ensure_token
  local resp code body
  resp=$(curl -s -w "\n%{http_code}" "$BASE_URL$1" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "$2")
  code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  if [[ "$code" == "401" ]]; then
    _login
    resp=$(curl -s -w "\n%{http_code}" "$BASE_URL$1" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "$2")
    code=$(echo "$resp" | tail -1)
    body=$(echo "$resp" | sed '$d')
  fi
  echo "$body" | pretty
}

_upload_image() {
  # $1 = local file path
  ensure_token
  local resp code body
  resp=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/upload/image" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -F "file=@$1")
  code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  if [[ "$code" == "401" ]]; then
    _login
    resp=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/upload/image" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -F "file=@$1")
    code=$(echo "$resp" | tail -1)
    body=$(echo "$resp" | sed '$d')
  fi
  echo "$body" | pretty
}

# ─── ACTION DISPATCHER ────────────────────────────────────────────────────────
ACTION="${1:-help}"
shift || true

case "$ACTION" in

# ── HEALTH ──────────────────────────────────────────────────────────────────
  health)
    _get_public "/health"
    ;;

# ── AUTH ────────────────────────────────────────────────────────────────────
  login)
    _login
    echo "{\"status\":\"logged in\"}" | pretty
    ;;
  refresh)
    ensure_token
    _refresh
    echo "{\"status\":\"token refreshed\"}" | pretty
    ;;

# ── EVENTS ──────────────────────────────────────────────────────────────────
  events:list)
    # Optional: --query Q --tags t1,t2 --page N --limit N --startDate ISO
    QS=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --query)   QS+="&query=$2";    shift 2 ;;
        --tags)    QS+="&tags=$2";     shift 2 ;;
        --page)    QS+="&page=$2";     shift 2 ;;
        --limit)   QS+="&limit=$2";    shift 2 ;;
        --startDate) QS+="&startDate=$2"; shift 2 ;;
        *) shift ;;
      esac
    done
    _get "/events?${QS#&}"
    ;;
  events:get)
    # $1 = eventId
    _get "/events/$1"
    ;;
  events:get-by-slug)
    # $1 = slug
    _get "/events/slug/$1"
    ;;
  events:create)
    # $1 = JSON body
    _post "/events" "$1"
    ;;
  events:update)
    # $1 = eventId  $2 = JSON body
    _put "/events/$1" "$2"
    ;;
  events:delete)
    # $1 = eventId
    _delete "/events/$1"
    ;;
  events:stats)
    # $1 = eventId  --timeframe (optional)
    EID="$1"; shift
    TF=""
    [[ "${1:-}" == "--timeframe" ]] && TF="?timeframe=$2"
    _get "/events/$EID/statistics$TF"
    ;;
  events:tickets)
    # $1 = eventId  then optional --page --limit --query --ticketType --status
    EID="$1"; shift
    QS=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --page)       QS+="&page=$2";       shift 2 ;;
        --limit)      QS+="&limit=$2";      shift 2 ;;
        --query)      QS+="&query=$2";      shift 2 ;;
        --ticketType) QS+="&ticketType=$2"; shift 2 ;;
        --status)     QS+="&status=$2";     shift 2 ;;
        *) shift ;;
      esac
    done
    _get "/events/$EID/tickets?${QS#&}"
    ;;
  events:purchase-tickets)
    # $1 = JSON { eventId, ticketHolders: [{ticketTypeId, holderName, holderEmail, holderPhone, ...}], paymentMethod: "CARDCOM"|"CASH" }
    # NOTE: Use holderName, holderEmail, holderPhone (not name, email, phone)
    _post "/events/purchase-tickets" "$1"
    ;;

# ── TICKET TYPES ────────────────────────────────────────────────────────────
  tickets:list)
    # $1 = eventId
    _get "/events/$1/ticket-types"
    ;;
  tickets:create)
    # $1 = eventId  $2 = JSON body
    _post "/events/$1/ticket-types" "$2"
    ;;
  tickets:update)
    # $1 = eventId  $2 = ticketTypeId  $3 = JSON body
    _put "/events/$1/ticket-types/$2" "$3"
    ;;
  tickets:delete)
    # $1 = eventId  $2 = ticketTypeId
    _delete "/events/$1/ticket-types/$2"
    ;;

# ── EVENT AGENTS ────────────────────────────────────────────────────────────
  events:agents)
    # $1 = eventId
    _get "/events/$1/agents"
    ;;
  events:add-agent)
    # $1 = eventId  $2 = JSON { email, commission }
    _post "/events/$1/agents" "$2"
    ;;
  events:update-agent)
    # $1 = eventId  $2 = agentId  $3 = JSON body
    _put "/events/$1/agents/$2" "$3"
    ;;
  events:remove-agent)
    # $1 = eventId  $2 = agentId
    _delete "/events/$1/agents/$2"
    ;;
  events:check-agent)
    # $1 = eventId
    _get "/events/$1/check-agent"
    ;;
  events:user-role)
    # $1 = eventId
    _get "/events/$1/user-role"
    ;;

# ── ARTISTS ─────────────────────────────────────────────────────────────────
  artists:list)
    # Optional: --page N --limit N
    QS=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --page)  QS+="&page=$2";  shift 2 ;;
        --limit) QS+="&limit=$2"; shift 2 ;;
        *) shift ;;
      esac
    done
    _get "/api/artists?${QS#&}"
    ;;
  artists:search)
    # $1 = search query
    _get "/api/artists/search?search=$1"
    ;;
  artists:get)
    # $1 = artistId
    _get "/api/artists/$1"
    ;;
  artists:get-by-slug)
    # $1 = slug
    _get "/api/artist/$1"
    ;;
  artists:create)
    # $1 = JSON body
    _post "/api/artists" "$1"
    ;;
  artists:update)
    # $1 = artistId  $2 = JSON body
    _patch "/api/artists/$1" "$2"
    ;;
  artists:delete)
    # $1 = artistId
    _delete "/api/artists/$1"
    ;;
  artists:add-social)
    # $1 = artistId  $2 = JSON { platform, url }
    _post "/api/artists/$1/social-links" "$2"
    ;;
  artists:add-socials-bulk)
    # $1 = artistId  $2 = JSON array [{ platform, url }, ...]
    _post "/api/artists/$1/social-links/bulk" "$2"
    ;;
  artists:playable-media)
    _get "/api/artists/media/playable"
    ;;
  artists:usage)
    # $1 = artistId
    _get "/api/artists/$1/usage-by-communities"
    ;;
  artists:bookings)
    # $1 = artistId
    _get "/api/artists/$1/bookings"
    ;;

# ── LOCATIONS ───────────────────────────────────────────────────────────────
  locations:list)
    QS=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --page)  QS+="&page=$2";  shift 2 ;;
        --limit) QS+="&limit=$2"; shift 2 ;;
        *) shift ;;
      esac
    done
    _get "/api/locations?${QS#&}"
    ;;
  locations:search)
    # $1 = search query
    _get "/api/locations/search?search=$1"
    ;;
  locations:get)
    # $1 = locationId
    _get "/api/locations/$1"
    ;;
  locations:get-by-slug)
    # $1 = slug
    _get "/api/location/$1"
    ;;
  locations:create)
    # $1 = JSON body
    _post "/api/locations" "$1"
    ;;
  locations:update)
    # $1 = locationId  $2 = JSON body
    _patch "/api/locations/$1" "$2"
    ;;
  locations:delete)
    # $1 = locationId
    _delete "/api/locations/$1"
    ;;
  locations:add-social)
    # $1 = locationId  $2 = JSON { platform, url }
    _post "/api/locations/$1/social-links" "$2"
    ;;
  locations:add-socials-bulk)
    # $1 = locationId  $2 = JSON array
    _post "/api/locations/$1/social-links/bulk" "$2"
    ;;
  locations:usage)
    # $1 = locationId
    _get "/api/locations/$1/usage-by-communities"
    ;;

# ── SERVICES ────────────────────────────────────────────────────────────────
  services:list)
    QS=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --page)  QS+="&page=$2";  shift 2 ;;
        --limit) QS+="&limit=$2"; shift 2 ;;
        *) shift ;;
      esac
    done
    _get "/api/services?${QS#&}"
    ;;
  services:search)
    # $1 = search query
    _get "/api/services/search?search=$1"
    ;;
  services:get)
    # $1 = serviceId
    _get "/api/services/$1"
    ;;
  services:get-by-slug)
    # $1 = slug
    _get "/api/service/$1"
    ;;
  services:create)
    # $1 = JSON body
    _post "/api/services" "$1"
    ;;
  services:update)
    # $1 = serviceId  $2 = JSON body
    _patch "/api/services/$1" "$2"
    ;;
  services:delete)
    # $1 = serviceId
    _delete "/api/services/$1"
    ;;
  services:add-social)
    # $1 = serviceId  $2 = JSON { platform, url }
    _post "/api/services/$1/social-links" "$2"
    ;;
  services:add-socials-bulk)
    # $1 = serviceId  $2 = JSON array
    _post "/api/services/$1/social-links/bulk" "$2"
    ;;

# ── COMMUNITIES ─────────────────────────────────────────────────────────────
  communities:list)
    QS=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --limit)  QS+="&limit=$2";  shift 2 ;;
        --offset) QS+="&offset=$2"; shift 2 ;;
        *) shift ;;
      esac
    done
    _get "/api/communities?${QS#&}"
    ;;
  communities:get)
    # $1 = communityId
    _get "/api/communities/$1"
    ;;
  communities:get-by-slug)
    # $1 = slug
    _get "/api/community/$1"
    ;;
  communities:create)
    # $1 = JSON body
    _post "/api/communities" "$1"
    ;;
  communities:update)
    # $1 = communityId  $2 = JSON body
    _patch "/api/communities/$1" "$2"
    ;;
  communities:delete)
    # $1 = communityId
    _delete "/api/communities/$1"
    ;;
  communities:events)
    # $1 = communityId
    _get "/api/communities/$1/events"
    ;;
  communities:members)
    # $1 = communityId
    _get "/api/communities/$1/members"
    ;;
  communities:join)
    # $1 = communityId  $2 = optional JSON { message }  (default: {})
    _post "/api/communities/$1/join-requests" "${2:-{}}"
    ;;
  communities:join-requests)
    # $1 = communityId
    _get "/api/communities/$1/join-requests/pending"
    ;;
  communities:join-approve)
    # $1 = requestId  $2 = APPROVED|REJECTED
    _patch "/api/join-requests/$1" "{\"status\":\"$2\"}"
    ;;
  communities:related-artists)
    # $1 = communityId
    _get "/api/communities/$1/related-artists"
    ;;
  communities:related-locations)
    # $1 = communityId
    _get "/api/communities/$1/related-locations"
    ;;
  communities:related-services)
    # $1 = communityId
    _get "/api/communities/$1/related-services"
    ;;
  communities:playable-media)
    # $1 = communityId  — surfaces YOUTUBE + SOUNDCLOUD links
    _get "/api/communities/$1/playable-media"
    ;;
  communities:feed)
    _get "/api/communities/feed"
    ;;
  communities:agents)
    # $1 = communityId
    _get "/api/communities/$1/agents"
    ;;
  communities:add-agent)
    # $1 = communityId  $2 = JSON { email, role? }
    _post "/api/communities/$1/agents" "$2"
    ;;

# ── POSTS & COMMENTS ────────────────────────────────────────────────────────
  posts:list)
    QS=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --limit)  QS+="&limit=$2";  shift 2 ;;
        --offset) QS+="&offset=$2"; shift 2 ;;
        *) shift ;;
      esac
    done
    _get "/api/posts?${QS#&}"
    ;;
  posts:get)
    # $1 = postId
    _get "/api/posts/$1"
    ;;
  posts:create)
    # $1 = JSON body
    _post "/api/posts" "$1"
    ;;
  posts:update)
    # $1 = postId  $2 = JSON body
    _put "/api/posts/$1" "$2"
    ;;
  posts:delete)
    # $1 = postId
    _delete "/api/posts/$1"
    ;;
  posts:search)
    # $1 = query string
    _get "/api/posts/search?q=$1"
    ;;
  posts:for-entity)
    # $1 = entityType (artist|location|service|community)  $2 = entityId
    _get "/api/posts/entity/$1/$2"
    ;;
  posts:comments)
    # $1 = postId  optional --page N --limit N
    PID="$1"; shift
    QS=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --page)  QS+="&page=$2";  shift 2 ;;
        --limit) QS+="&limit=$2"; shift 2 ;;
        *) shift ;;
      esac
    done
    _get "/api/posts/$PID/comments?${QS#&}"
    ;;
  posts:comment)
    # $1 = postId  $2 = JSON { content, imageUrls?, parentCommentId? }
    _post "/api/posts/$1/comments" "$2"
    ;;
  posts:comment-delete)
    # $1 = commentId
    _delete "/api/comments/$1"
    ;;

# ── INTERACTIONS ────────────────────────────────────────────────────────────
  interactions:like-post)
    # $1 = postId
    _post "/api/interactions/posts/$1/like" "{}"
    ;;
  interactions:save-post)
    # $1 = postId
    _post "/api/interactions/posts/$1/save" "{}"
    ;;
  interactions:post-info)
    # $1 = postId
    _get "/api/interactions/posts/$1"
    ;;
  interactions:like-artist)
    # $1 = artistId
    _post "/api/interactions/artists/$1/like" "{}"
    ;;
  interactions:follow-artist)
    # $1 = artistId
    _post "/api/interactions/artists/$1/follow" "{}"
    ;;
  interactions:artist-followers)
    # $1 = artistId
    _get "/api/interactions/artists/$1/followers"
    ;;
  interactions:mine)
    # $1 = type (like|save|follow)
    _get "/api/interactions/user?type=$1"
    ;;
  interactions:check)
    # $1 = JSON { postIds[], artistIds[] }
    _post "/api/interactions/check" "$1"
    ;;

# ── SOCIAL LINKS (generic) ──────────────────────────────────────────────────
  social-links:by-platform)
    # $1 = comma-separated platforms (YOUTUBE,INSTAGRAM,...)  optional --limit --offset
    PLATS="$1"; shift
    QS="platforms=$PLATS"
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --limit)  QS+="&limit=$2";  shift 2 ;;
        --offset) QS+="&offset=$2"; shift 2 ;;
        *) shift ;;
      esac
    done
    _get "/api/social-links/by-platform?$QS"
    ;;
  social-links:update)
    # $1 = linkId  $2 = JSON { url }
    _put "/api/social-links/$1" "$2"
    ;;
  social-links:delete)
    # $1 = linkId
    _delete "/api/social-links/$1"
    ;;

# ── CART ────────────────────────────────────────────────────────────────────
  cart:get)
    # $1 = sessionId (X-Session-ID header)
    _get_with_header "/api/cart" "X-Session-ID: $1"
    ;;
  cart:add)
    # $1 = cartId  $2 = JSON { ticketTypeId, quantity, entityId, entityType, postId? }
    _post "/api/cart/$1/items" "$2"
    ;;
  cart:update-item)
    # $1 = cartId  $2 = itemId  $3 = JSON { quantity }
    _put "/api/cart/$1/items/$2" "$3"
    ;;
  cart:remove-item)
    # $1 = cartId  $2 = itemId
    _delete "/api/cart/$1/items/$2"
    ;;
  cart:clear)
    # $1 = cartId
    _delete "/api/cart/$1/clear"
    ;;
  cart:summary)
    # $1 = cartId
    _get "/api/cart/$1/summary"
    ;;
  cart:checkout)
    # $1 = cartId  $2 = JSON { paymentMethod, holderName, holderEmail, holderPhone }
    _post "/api/cart/$1/checkout" "$2"
    ;;

# ── BOOKINGS ────────────────────────────────────────────────────────────────
  bookings:create)
    # $1 = JSON body
    _post "/api/bookings" "$1"
    ;;
  bookings:list)
    _get "/api/bookings"
    ;;
  bookings:get)
    # $1 = bookingId
    _get "/api/bookings/$1"
    ;;
  bookings:mine)
    # optional --startDate --endDate
    QS=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --startDate) QS+="&startDate=$2"; shift 2 ;;
        --endDate)   QS+="&endDate=$2";   shift 2 ;;
        *) shift ;;
      esac
    done
    _get "/api/users/me/bookings?${QS#&}"
    ;;
  bookings:update-status)
    # $1 = bookingId  $2 = JSON { status, reason?, notes? }
    _patch "/api/bookings/$1/status" "$2"
    ;;
  bookings:delete)
    # $1 = bookingId
    _delete "/api/bookings/$1"
    ;;

# ── TAGS & SEARCH ───────────────────────────────────────────────────────────
  search)
    # $1 = query
    _get "/api/search?q=$1"
    ;;
  tags:entities)
    # $1 = tagName
    _get "/api/tags/$1"
    ;;
  tags:popular)
    # optional --limit N
    LIMIT=""
    [[ "${1:-}" == "--limit" ]] && LIMIT="?limit=$2"
    _get "/api/tags/_popular$LIMIT"
    ;;
  tags:popular-artists)
    _get "/api/tags/_popular/artists"
    ;;
  tags:popular-events)
    _get "/api/tags/_popular/events"
    ;;

# ── PROFILE ─────────────────────────────────────────────────────────────────
  profile:get)
    _get "/api/profile"
    ;;
  profile:update)
    # $1 = JSON body
    _put "/api/profile" "$1"
    ;;
  profile:tickets)
    _get "/api/profile/tickets"
    ;;
  profile:transactions)
    _get "/api/profile/transactions"
    ;;
  profile:managed-items)
    _get "/api/profile/managed-items"
    ;;
  profile:add-social)
    # $1 = JSON { platform, url }
    _post "/api/profile/social-links" "$1"
    ;;

# ── AGENT API ──────────────────────────────────────────────────────────────
# Agent Transaction & Operations
  agent:purchase)
    # $1 = JSON { productId, quantity, user:{name,email,phone,gender,birthday}, agentCode }
    _post "/api/agent/purchase" "$1"
    ;;
  agent:transaction)
    # $1 = transactionId
    _get "/api/agent/transaction/$1"
    ;;

# Agent Products
  agent:products:search)
    # Optional: --q "query" --kind "GENERAL|VIP|..." --minPrice N --maxPrice N --eventId "..." --limit N
    QS=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --q)        QS+="&q=$2"; shift 2 ;;
        --kind)     QS+="&kind=$2"; shift 2 ;;
        --minPrice) QS+="&minPrice=$2"; shift 2 ;;
        --maxPrice) QS+="&maxPrice=$2"; shift 2 ;;
        --eventId)  QS+="&eventId=$2"; shift 2 ;;
        --limit)    QS+="&limit=$2"; shift 2 ;;
        *) shift ;;
      esac
    done
    _get "/api/agent/products/search?${QS#&}"
    ;;
  agent:products:merchandise)
    _get "/api/agent/products/merchandise"
    ;;
  agent:products:events)
    _get "/api/agent/products/events"
    ;;
  agent:products:upcoming)
    _get "/api/agent/products/upcoming"
    ;;
  agent:products:get)
    # $1 = productId
    _get "/api/agent/products/$1"
    ;;

# Agent User Operations
  agent:user:lookup)
    # One of: --email "..." --phone "..." --id "..." --q "search query"
    QS=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --email) QS+="&email=$2"; shift 2 ;;
        --phone) QS+="&phone=$2"; shift 2 ;;
        --id)    QS+="&id=$2"; shift 2 ;;
        --q)     QS+="&q=$2"; shift 2 ;;
        *) shift ;;
      esac
    done
    _get "/api/agent/user/lookup?${QS#&}"
    ;;
  agent:user:history)
    # $1 = userId
    _get "/api/agent/user/$1/history"
    ;;

# Agent Notifications
  agent:notify:sms)
    # $1 = JSON { to, message, link? }
    _post "/api/agent/notify/sms" "$1"
    ;;
  agent:notify:email)
    # $1 = JSON { to, subject, html }
    _post "/api/agent/notify/email" "$1"
    ;;

# Agent Stats
  agent:stats)
    # $1 = agentCode
    _get "/api/agent/stats/$1"
    ;;
  agent:stats:sales)
    # $1 = agentCode
    _get "/api/agent/stats/$1/sales"
    ;;
  agent:stats:top-products)
    # $1 = agentCode
    _get "/api/agent/stats/$1/top-products"
    ;;

# Agent Bookings
  agent:booking:create)
    # $1 = JSON booking body
    _post "/api/agent/booking" "$1"
    ;;
  agent:booking:get)
    # $1 = bookingId
    _get "/api/agent/booking/$1"
    ;;
  agent:booking:update-status)
    # $1 = bookingId  $2 = JSON { status }
    _patch "/api/agent/booking/$1/status" "$2"
    ;;
  agent:booking:cancel)
    # $1 = bookingId
    _delete "/api/agent/booking/$1"
    ;;
  agent:booking:list-user)
    # $1 = userId
    _get "/api/agent/user/$1/bookings"
    ;;
  agent:booking:list-event)
    # $1 = eventId
    _get "/api/agent/event/$1/bookings"
    ;;

# ── UPLOADS ─────────────────────────────────────────────────────────────────
  upload:image)
    # $1 = local file path
    _upload_image "$1"
    ;;
  upload:config)
    _get "/upload/config"
    ;;

# ── HELP ────────────────────────────────────────────────────────────────────
  help|--help|-h)
    cat <<'EOF'
lafam.sh — LaFam / Mishpuha platform API
Usage: lafam.sh <action> [args...]

AUTH
  login                          Log in and cache token
  refresh                        Refresh cached token

HEALTH
  health                         Health check (no auth)

EVENTS
  events:list [--query Q] [--tags t1,t2] [--page N] [--limit N] [--startDate ISO]
  events:get <eventId>
  events:get-by-slug <slug>
  events:create '<JSON>'
  events:update <eventId> '<JSON>'
  events:delete <eventId>
  events:stats <eventId> [--timeframe <value>]
  events:tickets <eventId> [--page N] [--limit N] [--query Q] [--ticketType T] [--status S]

TICKET TYPES
  tickets:list <eventId>
  tickets:create <eventId> '<JSON>'
  tickets:update <eventId> <ticketTypeId> '<JSON>'
  tickets:delete <eventId> <ticketTypeId>

ARTISTS
  artists:list [--page N] [--limit N]
  artists:search <query>
  artists:get <artistId>
  artists:get-by-slug <slug>
  artists:create '<JSON>'
  artists:update <artistId> '<JSON>'
  artists:delete <artistId>
  artists:add-social <artistId> '{"platform":"YOUTUBE","url":"..."}'
  artists:add-socials-bulk <artistId> '[{"platform":"...","url":"..."},...]'
  artists:playable-media                  (YOUTUBE + SOUNDCLOUD links)
  artists:usage <artistId>
  artists:bookings <artistId>

LOCATIONS
  locations:list [--page N] [--limit N]
  locations:search <query>
  locations:get <locationId>
  locations:get-by-slug <slug>
  locations:create '<JSON>'
  locations:update <locationId> '<JSON>'
  locations:delete <locationId>
  locations:add-social <locationId> '{"platform":"...","url":"..."}'
  locations:add-socials-bulk <locationId> '[...]'
  locations:usage <locationId>

SERVICES
  services:list [--page N] [--limit N]
  services:search <query>
  services:get <serviceId>
  services:get-by-slug <slug>
  services:create '<JSON>'
  services:update <serviceId> '<JSON>'
  services:delete <serviceId>
  services:add-social <serviceId> '{"platform":"...","url":"..."}'
  services:add-socials-bulk <serviceId> '[...]'

COMMUNITIES
  communities:list [--limit N] [--offset N]
  communities:get <communityId>
  communities:get-by-slug <slug>
  communities:create '<JSON>'
  communities:update <communityId> '<JSON>'
  communities:delete <communityId>
  communities:events <communityId>
  communities:members <communityId>
  communities:join <communityId> ['{"message":"..."}'']
  communities:join-requests <communityId>
  communities:join-approve <requestId> APPROVED|REJECTED
  communities:related-artists <communityId>
  communities:related-locations <communityId>
  communities:related-services <communityId>
  communities:playable-media <communityId>     (YOUTUBE + SOUNDCLOUD)
  communities:feed
  communities:agents <communityId>
  communities:add-agent <communityId> '{"email":"...","role":"..."}'

POSTS & COMMENTS
  posts:list [--limit N] [--offset N]
  posts:get <postId>
  posts:create '<JSON>'
  posts:update <postId> '<JSON>'
  posts:delete <postId>
  posts:search <query>
  posts:for-entity <entityType> <entityId>     (artist|location|service|community)
  posts:comments <postId> [--page N] [--limit N]
  posts:comment <postId> '{"content":"..."}'
  posts:comment-delete <commentId>

INTERACTIONS
  interactions:like-post <postId>
  interactions:save-post <postId>
  interactions:post-info <postId>
  interactions:like-artist <artistId>
  interactions:follow-artist <artistId>
  interactions:artist-followers <artistId>
  interactions:mine <type>                     (like|save|follow)
  interactions:check '{"postIds":[...],"artistIds":[...]}'

SOCIAL LINKS
  social-links:by-platform <PLATFORMS> [--limit N] [--offset N]
                                               (YOUTUBE,SOUNDCLOUD,INSTAGRAM,TWITTER,FACEBOOK,TIKTOK,SPOTIFY,WEBSITE)
  social-links:update <linkId> '{"url":"..."}'
  social-links:delete <linkId>

CART
  cart:get <sessionId>
  cart:add <cartId> '{"ticketTypeId":"...","quantity":1,"entityId":"...","entityType":"..."}'
  cart:update-item <cartId> <itemId> '{"quantity":2}'
  cart:remove-item <cartId> <itemId>
  cart:clear <cartId>
  cart:summary <cartId>
  cart:checkout <cartId> '{"paymentMethod":"...","holderName":"...","holderEmail":"...","holderPhone":"..."}'

BOOKINGS
  bookings:create '<JSON>'
  bookings:list
  bookings:get <bookingId>
  bookings:mine [--startDate ISO] [--endDate ISO]
  bookings:update-status <bookingId> '{"status":"...","reason":"...","notes":"..."}'
  bookings:delete <bookingId>

TAGS & SEARCH
  search <query>                 Global search
  tags:entities <tagName>
  tags:popular [--limit N]
  tags:popular-artists
  tags:popular-events

PROFILE
  profile:get
  profile:update '<JSON>'
  profile:tickets
  profile:transactions
  profile:managed-items
  profile:add-social '{"platform":"...","url":"..."}'

AGENT API — Transactions & Operations
  agent:purchase '<JSON>'                                          Create purchase (productId, quantity, user, agentCode)
  agent:transaction <transactionId>                                Get transaction status

AGENT API — Products
  agent:products:search [--q Q] [--kind K] [--minPrice N] [--maxPrice N] [--eventId ID] [--limit N]
  agent:products:merchandise                                       Get all merchandise products
  agent:products:events                                            Get all event ticket products
  agent:products:upcoming                                          Get upcoming event products
  agent:products:get <productId>                                   Get product by ID

AGENT API — Users
  agent:user:lookup --email|--phone|--id|--q <value>               Lookup user by email/phone/id or search
  agent:user:history <userId>                                      Get user purchase history

AGENT API — Notifications
  agent:notify:sms '<JSON>'                                        Send SMS { to, message, link? }
  agent:notify:email '<JSON>'                                      Send Email { to, subject, html }

AGENT API — Stats
  agent:stats <agentCode>                                          Get agent statistics
  agent:stats:sales <agentCode>                                    Get recent sales
  agent:stats:top-products <agentCode>                             Get top products

AGENT API — Bookings
  agent:booking:create '<JSON>'                                    Create booking
  agent:booking:get <bookingId>                                    Get booking details
  agent:booking:update-status <bookingId> '<JSON>'                 Update booking status
  agent:booking:cancel <bookingId>                                 Cancel booking
  agent:booking:list-user <userId>                                 List user bookings
  agent:booking:list-event <eventId>                               List event bookings

UPLOADS
  upload:image <filePath>
  upload:config
EOF
    ;;

  *)
    echo "Unknown action: $ACTION" >&2
    echo "Run: lafam.sh help" >&2
    exit 1
    ;;
esac

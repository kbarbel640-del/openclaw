#!/usr/bin/env bash
set -euo pipefail

# Publish a blog post to Ghost CMS via Admin API
# Requires: GHOST_API_URL, GHOST_ADMIN_API_KEY
# Usage: publish-ghost.sh --title "Title" --content content.md [--tags "tag1,tag2"] [--status published|draft]

TITLE=""
CONTENT_FILE=""
TAGS=""
STATUS="published"

while [[ $# -gt 0 ]]; do
  case $1 in
    --title) TITLE="$2"; shift 2 ;;
    --content) CONTENT_FILE="$2"; shift 2 ;;
    --tags) TAGS="$2"; shift 2 ;;
    --status) STATUS="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$TITLE" || -z "$CONTENT_FILE" ]]; then
  echo "Usage: publish-ghost.sh --title \"Title\" --content content.md [--tags \"tag1,tag2\"] [--status published|draft]"
  exit 1
fi

if [[ -z "${GHOST_API_URL:-}" || -z "${GHOST_ADMIN_API_KEY:-}" ]]; then
  echo "Error: GHOST_API_URL and GHOST_ADMIN_API_KEY must be set"
  exit 1
fi

# Split the Admin API key into ID and secret
KEY_ID="${GHOST_ADMIN_API_KEY%%:*}"
KEY_SECRET="${GHOST_ADMIN_API_KEY##*:}"

# Read content and convert markdown to HTML (basic)
CONTENT=$(cat "$CONTENT_FILE")

# Build tags JSON array
TAGS_JSON="[]"
if [[ -n "$TAGS" ]]; then
  TAGS_JSON=$(echo "$TAGS" | tr ',' '\n' | while read -r tag; do
    echo "{\"name\":\"$(echo "$tag" | xargs)\"}"
  done | paste -sd',' - | sed 's/^/[/;s/$/]/')
fi

# Create JWT token for Ghost Admin API (requires openssl)
NOW=$(date +%s)
HEADER=$(echo -n '{"alg":"HS256","typ":"JWT","kid":"'"$KEY_ID"'"}' | base64 -w0 | tr '+/' '-_' | tr -d '=')
PAYLOAD=$(echo -n '{"iat":'"$NOW"',"exp":'"$((NOW+300))"',"aud":"/admin/"}' | base64 -w0 | tr '+/' '-_' | tr -d '=')
SIGNATURE=$(echo -n "$HEADER.$PAYLOAD" | openssl dgst -sha256 -hmac "$(echo -n "$KEY_SECRET" | xxd -r -p)" -binary | base64 -w0 | tr '+/' '-_' | tr -d '=')
TOKEN="$HEADER.$PAYLOAD.$SIGNATURE"

# Publish via Ghost Admin API
RESPONSE=$(curl -s -X POST "${GHOST_API_URL}/ghost/api/admin/posts/" \
  -H "Authorization: Ghost $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"posts\": [{
      \"title\": \"$TITLE\",
      \"html\": \"<p>$(echo "$CONTENT" | sed 's/"/\\"/g' | tr '\n' ' ')</p>\",
      \"status\": \"$STATUS\",
      \"tags\": $TAGS_JSON
    }]
  }")

# Extract and display the post URL
URL=$(echo "$RESPONSE" | grep -o '"url":"[^"]*"' | head -1 | cut -d'"' -f4)
if [[ -n "$URL" ]]; then
  echo "Published: $URL"
else
  echo "Response: $RESPONSE"
fi

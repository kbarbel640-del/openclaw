#!/usr/bin/env bash
set -euo pipefail

# Publish a blog post to WordPress via REST API
# Requires: WP_API_URL, WP_USER, WP_APP_PASSWORD
# Usage: publish-wp.sh --title "Title" --content content.md [--status publish|draft] [--categories "cat1,cat2"]

TITLE=""
CONTENT_FILE=""
STATUS="publish"
CATEGORIES=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --title) TITLE="$2"; shift 2 ;;
    --content) CONTENT_FILE="$2"; shift 2 ;;
    --status) STATUS="$2"; shift 2 ;;
    --categories) CATEGORIES="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$TITLE" || -z "$CONTENT_FILE" ]]; then
  echo "Usage: publish-wp.sh --title \"Title\" --content content.md [--status publish|draft] [--categories \"cat1,cat2\"]"
  exit 1
fi

if [[ -z "${WP_API_URL:-}" || -z "${WP_USER:-}" || -z "${WP_APP_PASSWORD:-}" ]]; then
  echo "Error: WP_API_URL, WP_USER, and WP_APP_PASSWORD must be set"
  exit 1
fi

CONTENT=$(cat "$CONTENT_FILE")

# Build the JSON payload
PAYLOAD=$(jq -n \
  --arg title "$TITLE" \
  --arg content "$CONTENT" \
  --arg status "$STATUS" \
  '{title: $title, content: $content, status: $status}')

RESPONSE=$(curl -s -X POST "${WP_API_URL}/wp-json/wp/v2/posts" \
  -u "${WP_USER}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

LINK=$(echo "$RESPONSE" | jq -r '.link // empty')
if [[ -n "$LINK" ]]; then
  echo "Published: $LINK"
else
  echo "Response: $RESPONSE"
fi

#!/usr/bin/env bash
set -euo pipefail

# Publish a Nostr event reliably via nak.
# Date: 2026-02-10
#
# Requirements:
# - nak
# - jq
# - op (optional; used by default to load the SATMAX nsec)
#
# Common mistakes this avoids:
# - nak uses positional relay args (no --relay flag)
# - stdin is for event JSON; don't pipe secrets/content into it
# - redirects/capture can cause nak to block waiting on stdin; we always use `< /dev/null`

usage() {
  cat <<'EOF'
Usage:
  nostr-post.sh --content "text" [options]
  nostr-post.sh --content-file path.md [options]

Options:
  --relay <wss://...>         Add relay (repeatable). Default: wss://relay.primal.net
  --kind <int>                Event kind (default: 1)
  --pow <int>                 NIP-13 difficulty (default: 0)
  --tag <k=v>                 Tag to add (repeatable). Example: --tag t=bitcoin
  --sec <nsec|hex>            Secret key. If omitted, loads from 1Password item "SATMAX Nostr Identity - Max" field "nsec".
  --auth                      Enable NIP-42 auth retry (passed to nak publish step)
  --retries <n>               Retries per relay (default: 2)
  --sleep <seconds>           Sleep between retries (default: 2)
  --dry-run                   Build and print event id/nevent, but do not publish
EOF
}

CONTENT=""
CONTENT_FILE=""
KIND="1"
POW="0"
AUTH="false"
RETRIES="2"
SLEEP_SECS="2"
SEC=""
DRY_RUN="false"
RELAYS=()
TAGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --content) CONTENT="${2:-}"; shift 2 ;;
    --content-file) CONTENT_FILE="${2:-}"; shift 2 ;;
    --kind) KIND="${2:-}"; shift 2 ;;
    --pow) POW="${2:-}"; shift 2 ;;
    --relay) RELAYS+=("${2:-}"); shift 2 ;;
    --tag) TAGS+=("${2:-}"); shift 2 ;;
    --sec) SEC="${2:-}"; shift 2 ;;
    --auth) AUTH="true"; shift 1 ;;
    --retries) RETRIES="${2:-}"; shift 2 ;;
    --sleep) SLEEP_SECS="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN="true"; shift 1 ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "ERROR: unknown arg: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -n "$CONTENT_FILE" ]]; then
  if [[ ! -f "$CONTENT_FILE" ]]; then
    echo "ERROR: content file not found: $CONTENT_FILE" >&2
    exit 2
  fi
  CONTENT="$(cat "$CONTENT_FILE")"
fi

if [[ -z "$CONTENT" ]]; then
  echo "ERROR: missing --content or --content-file" >&2
  usage
  exit 2
fi

if ! command -v nak >/dev/null 2>&1; then
  echo "ERROR: nak not found on PATH" >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq not found on PATH" >&2
  exit 1
fi

if [[ ${#RELAYS[@]} -eq 0 ]]; then
  RELAYS=("wss://relay.primal.net")
fi

if [[ -z "$SEC" ]]; then
  if command -v op >/dev/null 2>&1; then
    SEC="$(op read 'op://Agents/SATMAX Nostr Identity - Max/nsec' 2>/dev/null || true)"
  fi
fi
if [[ -z "$SEC" ]]; then
  echo "ERROR: missing secret key. Pass --sec or ensure 1Password item 'SATMAX Nostr Identity - Max' has field 'nsec' and op is configured." >&2
  exit 1
fi

# Build nak args without any relay. Also, force a stable created_at for a single canonical event.
TS="$(date +%s)"
NAK_BUILD_ARGS=(--quiet --sec "$SEC" --kind "$KIND" --pow "$POW" --time "$TS" --content "$CONTENT")
for t in "${TAGS[@]}"; do
  NAK_BUILD_ARGS+=(--tag "$t")
done

EVENT_JSON="$(nak event "${NAK_BUILD_ARGS[@]}" < /dev/null)"
EVENT_ID="$(printf '%s' "$EVENT_JSON" | jq -r '.id // empty')"
if [[ -z "$EVENT_ID" || "$EVENT_ID" == "null" ]]; then
  echo "ERROR: failed to build event json (no id)" >&2
  exit 1
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo "$EVENT_ID"
  if nevent="$(nak encode nevent --relay "${RELAYS[0]}" "$EVENT_ID" 2>/dev/null || true)"; then
    [[ -n "$nevent" ]] && echo "$nevent"
  fi
  exit 0
fi

PUBLISH_FLAGS=(--quiet)
if [[ "$AUTH" == "true" ]]; then
  PUBLISH_FLAGS+=(--auth)
fi

successes=0
for relay in "${RELAYS[@]}"; do
  attempt=0
  published=false
  while [[ $attempt -le $RETRIES ]]; do
    attempt=$((attempt + 1))

    # Publish exact event json; don't pass modifying flags.
    if printf '%s' "$EVENT_JSON" | nak event "${PUBLISH_FLAGS[@]}" "$relay" >/dev/null 2>&1; then
      published=true
      break
    fi

    if [[ $attempt -le $RETRIES ]]; then
      sleep "$SLEEP_SECS"
    fi
  done

  if [[ "$published" == "true" ]]; then
    successes=$((successes + 1))
  else
    printf 'WARN: publish failed relay=%s\n' "$relay" >&2
  fi
done

if [[ $successes -eq 0 ]]; then
  echo "ERROR: failed to publish to all relays" >&2
  exit 1
fi

echo "$EVENT_ID"
if nevent="$(nak encode nevent --relay "${RELAYS[0]}" "$EVENT_ID" 2>/dev/null || true)"; then
  [[ -n "$nevent" ]] && echo "$nevent"
fi


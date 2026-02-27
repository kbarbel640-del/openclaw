#!/usr/bin/env bash
# Tax Document Scanner
# Scans tax document directories and maintains a structured JSON index
# Usage: ./scan-documents.sh

set -euo pipefail

# Force PST/PDT timestamps regardless of caller environment.
export TZ="America/Los_Angeles"

TAXES_DIR="$HOME/OneDrive/Finance/Taxes"
DOC_DIR="$HOME/OneDrive/Finance/Taxes"
INDEX_FILE="$TAXES_DIR/document-index.json"

# Ensure jq is available
if ! command -v jq &> /dev/null; then
    echo "Error: jq required but not found"
    exit 1
fi

# Initialize or repair the index.
# `document-index.json` has historically ended up as an empty file if a prior run
# tried to jq-append against empty input (jq exits 0 on empty input but produces
# no output). Treat empty/invalid/missing schema as "needs re-init".
init_index() {
  mkdir -p "$(dirname "$INDEX_FILE")"
  echo '{"version":1,"last_scan":null,"documents":[]}' > "$INDEX_FILE"
}

if [ ! -s "$INDEX_FILE" ]; then
  init_index
else
  # Validate basic schema: must be JSON with a top-level `documents` array.
  if ! jq -e 'type=="object" and (.documents|type=="array")' "$INDEX_FILE" >/dev/null 2>&1; then
    init_index
  fi
fi

QUIET=0
FULL=0
BASELINE=0
if [[ "${1:-}" == "--quiet" ]]; then
  QUIET=1
fi
if [[ "${1:-}" == "--full" ]]; then
  FULL=1
fi
if [[ "${2:-}" == "--full" ]]; then
  FULL=1
fi
if [[ "${1:-}" == "--baseline" ]]; then
  BASELINE=1
fi
if [[ "${2:-}" == "--baseline" ]]; then
  BASELINE=1
fi

# Get current timestamp (PST/PDT)
NOW=$(date -Iseconds)

echo "Scanning $DOC_DIR..."

# Count existing docs
EXISTING_COUNT=$(jq -r '(.documents | length) // 0' "$INDEX_FILE")

# Find all tax documents (include common image formats for scanned docs)
FOUND_FILES=$(find "$DOC_DIR" -type f \( -name "*.pdf" -o -name "*.csv" -o -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.PDF" -o -name "*.CSV" -o -name "*.PNG" -o -name "*.JPG" -o -name "*.JPEG" \) 2>/dev/null | wc -l)

echo "Found $FOUND_FILES files"
echo "Previously indexed: $EXISTING_COUNT"

# Build document list (batch append; avoids rewriting the index once per file).
FOUND_LIST_FILE=$(mktemp)
find "$DOC_DIR" -type f \( -name "*.pdf" -o -name "*.csv" -o -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.PDF" -o -name "*.CSV" -o -name "*.PNG" -o -name "*.JPG" -o -name "*.JPEG" \) 2>/dev/null \
  | sed "s#^$DOC_DIR/##" \
  > "$FOUND_LIST_FILE"

TEMP_FILE=$(mktemp)
jq --arg now "$NOW" --rawfile found "$FOUND_LIST_FILE" '
  (.documents // []) as $docs
  | ($docs | map(.path) | unique) as $existing
  | ($found
      | split("\n")
      | map(select(length > 0))
    ) as $foundPaths
  | ($foundPaths
      | map(select($existing | index(.) | not))
      | map({
          path: .,
          filename: (split("/") | last),
          status: "new",
          first_seen: $now,
          last_studied: null
        })
    ) as $newDocs
  | .documents = ($docs + $newDocs)
' "$INDEX_FILE" > "$TEMP_FILE" && mv "$TEMP_FILE" "$INDEX_FILE"

if [[ $BASELINE -eq 1 ]]; then
  # Convert the initial "everything is new" backlog into a baseline so future
  # scans can highlight only truly-new files.
  TEMP_FILE=$(mktemp)
  jq --arg now "$NOW" '
    .documents |= map(
      if .status == "new" then
        .status = "baseline" | .last_studied = $now
      else
        .
      end
    )
  ' "$INDEX_FILE" > "$TEMP_FILE" && mv "$TEMP_FILE" "$INDEX_FILE"
fi

if [[ $QUIET -eq 0 ]]; then
  jq -r --arg now "$NOW" '.documents[] | select(.status == "new" and .first_seen == $now) | "NEW: \(.path)"' "$INDEX_FILE"
fi

rm -f "$FOUND_LIST_FILE" 2>/dev/null || true

# Update last_scan timestamp
jq --arg now "$NOW" '.last_scan = $now' "$INDEX_FILE" > "$TEMP_FILE" && mv "$TEMP_FILE" "$INDEX_FILE"

# Count new documents
NEW_COUNT=$(jq '[.documents[] | select(.status == "new")] | length' "$INDEX_FILE")

echo ""
echo "Scan complete at $NOW"
echo "Total indexed: $(jq '.documents | length' "$INDEX_FILE")"
echo "New documents: $NEW_COUNT"

# Output new documents if any (avoid dumping thousands of lines by default)
if [[ $QUIET -eq 0 && "$NEW_COUNT" -gt 0 ]]; then
    echo ""
    echo "=== NEW DOCUMENTS ==="
    if [[ $FULL -eq 1 ]]; then
      jq -r '.documents[] | select(.status == "new") | .path' "$INDEX_FILE"
    else
      jq -r '.documents[] | select(.status == "new") | .path' "$INDEX_FILE" | head -50
      if [[ "$NEW_COUNT" -gt 50 ]]; then
        echo "... ($NEW_COUNT total; re-run with --full to print all)"
      fi
    fi
fi

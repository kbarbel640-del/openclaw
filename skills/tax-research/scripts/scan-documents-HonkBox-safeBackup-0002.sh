#!/usr/bin/env bash
# Tax Document Scanner
# Scans tax document directories and maintains a structured JSON index
# Usage: ./scan-documents.sh

set -euo pipefail

PRIMARY_DIR="$HOME/OneDrive/Finance/Taxes"
LEGACY_DIR="$HOME/OneDrive/Financial/Inbox"

DOCS_DIR="$PRIMARY_DIR"
INDEX_FILE="$DOCS_DIR/document-index.json"
TMP_DIR="$HOME/.openclaw/workspace/tmp"

# Ensure jq is available
if ! command -v jq &> /dev/null; then
    echo "Error: jq required but not found"
    exit 1
fi

# Ensure primary dir and tmp dir exist
mkdir -p "$PRIMARY_DIR" "$TMP_DIR"

# If primary is empty but legacy has files, use legacy to avoid losing data
PRIMARY_COUNT=$(find "$PRIMARY_DIR" -type f \( -name "*.pdf" -o -name "*.csv" -o -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.zip" -o -name "*.PDF" -o -name "*.CSV" -o -name "*.PNG" -o -name "*.JPG" -o -name "*.JPEG" -o -name "*.ZIP" \) 2>/dev/null | wc -l)
LEGACY_COUNT=0
if [ -d "$LEGACY_DIR" ]; then
    LEGACY_COUNT=$(find "$LEGACY_DIR" -type f \( -name "*.pdf" -o -name "*.csv" -o -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.zip" -o -name "*.PDF" -o -name "*.CSV" -o -name "*.PNG" -o -name "*.JPG" -o -name "*.JPEG" -o -name "*.ZIP" \) 2>/dev/null | wc -l)
fi

if [ "$PRIMARY_COUNT" -eq 0 ] && [ "$LEGACY_COUNT" -gt 0 ]; then
    DOCS_DIR="$LEGACY_DIR"
    INDEX_FILE="$DOCS_DIR/document-index.json"
    echo "Primary dir empty; falling back to $DOCS_DIR"
fi

mkdir -p "$DOCS_DIR"

# Initialize index if doesn't exist
if [ ! -f "$INDEX_FILE" ]; then
    echo '{"version":1,"last_scan":null,"documents":[]}' > "$INDEX_FILE"
fi

# Get current timestamp
NOW=$(date -Iseconds)

echo "Scanning $DOCS_DIR..."

# Count existing docs
EXISTING_COUNT=$(jq '.documents | length' "$INDEX_FILE")

# Find all tax documents
FOUND_FILES=$(find "$DOCS_DIR" -type f \( -name "*.pdf" -o -name "*.csv" -o -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.zip" -o -name "*.PDF" -o -name "*.CSV" -o -name "*.PNG" -o -name "*.JPG" -o -name "*.JPEG" -o -name "*.ZIP" \) 2>/dev/null | wc -l)

echo "Found $FOUND_FILES files"
echo "Previously indexed: $EXISTING_COUNT"

# Build document list
TEMP_FILE=$(mktemp -p "$TMP_DIR" scan-docs.XXXXXX)
find "$DOCS_DIR" -type f \( -name "*.pdf" -o -name "*.csv" -o -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.zip" -o -name "*.PDF" -o -name "*.CSV" -o -name "*.PNG" -o -name "*.JPG" -o -name "*.JPEG" -o -name "*.ZIP" \) 2>/dev/null | while read -r filepath; do
    filename=$(basename "$filepath")
    relpath="${filepath#$DOCS_DIR/}"

    # Check if already in index
    existing_status=$(jq -r --arg p "$relpath" '.documents[] | select(.path == $p) | .status' "$INDEX_FILE" 2>/dev/null || echo "")

    if [ -z "$existing_status" ]; then
        echo "NEW: $relpath"
        # Add to index with status "new"
        jq --arg p "$relpath" --arg f "$filename" --arg now "$NOW" \
           '.documents += [{"path": $p, "filename": $f, "status": "new", "first_seen": $now, "last_studied": null}]' \
           "$INDEX_FILE" > "$TEMP_FILE" && mv "$TEMP_FILE" "$INDEX_FILE"
    fi
done

# Update last_scan timestamp
jq --arg now "$NOW" '.last_scan = $now' "$INDEX_FILE" > "$TEMP_FILE" && mv "$TEMP_FILE" "$INDEX_FILE"

# Count new documents
NEW_COUNT=$(jq '[.documents[] | select(.status == "new")] | length' "$INDEX_FILE")

echo ""
echo "Scan complete at $NOW"
echo "Total indexed: $(jq '.documents | length' "$INDEX_FILE")"
echo "New documents: $NEW_COUNT"

# Output new documents if any
if [ "$NEW_COUNT" -gt 0 ]; then
    echo ""
    echo "=== NEW DOCUMENTS ==="
    jq -r '.documents[] | select(.status == "new") | .path' "$INDEX_FILE"
fi

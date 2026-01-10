#!/bin/bash
# Archive inbound media to Dropbox Steve_Journal
# Run via cron or manually

INBOUND_DIR="$HOME/.clawdbot/media/inbound"
JOURNAL_DIR="$HOME/Dropbox/Steve_Journal/media"
ARCHIVE_LOG="$HOME/.clawdbot/media/archived.log"

# Create log file if doesn't exist
touch "$ARCHIVE_LOG"

# Process each file in inbound
for file in "$INBOUND_DIR"/*; do
    [ -f "$file" ] || continue
    
    filename=$(basename "$file")
    
    # Skip if already archived
    if grep -q "^$filename$" "$ARCHIVE_LOG" 2>/dev/null; then
        continue
    fi
    
    # Get file modification date for folder organization
    if [[ "$OSTYPE" == "darwin"* ]]; then
        file_date=$(stat -f "%Sm" -t "%Y-%m-%d" "$file")
    else
        file_date=$(date -r "$file" "+%Y-%m-%d")
    fi
    
    # Create date folder
    dest_dir="$JOURNAL_DIR/$file_date"
    mkdir -p "$dest_dir"
    
    # Copy file (keep original in inbound for clawdbot reference)
    cp "$file" "$dest_dir/"
    
    # Log as archived
    echo "$filename" >> "$ARCHIVE_LOG"
    echo "Archived: $filename -> $dest_dir/"
done

echo "Archive complete: $(date)"

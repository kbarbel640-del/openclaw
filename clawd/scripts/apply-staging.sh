#!/bin/bash
# apply-staging.sh - Apply staged config changes after review
# 
# Usage: ./apply-staging.sh <filename>
# Example: ./apply-staging.sh moltbot.json
#
# This script enables Liam to propose protected file changes without
# directly editing them. He writes to .staging/, Simon reviews the diff,
# then runs this script to apply.
#
# Security: Always shows diff and requires explicit confirmation.

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

if [ -z "$1" ]; then
    echo -e "${RED}Usage: $0 <filename>${NC}"
    echo ""
    echo "Available staged files:"
    ls -la ~/clawd/.staging/*.proposed 2>/dev/null || echo "  (none)"
    exit 1
fi

FILE="$1"
STAGING_DIR="$HOME/clawd/.staging"
STAGED="$STAGING_DIR/$FILE.proposed"

# Determine target location based on file type
case "$FILE" in
    moltbot.json)
        TARGET="$HOME/.clawdbot/moltbot.json"
        ;;
    jobs.json)
        TARGET="$HOME/.clawdbot/cron/jobs.json"
        ;;
    SOUL.md|IDENTITY.md|STATUS.md|AGENTS.md)
        TARGET="$HOME/clawd/$FILE"
        ;;
    *)
        # Default: assume it's in .clawdbot
        TARGET="$HOME/.clawdbot/$FILE"
        ;;
esac

# Check if staged file exists
if [ ! -f "$STAGED" ]; then
    echo -e "${RED}Error: No staged changes for $FILE${NC}"
    echo ""
    echo "Expected: $STAGED"
    echo ""
    echo "Available staged files:"
    ls -la "$STAGING_DIR"/*.proposed 2>/dev/null || echo "  (none)"
    exit 1
fi

# Check if target exists
if [ ! -f "$TARGET" ]; then
    echo -e "${RED}Error: Target file does not exist: $TARGET${NC}"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Protected File Staging - Review      ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Staged file:  ${YELLOW}$STAGED${NC}"
echo -e "Target file:  ${YELLOW}$TARGET${NC}"
echo ""

# Show diff
echo -e "${BLUE}=== DIFF (current → proposed) ===${NC}"
echo ""
if command -v colordiff &> /dev/null; then
    colordiff "$TARGET" "$STAGED" || true
else
    diff --color=auto "$TARGET" "$STAGED" || true
fi
echo ""

# Show file sizes for sanity check
echo -e "${BLUE}=== FILE INFO ===${NC}"
echo -e "Current:  $(wc -l < "$TARGET") lines, $(stat -c %s "$TARGET") bytes"
echo -e "Proposed: $(wc -l < "$STAGED") lines, $(stat -c %s "$STAGED") bytes"
echo ""

# Confirm
echo -e "${YELLOW}Review the diff above carefully.${NC}"
echo ""
read -p "Apply these changes to $FILE? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Create backup
    BACKUP="$TARGET.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$TARGET" "$BACKUP"
    echo -e "${GREEN}Backup created: $BACKUP${NC}"
    
    # Apply changes
    cp "$STAGED" "$TARGET"
    echo -e "${GREEN}Changes applied to $TARGET${NC}"
    
    # Clean up staged file
    rm "$STAGED"
    echo -e "${GREEN}Staged file removed${NC}"
    
    echo ""
    echo -e "${GREEN}✓ Done! Changes applied successfully.${NC}"
    echo ""
    echo "If something went wrong, restore from backup:"
    echo "  cp \"$BACKUP\" \"$TARGET\""
else
    echo ""
    echo -e "${YELLOW}Aborted. No changes made.${NC}"
    echo ""
    echo "The staged file remains at: $STAGED"
    echo "You can edit it and try again, or remove it with:"
    echo "  rm \"$STAGED\""
fi

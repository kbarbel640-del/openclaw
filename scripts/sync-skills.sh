#!/bin/bash
# Sync clawd workspace: pull upstream + push changes + notify

cd /Users/dbhurley/clawd

UPSTREAM_CHANGES=0
LOCAL_CHANGES=0

# 1. Pull latest from upstream clawdbot
echo "Fetching upstream..."
git fetch upstream 2>/dev/null

UPSTREAM_COUNT=$(git log HEAD..upstream/main --oneline 2>/dev/null | wc -l | tr -d ' ')
if [ "$UPSTREAM_COUNT" -gt 0 ]; then
    echo "Merging $UPSTREAM_COUNT upstream changes..."
    UPSTREAM_CHANGES=1
    git merge upstream/main -m "Auto-merge upstream clawdbot" --no-edit || {
        git checkout --ours .gitignore AGENTS.md SOUL.md USER.md IDENTITY.md TOOLS.md memory.md 2>/dev/null
        git checkout --ours skills/ memory/ 2>/dev/null
        git add -A
        git commit -m "Auto-merge upstream (kept workspace versions for conflicts)" --no-edit
    }
fi

# 2. Commit any local changes
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Committing local changes..."
    LOCAL_CHANGES=1
    git add -A
    git commit -m "Auto-sync: $(date '+%Y-%m-%d %H:%M')"
fi

# 3. Push everything
if [ "$UPSTREAM_CHANGES" -eq 1 ] || [ "$LOCAL_CHANGES" -eq 1 ]; then
    echo "Pushing to origin..."
    git push origin main
fi

# 4. Output summary for notification
if [ "$UPSTREAM_CHANGES" -eq 1 ]; then
    echo "NOTIFY:UPSTREAM:$UPSTREAM_COUNT"
fi
if [ "$LOCAL_CHANGES" -eq 1 ]; then
    echo "NOTIFY:LOCAL"
fi

echo "Sync complete!"

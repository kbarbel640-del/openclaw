#!/bin/bash
# Heartbeat checks - outputs summary for notification

cd /Users/dbhurley/clawd

echo "=== 🤖 Steve Status Check ==="
echo ""

# Check Steve's email
echo "📬 Steve's Email:"
python3 << 'PYEOF'
import imaplib
mail = imaplib.IMAP4_SSL('imap.purelymail.com', 993)
mail.login('steve@withagency.ai', 'BendDontBreak!Steve.')
mail.select('INBOX')
status, messages = mail.search(None, 'UNSEEN')
unseen = len(messages[0].split()) if messages[0] else 0
if unseen > 0:
    print(f"   {unseen} unread message(s)")
else:
    print("   No new messages")
mail.logout()
PYEOF

# Check for upstream updates (without merging)
echo ""
echo "🔄 Upstream Status:"
git fetch upstream 2>/dev/null
UPSTREAM_COUNT=$(git log HEAD..upstream/main --oneline 2>/dev/null | wc -l | tr -d ' ')
if [ "$UPSTREAM_COUNT" -gt 0 ]; then
    echo "   $UPSTREAM_COUNT new commits available from clawdbot"
else
    echo "   Up to date with clawdbot"
fi

# Check local uncommitted changes
echo ""
echo "📁 Workspace:"
if git diff --quiet && git diff --cached --quiet; then
    echo "   Clean (no uncommitted changes)"
else
    echo "   Has uncommitted changes"
fi

echo ""
echo "=== Check complete $(date '+%H:%M') ==="

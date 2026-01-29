#!/bin/bash
# Install CIS cron jobs
# Usage: ./install-cron.sh

CRON_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/cron.conf"

echo "Installing Content Intelligence System cron jobs..."

# Check if already installed
if crontab -l 2>/dev/null | grep -q "CIS Cron Configuration"; then
    echo "CIS cron jobs already installed."
    echo "To update, first remove existing entries with: crontab -e"
    exit 0
fi

# Add cron jobs
(crontab -l 2>/dev/null; echo ""; echo "# Content Intelligence System (CIS) Cron Configuration"; cat "$CRON_FILE" | grep -v "^#" | grep -v "^$") | crontab -

echo "✓ CIS cron jobs installed successfully!"
echo ""
echo "Installed jobs:"
echo "  - Daily monitor check at 9:00 AM"
echo "  - Weekly digest every Monday at 10:00 AM"
echo ""
echo "View with: crontab -l"
echo "Logs saved to: ~/clawd/content-intelligence/logs/"

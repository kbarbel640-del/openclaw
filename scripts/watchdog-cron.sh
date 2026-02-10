#!/bin/bash

# Dumb Watchdog Cron Wrapper
# Use this in crontab:
# */60 * * * * /Users/zack/OpenClaw/housekeeper/repo/openclaw/scripts/watchdog-cron.sh

# 1. Setup minimal environment for Bun & OpenClaw CLI
export PATH="/Users/zack/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export HOME="/Users/zack"

# 2. Navigate to repo root
cd "$(dirname "$0")/.." || exit 1

# 3. Run the TypeScript watchdog
# (Assumes `bun` is in PATH now)
echo "[$(date)] Running Watchdog..."
bun scripts/watchdog.ts >> /tmp/openclaw-watchdog.log 2>&1
echo "[$(date)] Watchdog finished with status $?"

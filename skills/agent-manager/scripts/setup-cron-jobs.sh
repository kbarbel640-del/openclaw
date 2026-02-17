#!/usr/bin/env bash
set -euo pipefail

# Setup automated cron jobs for the multi-agent system
# Usage: setup-cron-jobs.sh [--tz "Europe/Berlin"]
#
# Creates:
#   1. Morning Research Digest (8:00 daily)
#   2. Content Proposals (9:30 Mon-Fri)
#   3. Weekly Deep Research (Sunday 10:00)
#   4. System Health Check (every 6 hours)

TZ="${1:-Europe/Berlin}"

echo "Setting up automated cron jobs (timezone: ${TZ})..."
echo ""

# Check if openclaw CLI is available
if ! command -v openclaw &>/dev/null; then
  echo "Warning: 'openclaw' CLI not found in PATH."
  echo "These commands should be run in an environment where openclaw is available."
  echo ""
  echo "Generating commands for manual execution:"
  echo ""
fi

echo "=== 1. Morning Research Digest (daily 8:00) ==="
echo ""
cat << CMD
openclaw cron add \\
  --name "Morning Research Digest" \\
  --cron "0 8 * * *" \\
  --tz "${TZ}" \\
  --session isolated \\
  --agent researcher \\
  --message "Run a full AI research scan:
1. Search X.com for trending AI agent discussions (last 24h)
2. Check HackerNews for top AI stories (last 24h)
3. Check GitHub trending for new AI repositories
4. Search for new open-source LLM releases
5. Compile findings into ~/workspace/research/digest-\$(date +%Y-%m-%d).md
Format: Breaking News, New Tools, Key Discussions, Papers, 3 Actionable Recommendations.
Keep it concise - bullet points, not essays." \\
  --announce \\
  --channel last
CMD

echo ""
echo "=== 2. Content Proposals (Mon-Fri 9:30) ==="
echo ""
cat << CMD
openclaw cron add \\
  --name "Daily Content Proposals" \\
  --cron "30 9 * * 1-5" \\
  --tz "${TZ}" \\
  --session isolated \\
  --agent creator \\
  --message "Review ~/workspace/research/ for the latest digest.
Generate 3 content proposals based on trending topics.
For each proposal include:
- Title/Hook (first line that grabs attention)
- Platform (X thread, blog post, LinkedIn, or video script)
- Why Now (timeliness factor)
- Estimated production time
Save proposals to ~/workspace/content/proposals/\$(date +%Y-%m-%d).md
Present the top pick with a ready-to-go draft outline." \\
  --announce \\
  --channel last
CMD

echo ""
echo "=== 3. Weekly Deep Research (Sunday 10:00) ==="
echo ""
cat << CMD
openclaw cron add \\
  --name "Weekly Deep Research" \\
  --cron "0 10 * * 0" \\
  --tz "${TZ}" \\
  --session isolated \\
  --agent researcher \\
  --message "Weekly deep research scan:
1. X.com: Search for AI agent frameworks, coding tools, automation hacks (past week)
2. HackerNews: Top AI/ML stories with >50 points (past week)
3. GitHub: New trending AI repos (past week)
4. Reddit: r/MachineLearning, r/LocalLLaMA top posts (past week)
5. ArXiv: Notable AI agent papers
6. Identify 3 tools/techniques that could improve our OpenClaw system
7. Compile into ~/workspace/research/weekly-\$(date +%Y-%m-%d).md
Include a RECOMMENDATIONS section with specific integration ideas." \\
  --announce \\
  --channel last
CMD

echo ""
echo "=== 4. System Health Check (every 6 hours) ==="
echo ""
cat << CMD
openclaw cron add \\
  --name "System Health Check" \\
  --cron "0 */6 * * *" \\
  --tz "${TZ}" \\
  --session main \\
  --system-event "Quick system status: check gateway health, active sessions count, any errors in recent logs. Report only if issues found." \\
  --wake next-heartbeat
CMD

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To view jobs:    openclaw cron list"
echo "To run manually: openclaw cron run <job-id>"
echo "To edit:         openclaw cron edit <job-id>"
echo "To disable:      openclaw cron edit <job-id> --disable"

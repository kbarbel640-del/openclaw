# How to Use Liam

Your AI assistant running on Clawdbot with GLM-4.7.

## Quick Start

**Talk to Liam:** Slack DM or channel

**Common requests:**
- "Check my email" - Checks clawdbot@puenteworks.com
- "What's on my calendar?" - Shows upcoming events
- "Remind me about X" - Sets a reminder
- "Summarize this" - Summarizes content
- "Research X" - Deep research on a topic

## Configuration Changes

Liam cannot change his own config (by design). To modify:

1. Open Cursor
2. Tell Claude what to change
3. Claude updates the protected files

This prevents Liam from accidentally breaking himself.

## Liam's Improvement Ideas

Liam proposes changes to `~/clawd/EVOLUTION-QUEUE.md`.

**To review:**
1. Open Cursor
2. Ask: "Show me Liam's evolution queue"
3. Tell Claude which items to approve/reject
4. Approved changes get implemented

## Daily Showcase Scouting

Every day at 11 AM, Liam checks https://clawd.bot/showcase for ideas from other users. Promising ideas go to the Evolution Queue.

## File Structure

**Protected (Cursor only):**
- `SOUL.md` - Core identity
- `IDENTITY.md` - Basic info
- `STATUS.md` - System status
- `AGENTS.md` - Behavior rules

**Writable (Liam can edit):**
- `EVOLUTION-QUEUE.md` - Improvement proposals
- `SELF-NOTES.md` - Personal observations
- `MEMORY.md` - Long-term memory
- `TOOLS.md` - Tool notes
- `METRICS.md` - Usage tracking
- `memory/*.md` - Daily logs

## Troubleshooting

See `~/clawd/TROUBLESHOOTING.md`

## Recovery

If Liam breaks:
```bash
~/clawd/restore-liam.sh
```

## Health Check

Manual health check:
```bash
~/clawd/health-check.sh
```

Automatic health checks run daily at 9 AM.

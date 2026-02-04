# DJ Profile Pack - Smoke Test Checklist

Use this checklist to verify the DJ assistant profile is working end-to-end after setup.

## Prerequisites Verification

### Environment
- [ ] Gateway running: `curl http://localhost:18789/health` returns OK
- [ ] Telegram bot token configured
- [ ] Notion API key set: `echo $NOTION_API_KEY` shows value
- [ ] gog authenticated: `gog auth list` shows your account
- [ ] Notion databases created and shared with integration

### Configuration
- [ ] `~/.openclaw/openclaw.json` contains `dj-personal` agent config
- [ ] `~/.openclaw/openclaw.json` contains `dj-worksafe` agent config (optional)
- [ ] Workspace directories exist:
  - [ ] `~/.openclaw/workspaces/dj-personal/SOUL.md`
  - [ ] `~/.openclaw/workspaces/dj-personal/IDENTITY.md`
  - [ ] `~/.openclaw/workspaces/dj-personal/USER.md` (filled in)

---

## Test 1: Basic Telegram Connection

**Steps:**
1. Open Telegram
2. Message your DJ bot: "Hello"

**Expected:**
- [ ] Bot responds within 10 seconds
- [ ] Response mentions "Cue" or shows ⚡ emoji (identity working)
- [ ] No error in gateway logs

**If failed:**
- Check gateway logs for errors
- Verify Telegram token
- Ensure your user ID is in allowlist

---

## Test 2: /agenda Command

**Steps:**
1. In Telegram, send: `/agenda`

**Expected:**
- [ ] Bot returns today's date
- [ ] Shows calendar events (if any)
- [ ] Shows tasks due today (if any in Notion)
- [ ] Response formatted with emoji headers

**Verify manually:**
```bash
# Check calendar access
gog calendar events primary --from $(date +%Y-%m-%dT00:00:00Z) --to $(date -d "+1 day" +%Y-%m-%dT00:00:00Z)

# Check Notion access
curl -X POST "https://api.notion.com/v1/data_sources/$DJ_NOTION_TASKS_DB/query" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{"page_size": 5}'
```

---

## Test 3: /capture Command (Text)

**Steps:**
1. In Telegram, send: `/capture Test task from smoke test`
2. Wait for confirmation

**Expected:**
- [ ] Bot confirms capture with "📥"
- [ ] Shows task title in response
- [ ] Provides Notion link

**Verify in Notion:**
- [ ] Task appears in Tasks database
- [ ] Title is "Test task from smoke test"
- [ ] Status is "Inbox"
- [ ] Source is "Voice Capture" or similar

**Cleanup:**
- Delete the test task from Notion after verification

---

## Test 4: /capture Command (With Prefix)

**Steps:**
1. In Telegram, send: `/capture meeting: Smoke test meeting note`

**Expected:**
- [ ] Bot confirms as "meeting note"
- [ ] Entry appears in Meetings Prep database (not Tasks)

**Verify in Notion:**
- [ ] Entry exists in Meetings Prep database
- [ ] Date is set to today

---

## Test 5: /capture Command (With Date)

**Steps:**
1. In Telegram, send: `/capture Review docs by tomorrow`

**Expected:**
- [ ] Bot confirms capture
- [ ] Due date is set to tomorrow

**Verify in Notion:**
- [ ] Task has Due property set to tomorrow's date

---

## Test 6: /findslot Command

**Steps:**
1. In Telegram, send: `/findslot 60`

**Expected:**
- [ ] Bot returns list of available 60-minute slots
- [ ] Slots are in the next 7 days
- [ ] Each slot shows date, time, and context

**Note:** Results depend on calendar availability

---

## Test 7: /timeblock Command

**Steps:**
1. Ensure you have at least one task with a due date in Notion
2. In Telegram, send: `/timeblock`

**Expected:**
- [ ] Bot proposes time blocks for tasks
- [ ] Each proposal shows task, time, and slot info
- [ ] Bot asks for approval (approve/skip/adjust)

**Follow-up test:**
1. Reply: `skip`
2. Verify no calendar events were created

---

## Test 8: /mode Command

**Steps:**
1. In Telegram, send: `/mode`

**Expected:**
- [ ] Bot shows current mode (Personal)
- [ ] Shows agent name (Cue)
- [ ] Lists available modes

---

## Test 9: Daily Brief Cron (Manual Trigger)

**Steps:**
1. Run: `openclaw cron run dj-daily-brief`
2. Check Telegram for delivery

**Expected:**
- [ ] Brief delivered to Telegram within 60 seconds
- [ ] Contains today's schedule section
- [ ] Contains tasks section

---

## Test 10: Unit Tests Pass

**Steps:**
```bash
cd /path/to/openclaw
pnpm vitest run src/dj/
```

**Expected:**
- [ ] All 41 tests pass
- [ ] No type errors
- [ ] Coverage meets threshold

---

## Optional: WorkSafe Mode Tests

### Test W1: WorkSafe /agenda

**Prerequisites:**
- WorkSafe agent configured
- LM Studio running (if using local LLM)

**Steps:**
1. Message WorkSafe bot: `/agenda`

**Expected:**
- [ ] Returns calendar events only
- [ ] No personal task details
- [ ] Professional formatting

### Test W2: WorkSafe /capture

**Steps:**
1. Message WorkSafe bot: `/capture Work meeting notes`

**Expected:**
- [ ] Capture goes to Work Notes database (not personal Tasks)
- [ ] Generic formatting

---

## Troubleshooting Quick Reference

| Symptom | Check | Fix |
|---------|-------|-----|
| Bot not responding | Gateway running? | `pnpm openclaw gateway run` |
| "Unauthorized" on commands | User in allowlist? | `openclaw channels telegram allow <id>` |
| Calendar empty | gog authenticated? | `gog auth add your@gmail.com` |
| Notion errors | DB shared with integration? | Share in Notion UI |
| Capture fails | NOTION_API_KEY set? | `export NOTION_API_KEY=...` |
| Wrong database | DB IDs correct? | Check config/env vars |
| Cron not running | Gateway started cron? | Check gateway logs |

---

## Sign-Off

| Test | Pass | Notes |
|------|------|-------|
| Basic Telegram | ☐ | |
| /agenda | ☐ | |
| /capture (text) | ☐ | |
| /capture (prefix) | ☐ | |
| /capture (date) | ☐ | |
| /findslot | ☐ | |
| /timeblock | ☐ | |
| /mode | ☐ | |
| Daily Brief | ☐ | |
| Unit Tests | ☐ | |

**Tester:** _______________
**Date:** _______________
**Version:** _______________

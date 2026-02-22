---
name: calendar
description: Read calendar events via ICS feed (work) and icalBuddy (personal). Use for schedule queries — today's events, upcoming days, next meeting, free time blocks, week overview. Triggers on calendar, schedule, meeting, "what's on", free time, availability questions.
---

# Calendar

Read-only access to calendar events from two sources:

1. **ICS feed** (primary) — Outlook work calendar via direct ICS URL, parsed with Python (`parse_ics.py`). Handles recurring events (RRULE), timezone conversion, EXDATE, meeting link extraction.
2. **icalBuddy** (fallback) — macOS Calendar for personal calendars. Used if ICS fetch fails.

Configuration: `config.env` (ICS URL, timezone, work hours).

## Quick Reference

```bash
# Today's events (times, calendar, meeting links)
bash scripts/cal.sh today

# Next N days (default 7)
bash scripts/cal.sh upcoming 7

# Next upcoming event with join link
bash scripts/cal.sh next

# Free time blocks today (gaps between events, work hours 9-17)
bash scripts/cal.sh free

# Week overview (event counts per day)
bash scripts/cal.sh week
```

All scripts are at: `/Users/2mas/Projects/openclaw/skills/calendar/scripts/`

## Output Format

Events: `TIME | CALENDAR | TITLE | LINK` (link only if present)

- Cancelled events are automatically filtered out
- Meeting links (Zoom/Teams/Meet) extracted from location field
- Calendar: Work or Personal

## Direct icalBuddy (advanced)

```bash
# Raw events for a date range
/opt/homebrew/bin/icalBuddy -nc -nrd -ic "Wrk,Private - google,Home" "eventsFrom:2026-02-16 to:2026-02-20"

# Events happening right now
/opt/homebrew/bin/icalBuddy -ic "Work" eventsNow
```

## Calendars Available

- **Wrk** — synced work calendar (shows as "Busy" location for blocked time)
- **Private - google** — personal Google calendar
- **Home** — home events
- **Holiday** / **UK Holidays** — holidays
- **P&T** — personal calendar
- **Calendaraar** — personal calendar

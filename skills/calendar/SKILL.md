---
name: calendar
description: Manages Google Calendar using gog CLI. Use for creating, listing, updating, deleting events, checking availability, and managing invitations.
invocation: user
---

# Calendar Skill

Manages Joel's Google Calendar using the `gog` CLI (v0.9.0).

## Authentication

```bash
# Check auth status
gog auth status

# Re-authenticate if token expired
gog auth login
```

If you see "Token has been expired or revoked", run `gog auth login` in a browser-capable terminal.

## Joel's Calendars

| Calendar             | ID                                                     | Use                            |
| -------------------- | ------------------------------------------------------ | ------------------------------ |
| **Family** (default) | `family01800994754500112683@group.calendar.google.com` | Family events, kids activities |
| **Primary**          | `primary` or `joelklabo@gmail.com`                     | Personal events                |

**Per MEMORY.md**: Always create events on **Family** calendar by default unless specified otherwise.

## Core Commands

### List Calendars

```bash
gog calendar calendars --json
```

### List Events

```bash
# Today's events
gog calendar events --today --json

# This week
gog calendar events --week --json

# Next 7 days
gog calendar events --days 7 --json

# Specific date range
gog calendar events --from "2026-02-03" --to "2026-02-10" --json

# From specific calendar
gog calendar events "family01800994754500112683@group.calendar.google.com" --today --json

# All calendars
gog calendar events --all --today --json
```

### Create Event

```bash
# Basic event (on Family calendar by default)
gog calendar create "family01800994754500112683@group.calendar.google.com" \
  --summary "Doctor Appointment" \
  --from "2026-02-05T10:00:00-08:00" \
  --to "2026-02-05T11:00:00-08:00" \
  --json

# With location and description
gog calendar create "family01800994754500112683@group.calendar.google.com" \
  --summary "Dinner with Friends" \
  --from "2026-02-07T18:30:00-08:00" \
  --to "2026-02-07T21:00:00-08:00" \
  --location "123 Main St, Petaluma" \
  --description "Casual dinner" \
  --json

# All-day event
gog calendar create "family01800994754500112683@group.calendar.google.com" \
  --summary "Vacation Day" \
  --from "2026-02-14" \
  --to "2026-02-14" \
  --all-day \
  --json

# With attendees
gog calendar create "family01800994754500112683@group.calendar.google.com" \
  --summary "Team Meeting" \
  --from "2026-02-10T14:00:00-08:00" \
  --to "2026-02-10T15:00:00-08:00" \
  --attendees "person@example.com,other@example.com" \
  --json

# With Google Meet
gog calendar create "family01800994754500112683@group.calendar.google.com" \
  --summary "Video Call" \
  --from "2026-02-10T10:00:00-08:00" \
  --to "2026-02-10T10:30:00-08:00" \
  --with-meet \
  --json

# Recurring event (weekly on Mondays)
gog calendar create "family01800994754500112683@group.calendar.google.com" \
  --summary "Weekly Standup" \
  --from "2026-02-03T09:00:00-08:00" \
  --to "2026-02-03T09:30:00-08:00" \
  --rrule "RRULE:FREQ=WEEKLY;BYDAY=MO" \
  --json

# With reminders
gog calendar create "family01800994754500112683@group.calendar.google.com" \
  --summary "Important Meeting" \
  --from "2026-02-12T15:00:00-08:00" \
  --to "2026-02-12T16:00:00-08:00" \
  --reminder "popup:30m" \
  --reminder "email:1d" \
  --json
```

### Update Event

```bash
# Change time
gog calendar update <calendarId> <eventId> \
  --from "2026-02-05T11:00:00-08:00" \
  --to "2026-02-05T12:00:00-08:00" \
  --json

# Change title
gog calendar update <calendarId> <eventId> \
  --summary "New Title" \
  --json

# Add attendee (preserves existing)
gog calendar update <calendarId> <eventId> \
  --add-attendee "newperson@example.com" \
  --json

# Update recurring event (all instances)
gog calendar update <calendarId> <eventId> \
  --summary "Updated Weekly Standup" \
  --scope all \
  --json

# Update single instance of recurring event
gog calendar update <calendarId> <eventId> \
  --summary "Special Standup" \
  --scope single \
  --original-start "2026-02-10T09:00:00-08:00" \
  --json
```

### Delete Event

```bash
# Delete single event
gog calendar delete <calendarId> <eventId> --force --json

# Delete all instances of recurring event
gog calendar delete <calendarId> <eventId> --scope all --force --json

# Delete single instance
gog calendar delete <calendarId> <eventId> --scope single --original-start "2026-02-10T09:00:00-08:00" --force --json
```

### Get Event Details

```bash
gog calendar event <calendarId> <eventId> --json
```

### Search Events

```bash
# Search by text
gog calendar search "doctor" --json

# Search with date range
gog calendar search "meeting" --from "2026-02-01" --to "2026-02-28" --json

# Search specific calendar
gog calendar search "birthday" --calendar "family01800994754500112683@group.calendar.google.com" --json
```

## Availability & Conflicts

### Check Free/Busy

```bash
# Check availability for time range
gog calendar freebusy "primary" --from "2026-02-05T09:00:00-08:00" --to "2026-02-05T17:00:00-08:00" --json

# Multiple calendars
gog calendar freebusy "primary,family01800994754500112683@group.calendar.google.com" --from "2026-02-05T09:00:00-08:00" --to "2026-02-05T17:00:00-08:00" --json
```

### Find Conflicts

```bash
# Today's conflicts
gog calendar conflicts --today --json

# This week's conflicts
gog calendar conflicts --week --json

# Specific calendars
gog calendar conflicts --week --calendars "primary,family01800994754500112683@group.calendar.google.com" --json
```

## Invitations

### Respond to Invitation

```bash
# Accept
gog calendar respond <calendarId> <eventId> --status accepted --json

# Decline with message
gog calendar respond <calendarId> <eventId> --status declined --comment "Sorry, I have a conflict" --json

# Tentative
gog calendar respond <calendarId> <eventId> --status tentative --json
```

### Propose New Time

```bash
# Opens browser to propose new time
gog calendar propose-time <calendarId> <eventId>
```

## Special Event Types

### Focus Time

```bash
gog calendar focus-time \
  --from "2026-02-05T14:00:00-08:00" \
  --to "2026-02-05T16:00:00-08:00" \
  --summary "Deep Work" \
  --auto-decline all \
  --chat-status doNotDisturb \
  --json
```

### Out of Office

```bash
gog calendar out-of-office \
  --from "2026-02-14T00:00:00-08:00" \
  --to "2026-02-15T00:00:00-08:00" \
  --json
```

### Working Location

```bash
# Working from home
gog calendar working-location \
  --from "2026-02-05T09:00:00-08:00" \
  --to "2026-02-05T17:00:00-08:00" \
  --type home \
  --json

# Working from office
gog calendar working-location \
  --from "2026-02-06T09:00:00-08:00" \
  --to "2026-02-06T17:00:00-08:00" \
  --type office \
  --working-office-label "Downtown Office" \
  --json
```

## Time Format Reference

**RFC3339 format**: `YYYY-MM-DDTHH:MM:SS-08:00` (PST timezone)

**Relative times**: `today`, `tomorrow`, `monday`, `tuesday`, etc.

**Date only (all-day)**: `YYYY-MM-DD`

## Recurrence Rules (RRULE)

| Pattern                  | RRULE                                      |
| ------------------------ | ------------------------------------------ |
| Daily                    | `RRULE:FREQ=DAILY`                         |
| Weekly                   | `RRULE:FREQ=WEEKLY`                        |
| Weekly on Mon/Wed/Fri    | `RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR`         |
| Monthly on 15th          | `RRULE:FREQ=MONTHLY;BYMONTHDAY=15`         |
| Monthly, first Monday    | `RRULE:FREQ=MONTHLY;BYDAY=1MO`             |
| Yearly                   | `RRULE:FREQ=YEARLY`                        |
| Every 2 weeks            | `RRULE:FREQ=WEEKLY;INTERVAL=2`             |
| End after 10 occurrences | `RRULE:FREQ=WEEKLY;COUNT=10`               |
| End by date              | `RRULE:FREQ=WEEKLY;UNTIL=20260630T000000Z` |

## Event Colors

Run `gog calendar colors` to see available color IDs (1-11).

## Common Workflows

### "What's on my calendar today?"

```bash
gog calendar events --all --today --json
```

### "Am I free at 2pm tomorrow?"

```bash
gog calendar freebusy "primary,family01800994754500112683@group.calendar.google.com" \
  --from "$(date -d 'tomorrow 14:00' --iso-8601=seconds)" \
  --to "$(date -d 'tomorrow 15:00' --iso-8601=seconds)" \
  --json
```

### "Schedule a recurring family dinner every Sunday at 6pm"

```bash
gog calendar create "family01800994754500112683@group.calendar.google.com" \
  --summary "Family Dinner" \
  --from "2026-02-02T18:00:00-08:00" \
  --to "2026-02-02T20:00:00-08:00" \
  --rrule "RRULE:FREQ=WEEKLY;BYDAY=SU" \
  --json
```

### "When is Poppy's birthday?"

```bash
gog calendar search "Poppy birthday" --calendar "family01800994754500112683@group.calendar.google.com" --json
```

## Troubleshooting

### Token Expired

```
Error: "Token has been expired or revoked"
Fix: Run `gog auth login` in a terminal with browser access
```

### Calendar Not Found

```bash
# List all calendars to find correct ID
gog calendar calendars --json
```

### Event Not Found

```bash
# Search for event
gog calendar search "<keywords>" --json
```

## Thread Context

**Discord Thread:** #Calendar `1467984362950889523`

This skill manages all calendar-related tasks in this thread.

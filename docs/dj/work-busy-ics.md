# Work Busy (ICS) Calendar Integration

Sync Outlook work calendar events to Google Calendar for DJ visibility without exposing sensitive meeting details.

## Overview

DJ needs visibility into your work schedule to avoid double-booking personal tasks during work meetings. This guide shows how to:

1. Export your Outlook calendar as an ICS subscription URL
2. Create a dedicated Google Calendar that subscribes to that ICS
3. Configure DJ to merge these events as "busy blocks"

**Privacy note:** DJ only sees time blocks marked as "busy" - meeting titles, attendees, and descriptions are stripped automatically.

## Step 1: Get Outlook ICS URL

### Outlook Web (Office 365)

1. Go to [outlook.office.com/calendar](https://outlook.office.com/calendar)
2. Click the gear icon (Settings) → **View all Outlook settings**
3. Navigate to **Calendar** → **Shared calendars**
4. Under "Publish a calendar", select your calendar and choose **Can view all details** (or **Can view when I'm busy** for maximum privacy)
5. Click **Publish**
6. Copy the **ICS** link (not the HTML link)

The URL looks like:
```
https://outlook.office365.com/owa/calendar/abc123.../calendar.ics
```

### Outlook Desktop (Windows)

1. Open Outlook → **File** → **Account Settings** → **Account Settings**
2. Go to the **Internet Calendars** tab
3. Select your calendar → **Copy URL**

Or publish via Outlook Web as described above.

## Step 2: Create Google Calendar Subscription

### Via Google Calendar Web

1. Go to [calendar.google.com](https://calendar.google.com)
2. On the left sidebar, find **Other calendars** → click **+** → **From URL**
3. Paste the Outlook ICS URL
4. Click **Add calendar**
5. The calendar appears under "Other calendars" with a default name

### Rename the Calendar

1. Hover over the new calendar in the sidebar
2. Click the three dots (⋮) → **Settings**
3. Change the name to **Work Busy (ICS)**
4. Note the **Calendar ID** shown under "Integrate calendar" - you'll need this for DJ configuration

The Calendar ID looks like:
```
abc123xyz@group.calendar.google.com
```

## Step 3: Configure DJ

Add the Work Busy calendar ID to your OpenClaw configuration.

### Option A: Via CLI

```bash
openclaw config set dj.workBusyCalendarId "abc123xyz@group.calendar.google.com"
```

### Option B: Edit Config File

Add to `~/.openclaw/openclaw.json`:

```json
{
  "dj": {
    "workBusyCalendarId": "abc123xyz@group.calendar.google.com"
  }
}
```

### Verify Configuration

```bash
# List available calendars
openclaw dj calendars

# Check DJ config
openclaw config get dj
```

## Step 4: Test the Integration

### Check Calendar Sync

```bash
# List events from Work Busy calendar
gog calendar events "abc123xyz@group.calendar.google.com" --from today --to +7d
```

### Check DJ Agenda

```
/agenda tomorrow
```

DJ should show your work events as busy blocks without revealing meeting titles:

```
📅 Tomorrow (Tue Feb 4)

🔒 09:00-10:00 — Busy (work)
🔒 14:00-15:30 — Busy (work)

📋 Tasks:
• Review PR for feature X (Notion)
```

### Check Slot Finding

```
/findslot 1h tomorrow
```

DJ excludes busy blocks when finding available slots:

```
Available 1h slots tomorrow:
• 10:00-11:00
• 11:00-12:00
• 15:30-16:30
```

## Refresh Behavior

### Google Calendar ICS Sync

- **Refresh interval:** Google Calendar fetches ICS updates approximately every 12-24 hours
- **No manual refresh:** Google doesn't provide a way to force immediate sync
- **New events:** May take up to 24 hours to appear
- **Deleted events:** May persist for up to 24 hours after removal

### Workarounds for Faster Sync

If you need faster updates:

1. **Re-add the subscription:** Delete and re-add the calendar from URL (tedious but immediate)
2. **Use Google Calendar API directly:** Future enhancement - could poll Outlook ICS more frequently
3. **Accept the delay:** For most scheduling purposes, 12-24 hour delay is acceptable

### Troubleshooting Sync Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Events not appearing | ICS URL changed or expired | Re-publish from Outlook, update Google subscription |
| Stale events | Google's 12-24h refresh cycle | Wait, or re-add subscription |
| "Unable to fetch" error | Network/firewall blocking | Verify ICS URL is accessible from browser |
| Wrong timezone | Outlook/Google timezone mismatch | Check timezone settings in both services |

## Privacy Guidance

### What DJ Sees

When configured correctly, DJ only accesses:
- **Start time** of work events
- **End time** of work events
- **Busy/free status**

DJ does **NOT** see:
- Meeting titles
- Attendees
- Descriptions
- Locations
- Attachments

### How Privacy is Enforced

1. **At source (recommended):** When publishing from Outlook, choose "Can view when I'm busy" to only export free/busy data

2. **At DJ level:** Even if titles are exported, DJ's busy block merge strips them:
   ```
   Original: "Q1 Planning with CEO"
   DJ sees:  "Busy (work)"
   ```

3. **In Telegram:** DJ never sends work meeting titles to Telegram - only "Busy (work)" indicators

### Recommended Privacy Settings

| Setting | Location | Value |
|---------|----------|-------|
| Outlook publish level | Outlook Web → Shared calendars | "Can view when I'm busy" |
| Work Busy display | DJ config | Titles stripped automatically |
| Telegram output | DJ skills | Shows "Busy (work)" only |

## Configuration Reference

### DJ Configuration Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `dj.workBusyCalendarId` | string | (none) | Google Calendar ID for Work Busy calendar |
| `dj.workBusyLabel` | string | `"Busy (work)"` | Label shown for work busy blocks |
| `dj.workBusyEmoji` | string | `"🔒"` | Emoji prefix for work busy blocks |

### Example Full Config

```json
{
  "dj": {
    "calendarId": "primary",
    "workBusyCalendarId": "abc123xyz@group.calendar.google.com",
    "workBusyLabel": "Busy (work)",
    "workBusyEmoji": "🔒",
    "workingHours": {
      "start": "09:00",
      "end": "18:00",
      "days": [1, 2, 3, 4, 5]
    },
    "timezone": "America/New_York"
  }
}
```

## Skills Using Work Busy Calendar

The following DJ skills automatically merge Work Busy events:

### /agenda

Shows work busy blocks alongside personal events and tasks:
```
/agenda today
```

### /findslot

Excludes work busy blocks when finding available time:
```
/findslot 30m today
```

### /timeblock

Avoids work busy blocks when suggesting time blocks:
```
/timeblock "Write report" 2h today
```

## Troubleshooting

### "Work Busy calendar not configured"

```
DJ: I don't have a Work Busy calendar configured. Would you like to set one up?
```

**Fix:** Set the `dj.workBusyCalendarId` config value.

### "Unable to fetch Work Busy events"

```
DJ: Warning: Could not fetch Work Busy calendar events. Proceeding without work schedule visibility.
```

**Causes:**
- Calendar ID is incorrect
- Google Calendar API authentication expired
- Calendar was deleted

**Fix:**
1. Verify calendar ID: `gog calendar list`
2. Re-authenticate: `gog auth login`
3. Check calendar exists in Google Calendar web

### Events Not Merging

If work events aren't appearing in `/agenda`:

1. Check ICS sync: `gog calendar events "<work-busy-id>" --from today`
2. Verify config: `openclaw config get dj.workBusyCalendarId`
3. Check for errors in Gateway logs

## Notes

- This integration uses ICS subscription (read-only) - DJ cannot modify work calendar events
- ICS sync is one-way: Outlook → Google Calendar → DJ
- For bidirectional sync, consider Microsoft Graph API (not covered here)
- Work Busy events are excluded from cost calculations in budget tracking

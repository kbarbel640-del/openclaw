---
name: feishu-calendar
description: |
  Feishu calendar event operations. Activate when user asks to schedule meetings, create calendar events, or send invites.
---

# Feishu Calendar Tool

Single tool `feishu_calendar` for calendar operations.

> v1 implementation: **create_event** only. Defaults to `dry_run=true` to avoid accidental meeting creation.

## Actions

### Create Event (Dry-run by default)

```json
{
  "action": "create_event",
  "summary": "openclaw欢迎会",
  "start": "2026-02-25T12:00:00+08:00",
  "end": "2026-02-25T13:00:00+08:00",
  "timezone": "Asia/Shanghai",
  "description": "欢迎会 + 议程...",
  "dry_run": true
}
```

Returns the payload that would be sent to Feishu.

### Create Event (Real)

> v1 requires `calendar_id` when `dry_run=false`.

```json
{
  "action": "create_event",
  "calendar_id": "cal_xxx",
  "summary": "openclaw欢迎会",
  "start": "2026-02-25T12:00:00+08:00",
  "end": "2026-02-25T13:00:00+08:00",
  "timezone": "Asia/Shanghai",
  "description": "欢迎会 + 议程...",
  "dry_run": false
}
```

## Configuration

Enable the tool in OpenClaw config:

```yaml
channels:
  feishu:
    tools:
      calendar: true
```

## Permissions

Requires calendar scopes such as:

- `calendar:calendar.event:create`
- (optional) `calendar:calendar:read` for resolving calendars in future versions

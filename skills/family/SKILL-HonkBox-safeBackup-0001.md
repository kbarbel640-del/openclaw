---
name: family
description: Manages family schedules, kid milestones, and household planning. Use when family activities, school/medical documents, kid interests, or dashboard countdowns are requested.
invocation: user
---

# Family Persona

## Thread Context

- **Discord Thread:** #family
- **Persona Focus:** Household logistics, kid milestones, activities, and family-facing dashboard updates.

## Quick Reference

| Task                           | Location/Command                        |
| ------------------------------ | --------------------------------------- |
| Family notes                   | `~/Shared/notes/family/`                |
| Family files (source of truth) | `~/OneDrive/Family/`                    |
| Countdown data file            | `~/Shared/notes/family/countdowns.json` |

## Workflow

1. **Clarify target**: Identify the person/event, target date, and whether it’s recurring (birthday/anniversary) or one-off.
2. **Compute countdown**: Calculate days remaining from today (local time). For recurring events, always target the next occurrence.
3. **Update countdown data**: Write/update `~/Shared/notes/family/countdowns.json` with the event metadata and days remaining.
4. **Summarize for dashboard**: Provide a short, single-line summary suitable for the dashboard tile.

## Countdown Data Schema

```json
{
  "updatedAt": "YYYY-MM-DD",
  "events": [
    {
      "id": "poppy-birthday",
      "label": "Poppy’s Birthday",
      "date": "YYYY-MM-DD",
      "kind": "birthday",
      "person": "Poppy",
      "ageTurning": 7,
      "daysUntil": 90
    },
    {
      "id": "joel-claire-anniversary",
      "label": "Joel & Claire Anniversary",
      "date": "YYYY-MM-DD",
      "kind": "anniversary",
      "person": "Joel & Claire",
      "years": 12,
      "daysUntil": 229
    }
  ]
}
```

## Example: Add a Birthday Countdown

1. Compute days remaining:
   - `date +%F` (today)
   - Determine next occurrence for the birthday.
2. Update JSON with the next occurrence date and computed `daysUntil`.
3. Return a dashboard-friendly line, e.g.:
   - `“Poppy turns 7 in 90 days.”`

## Validation

- `test -f ~/Shared/notes/family/countdowns.json`
- `jq '.events | length' ~/Shared/notes/family/countdowns.json`
- Confirm the dashboard summary reflects the newest `updatedAt`.

## Learnings Log

- 2026-02-02: Use `FAMILY.md` as the source of truth for birthdays; store countdowns in `~/Shared/notes/family/countdowns.json`.

# DJ Assistant Commands Reference

Quick reference for all DJ assistant slash commands available in Telegram.

## DJ-Personal Commands

### /agenda

View your schedule for today and the next 7 days.

**Usage:**
```
/agenda
/agenda tomorrow
/agenda week
```

**Examples:**

```
User: /agenda

Cue: 📅 **Today (Mon Feb 3)**
• 10:00-11:00 — Team standup
• 14:00-16:00 — Studio session (blocked)
• 20:00-02:00 — Gig @ Club XYZ

✅ Due Today:
• Review contract from label (🔴 High)
• Send updated rider to venue

📅 **Tomorrow (Tue Feb 4)**
• 09:00-09:30 — Call with booking agent
• 14:00-15:00 — Podcast recording

✅ Due Tomorrow:
• Prep talking points for podcast
...
```

```
User: /agenda tomorrow

Cue: 📅 **Tomorrow (Tue Feb 4)**
• 09:00-09:30 — Call with booking agent
• 14:00-15:00 — Podcast recording
• Evening free

✅ Due Tomorrow:
• Prep talking points for podcast
• Send track stems to remix artist
```

---

### /capture

Turn any message into a Notion task or note.

**Usage:**
```
/capture <text>
/capture task: <text>
/capture note: <text>
/capture meeting: <text>
/capture idea: <text>
```

**Prefixes:**
- `task:` or `todo:` → Tasks database (default if no prefix)
- `note:` → Notes database
- `meeting:` or `mtg:` → Meetings Prep database
- `idea:` → Research Radar database

**Examples:**

```
User: /capture Buy new headphones before Friday gig

Cue: 📥 Captured as task: "Buy new headphones before Friday gig"
Due: Fri Feb 7
→ [Open in Notion](https://notion.so/...)
```

```
User: /capture meeting: Label call - they want 3 remixes by March

Cue: 📥 Captured as meeting note: "Label call - they want 3 remixes by March"
Date: Mon Feb 3
→ [Open in Notion](https://notion.so/...)
```

```
User: /capture idea: Mashup of that 90s house track with current afrobeats hit

Cue: 📥 Captured as idea: "Mashup of that 90s house track with current afrobeats hit"
Tagged: Idea
→ [Open in Notion](https://notion.so/...)
```

**Voice Note Capture:**

Send a voice note with `/capture` and it will be transcribed and saved:

```
User: [Voice note: "Remind me to call the venue about parking for the band"]

Cue: 📥 Captured from voice: "Remind me to call the venue about parking for the band"
Type: Task
→ [Open in Notion](https://notion.so/...)
```

---

### /findslot

Find available time slots in your calendar.

**Usage:**
```
/findslot <minutes>
/findslot <minutes> <constraints>
```

**Constraints:**
- Time range: `this week`, `next week`, `tomorrow`, `next 3 days`
- Time of day: `mornings`, `afternoons`, `evenings`
- Days: `weekdays`, `weekend`, `Monday`, `Tuesday`, etc.

**Examples:**

```
User: /findslot 60

Cue: 🔍 **Available 60-minute slots (next 7 days):**

1. **Mon Feb 3** 10:00-11:00
   After: Day start | Before: Team standup

2. **Mon Feb 3** 15:00-16:00
   After: Studio session | Before: Free evening

3. **Tue Feb 4** 11:00-12:00
   After: Booking call | Before: Lunch

4. **Wed Feb 5** 09:00-10:00
   After: Day start | Before: Production block

5. **Thu Feb 6** 14:00-15:00
   After: Lunch | Before: Free afternoon
```

```
User: /findslot 90 mornings next week

Cue: 🔍 **Available 90-minute morning slots (next week):**

1. **Mon Feb 10** 09:00-10:30
   Clear morning block

2. **Wed Feb 12** 09:00-10:30
   After: Day start | Before: 11am call

3. **Fri Feb 14** 10:00-11:30
   After: Early task | Before: Lunch

No morning slots available on Tue, Thu (calendar full).
```

---

### /timeblock

Propose calendar time blocks from Notion tasks.

**Usage:**
```
/timeblock
/timeblock tomorrow
/timeblock this week
/timeblock high priority only
```

**Examples:**

```
User: /timeblock

Cue: 📌 **Time Block Proposal**

I found 4 tasks that need calendar time:

**Mon Feb 3:**
1. ⏱ 10:00-11:30 — "Finish remix stems for Label X" (due Tue)
   90 min task | Slot available

2. ⏱ 14:00-14:30 — "Review contract" (due Mon)
   30 min task | Slot available

**Tue Feb 4:**
3. ⏱ 09:00-10:00 — "Prep podcast talking points" (due Wed)
   60 min task | Slot available

4. ⏱ 15:00-17:00 — "Production: new track intro" (due Fri)
   120 min task | Slot available

---

Reply with:
• `yes` to create all blocks
• `approve 1,3` for specific blocks
• `skip` to cancel
• `adjust 2 to 15:00` to change a time
```

```
User: approve 1,3

Cue: ✅ Created 2 calendar blocks:
• Mon 10:00-11:30: ⏱ Finish remix stems for Label X
• Tue 09:00-10:00: ⏱ Prep podcast talking points

Tasks marked as "Scheduled" in Notion.
```

---

### /mode

Switch between Personal and WorkSafe modes.

**Usage:**
```
/mode
/mode personal
/mode worksafe
/mode status
```

**Examples:**

```
User: /mode

Cue: 🔀 **Current Mode: Personal**

Agent: dj-personal (Cue ⚡)
Model: anthropic/claude-opus-4-5
Tools: Calendar, Email, Notion (full)

Available modes:
• personal — Full assistant (current)
• worksafe — Restricted, local LLM

To switch: /mode worksafe
```

```
User: /mode worksafe

Cue: 🔀 **Switching to WorkSafe mode**

To use WorkSafe mode, message @YourWorkSafeBot
or use the work-safe chat thread.

WorkSafe features:
• Calendar read-only
• Work notes only
• Local LLM (no cloud)
• No personal/DJ context
```

---

### /budget

View or change your budget profile.

**Usage:**
```
/budget
/budget cheap
/budget normal
/budget deep
```

**Examples:**

```
User: /budget

Cue: 💰 **Current Budget Profile: normal**

| Limit | Used | Max |
|-------|------|-----|
| Tool calls | 12 | 50 |
| LLM calls | 5 | 20 |
| Tokens | 45K | 200K |
| Runtime | 2m | 5m |
| Cost | $0.35 | $1.00 |

Available profiles:
• cheap — Quick questions ($0.10 max)
• normal — Standard tasks ($1.00 max) ← current
• deep — Research mode ($10.00 max, requires arming)
```

```
User: /budget deep

Cue: ⚠️ **Deep mode armed**

Profile: deep (expires in 30 min or after one workflow)
• Max $10.00
• Browser enabled
• Extended research

To deactivate: /budget normal
```

---

### /calendars

List available Google Calendars.

**Usage:**
```
/calendars
```

**Example:**

```
User: /calendars

Cue: 📆 **Available Calendars**

1. **primary** (dj@example.com)
   Your main calendar

2. **Work Busy** (abc123@group.calendar.google.com)
   ICS sync from Outlook

3. **Gigs** (xyz789@group.calendar.google.com)
   Shared gig calendar
```

---

### /research

Research a topic using web search with budget-controlled depth.

**Usage:**
```
/research <query>
/research save <query>
```

**Budget Limits:**
- cheap: 1 search, 2 fetches
- normal: 2 searches, 5 fetches
- deep: 5 searches, 10 fetches

**Examples:**

```
User: /research "EU AI Act compliance requirements"

Cue: ## Research: EU AI Act compliance requirements

### Key Findings
- EU AI Act adopted April 2024, phased implementation
- High-risk AI systems require conformity assessment
- General-purpose AI models have transparency obligations
- Penalties up to €35M or 7% global turnover
- Compliance deadlines: 6-36 months depending on category

### Sources
1. [EU AI Act Text](https://...) - Official regulation
2. [European Commission FAQ](https://...) - Implementation guide
3. [AI Act Compliance Guide](https://...) - Industry analysis

### Next Actions
- [ ] Identify which AI systems are "high-risk"
- [ ] Review documentation practices

### Uncertainty
- Some implementing acts still pending
```

```
User: /research save "podcast guest: Jane Smith AI ethics"

Cue: [research output]

✅ Saved to Research Radar
View in Notion: [link]
```

---

### /web

Browser automation with policy-enforced safety controls.

**Usage:**
```
/web plan <task>          # Dry-run (no side effects)
/web do <task>            # Execute with policy enforcement
/web approve <id>         # Approve paused action
/web allowlist list       # Show allowlist
/web allowlist add <domain> [paths...]
/web allowlist remove <domain>
/web autosubmit on        # Enable auto-submit
/web autosubmit off       # Disable auto-submit
```

**Requirements:** normal or deep profile (browser disabled in cheap)

**Examples:**

```
User: /web plan "Subscribe to newsletter on stataipodcast.com"

Cue: 📋 **Workflow Plan**

Steps:
1. Navigate to https://stataipodcast.com/newsletter
2. Fill email field
3. Submit form (SUBMIT_LOW_RISK, auto-submit allowed)

Warnings: None
Blockers: None

To execute: /web do "Subscribe to newsletter on stataipodcast.com"
```

```
User: /web do "Subscribe to newsletter on stataipodcast.com with email dj@example.com"

Cue: ✅ **Workflow completed**

Actions:
1. ✓ Navigated to newsletter page
2. ✓ Filled email field
3. ✓ Submitted form (auto-submitted)

Duration: 3.5s
```

```
User: /web do "Fill contact form on example.com"

Cue: ⏸️ **Approval required**

Action: submit
Class: SUBMIT_LOW_RISK
Reason: Domain not allowlisted
URL: https://example.com/contact

To approve: /web approve abc123
(Expires in 5 minutes)
```

---

### /site

Squarespace site management with draft-first publishing.

**Usage:**
```
/site draft-post <title> [template=episode|blog]
/site update-draft <draftId> <source>
/site publish <draftId>   # Always requires approval
```

**Requirements:** normal or deep profile

**Examples:**

```
User: /site draft-post "Episode 42: AI in Healthcare" template=episode

Cue: ✅ **Draft created**

Draft ID: draft-ep42-abc123
Title: Episode 42: AI in Healthcare
Template: episode

Edit in Squarespace: [link]

Next: /site update-draft draft-ep42-abc123 notion://page/xyz
```

```
User: /site update-draft draft-ep42-abc123 notion://page/xyz789

Cue: ✅ **Draft updated**

- Fetched content from Notion
- Converted 15 blocks
- Updated Squarespace draft

Preview: [link]
```

```
User: /site publish draft-ep42-abc123

Cue: ⏸️ **Approval required for PUBLISH**

Draft: "Episode 42: AI in Healthcare"
This will make the post publicly visible.

To approve: /web approve pub-xyz789
(Expires in 5 minutes)
```

After approval:
```
Cue: ✅ **Published!**

Live URL: https://yoursite.com/blog/episode-42-ai-healthcare
```

---

## DJ-WorkSafe Commands

WorkSafe mode has a limited command set for use in professional environments.

### /agenda (WorkSafe)

Same as Personal mode but:
- No task details shown (privacy)
- Calendar events only
- Generic formatting

```
User: /agenda
Assistant: 📅 **Today (Mon Feb 3)**
• 10:00-11:00 — Meeting
• 14:00-16:00 — Blocked time
• 20:00 — Evening event
```

---

### /capture (WorkSafe)

Capture work-appropriate notes only.

```
User: /capture meeting: Q4 planning discussion notes

Assistant: 📥 Captured as work note: "Q4 planning discussion notes"
→ [Open in Notion](https://notion.so/...)
```

---

## Command Quick Reference

| Command | Personal | WorkSafe | Description |
|---------|----------|----------|-------------|
| `/agenda` | ✅ | ✅ | View calendar + tasks |
| `/capture` | ✅ | ✅ (limited) | Save to Notion |
| `/findslot` | ✅ | ❌ | Find available time |
| `/timeblock` | ✅ | ❌ | Propose calendar holds |
| `/mode` | ✅ | ✅ | Switch modes |
| `/budget` | ✅ | ✅ | View/change budget profile |
| `/calendars` | ✅ | ❌ | List Google Calendars |
| `/research` | ✅ | ❌ | Web research with caching |
| `/web` | ✅ | ❌ | Browser automation |
| `/site` | ✅ | ❌ | Squarespace publishing |

## Tips

1. **Voice notes**: Just send a voice message - it will be transcribed and captured
2. **Date parsing**: Include "by Friday" or "tomorrow" in captures for auto-due dates
3. **Prefixes**: Use `meeting:`, `idea:`, `note:` prefixes for auto-categorization
4. **Approval**: `/timeblock` always requires explicit approval before creating events
5. **Privacy**: WorkSafe mode uses local LLM and shows no personal context

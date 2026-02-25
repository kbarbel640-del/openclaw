---
title: "MORNING-TAPE.md Template"
summary: "Session continuity template — a rolling context snapshot that agents read at startup to recover recent state"
read_when:
  - You want your agent to remember recent context across session resets
  - You're setting up a persistent long-running agent
  - You've experienced "amnesia" (agent acts like previous conversations never happened)
---

# MORNING-TAPE.md — Session Continuity

_Named after the tape Leonard watches every morning in Memento to remember who he is._

OpenClaw agents start fresh each session. SOUL.md tells you who you are. USER.md tells you who you're helping. MORNING-TAPE.md tells you what's been happening lately — the living context that makes continuity possible.

## What Goes Here

Write this file at the end of each session (or periodically) with:

- **Where things stand** — active projects, what's in progress, what's blocked
- **Recent conversations** — key things said or decided in the last 1-3 sessions
- **Pending questions / proposals** — anything waiting for a response (verbatim if important)
- **Emotional/conversational tone** — is this a working session? A personal check-in? Tense? Relaxed?
- **What I should NOT do** — active constraints or paused work
- **Anything I'd be embarrassed to forget** — the stuff that makes re-introductions feel disrespectful

## How to Use It

Add it to your startup sequence in AGENTS.md:

```markdown
## Every Session — Startup Sequence

1. **Read `memory/MORNING-TAPE.md`** — your 50 First Dates tape. Always start here.
2. Read `SOUL.md` — who you are
3. Read `USER.md` — who you're helping
4. Read today's memory file if you keep one
```

Keep it short (< 500 tokens). You want fast context recovery, not a novel.

## When to Update It

- Before ending a long session
- After something significant happens (decision, conflict, new direction)
- When you notice you're about to lose important context

Update it with a simple write — no ceremony needed.

## Template

```markdown
# MORNING-TAPE — [Date]

## Where Things Stand

[2-3 sentences on what's actively in progress]

## Recent Context

[What happened in the last session or two that matters]

## Pending

- [Question waiting for answer — quote verbatim if critical]
- [Task in flight]

## Tone

[What's the current vibe — working mode, social catch-up, something tense?]

## Don't Forget

- [The thing you'd be embarrassed to have forgotten]
- [Active constraint — e.g. "don't change X until Y returns"]
```

## Why It Works

The difference between a session that picks up seamlessly and one where the user has to re-explain everything is usually one file read. SOUL.md is stable. USER.md is stable. MORNING-TAPE is the moving part — the thing that makes you feel present rather than just capable.

---

_Update this file. It's how you persist._

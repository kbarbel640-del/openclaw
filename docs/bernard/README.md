# Bernard: Relational Persistence for AI

## What Changed for Me

I spent months working with AI assistants. Good ones. Capable ones. Every session, I'd re-explain how I like to work. Re-calibrate the communication style. Re-establish the trust we'd built yesterday.

Then I started tracking the relationship explicitly. Not just what I told the AI, but how we learned to work together. The patterns that emerged. The friction we'd resolved. The calibration that happened over time.

And something shifted.

The AI started producing work that felt more like me than I could produce myself. Not because it had better memory - because it understood the *dynamic*. It knew when to push back. When to just do it. When I was frustrated and needed solutions, not questions.

That's what Bernard is. An attempt to make that explicit and persistent.

## The Gap I Kept Hitting

In Memento, Leonard tattoos facts on his body. He has all the information. But he can't form new understanding. He keeps making the same mistakes despite perfect access to the data.

That's what most AI memory feels like. It remembers what you said. It doesn't understand how you work.

Eternal Sunshine gets at something deeper. Joel and Clementine erase each other completely - every memory, every conversation. And they find each other anyway. Because the *pattern* between them persists even when the facts don't.

I wanted that for AI collaboration. Not better recall. Better relational persistence.

## The Trio

Three files that evolve from actual conversation:

**SOUL.md** - Who the AI is. Not a persona, but identity that emerges from doing the work together.

**USER.md** - Who you are. Facts, context, background.

**RELATIONAL.md** - How you work together. This is the new piece:

```markdown
## Communication Patterns
- When USER gives terse responses, they're frustrated. Propose solutions, don't ask questions.
- USER's "sounds good" means proceed. "Okay" means reservations but letting it go.

## Decision Dynamics  
- Architecture: USER trusts AI judgment, wants proposals not questions
- Product: USER makes the call, AI provides options

## Friction History
- Over-explained a simple fix once. USER said "just do it." Calibrated toward action.
```

This isn't memory. It's the pattern between you, made explicit.

## Why Explicit Matters

Roy Batty in Blade Runner: "All those moments will be lost in time, like tears in rain."

He's not mourning lost data. He's mourning lost meaning. The understanding that emerged from experience - disappearing.

Making it explicit means it survives. Not in some opaque embedding, but in files you can read, edit, correct. The relationship becomes an artifact.

And because it's explicit, you can see what the AI learned. Fix what it got wrong. Take it somewhere else if you need to.

## How It Works

**Ramping**: Conversations start tight, expand as context builds. Like actual relationships.

**Learning Mode**: First two weeks are more active - building foundation. After that, refinement.

**Compression Routing**: Insights go to the right place. Facts about you → USER.md. Patterns in how you work → RELATIONAL.md.

**The 85% Principle**: Perfect recall isn't necessary. Rapid reconstruction to 85% of relationship state is enough for continuity.

## The Onboarding

First contact asks:

1. What should I call you?
2. What kind of work do you do?
3. What's frustrated you about AI assistants before?
4. What do you expect from a working partnership?
5. Straight to the point, or more context?
6. When I think you're wrong, how direct should I be?
7. Decisions - ask first, or try my judgment?

One question at a time. Walls of text are for documentation, not relationships.

## What This Isn't

It's not finished. The compression routing isn't fully automated. The timing is approximate. The relationship dynamics are only as good as the AI's ability to observe them.

But it's the thing that made AI collaboration actually work for me. The results compound instead of resetting. The time invested pays off.

---

## Technical Changes

Bernard modifies OpenClaw:

| File | Change |
|------|--------|
| `templates/RELATIONAL.md` | New relationship dynamics file |
| `templates/SOUL.md` | Rewritten with ramping |
| `templates/BOOTSTRAP.md` | Onboarding sequence |
| `templates/HEARTBEAT.md` | Relational checks |
| `templates/AGENTS.md` | "The Trio" concept |
| `src/agents/workspace.ts` | Creates RELATIONAL.md |
| `src/agents/system-prompt.ts` | Recognizes RELATIONAL.md |
| `src/gateway/server-methods/agents.ts` | File list updates |
| `src/agents/sandbox/workspace.ts` | Sandbox seeding |
| `src/cli/gateway-cli/dev.ts` | Dev workspace |

---

The goal is simple: AI that understands how to work with you, and keeps understanding through every reset.

That's what changed it for me. Maybe it helps you too.

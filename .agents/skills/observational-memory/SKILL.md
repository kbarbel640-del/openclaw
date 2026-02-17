---
name: observational-memory
description: >
  Observational Memory (OM) for OpenClaw. Implements the Observer/Reflector pattern
  inspired by Mastra's SOTA memory system. Background compression of conversation
  history into dense, dated, emoji-prioritized observation logs that live in MEMORY.md
  and are auto-injected into context on every turn. The agent never explicitly queries
  or writes to memory — it remembers effortlessly. Achieves 5-40x token compression
  while preserving critical details. Use this skill to maintain long-running context
  across sessions without context rot.
metadata:
  openclaw:
    emoji: "🧠"
    requires:
      env:
        - OBSERVATIONAL_MEMORY_MODEL
        - OBSERVATIONAL_MEMORY_PROVIDER_API_KEY
      bins: []
    config:
      observationThresholdTokens:
        type: number
        default: 30000
        description: "Token count that triggers the Observer to compress messages"
      reflectionThresholdTokens:
        type: number
        default: 40000
        description: "Token count in observations that triggers the Reflector to condense"
      observerModel:
        type: string
        default: "google/gemini-2.5-flash"
        description: "Model used for Observer and Reflector background agents"
      scope:
        type: string
        default: "thread"
        enum: ["thread", "resource"]
        description: "thread = per-session observations, resource = shared across sessions"
tools:
  - Bash
  - Read
  - Write
---

# Observational Memory (OM) for OpenClaw

## What This Does

This skill implements the Observer/Reflector memory pattern. Instead of relying on
OpenClaw's default compaction (which does lossy summarization) or explicit memory writes,
two background processes maintain a dense observation log:

1. **Observer**: When unobserved message tokens exceed a threshold (~30k), compresses
   raw messages into dated, emoji-prioritized observations
2. **Reflector**: When observations grow past a second threshold (~40k tokens), condenses
   old observations further — merging related entries, dropping irrelevant ones

Observations are written to the `## Observations` section of `MEMORY.md`, which means
they are **automatically injected into the agent's context on every turn** without any
retrieval step. The agent sees them as part of its own memory — it never needs to query
or write to memory explicitly.

## Observation Format

Observations use a three-date model and emoji priority levels:

```
## Observations

### 2026-02-16 (today)
- 🔴 14:10 User is building a Next.js app with Supabase auth, due Feb 23
- 🔴 14:10 App uses server components with client-side hydration
- 🟡 14:12 User asked about middleware configuration for protected routes
- 🔴 14:15 User stated the app name is "Acme Dashboard"
- 🟢 14:20 Discussed trade-offs of JWT vs session-based auth

### 2026-02-15 (yesterday, referenced: 2026-02-10)
- 🔴 09:00 Project deadline moved from Feb 20 to Feb 23 (referenced in Slack)
- 🟡 09:15 User prefers Tailwind over styled-components
```

Priority levels:

- 🔴 **Critical** — facts, decisions, deadlines, names, stated preferences
- 🟡 **Relevant** — questions asked, options considered, context that may matter
- 🟢 **Info only** — background context, low-priority details

## How It Hooks Into OpenClaw

### Automatic Observation (Pre-Compaction)

The skill replaces the default `memoryFlush` behavior. Instead of generic "save memories"
instructions, it runs the Observer script which:

1. Reads the current session transcript
2. Identifies unobserved messages (those added since last observation)
3. Calls a background LLM to compress them into observations
4. Writes the observations to the `## Observations` section of `MEMORY.md`
5. Returns `NO_REPLY` so the user sees nothing

### Configuration

Add to your `openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "compaction": {
        "reserveTokensFloor": 20000,
        "memoryFlush": {
          "enabled": true,
          "softThresholdTokens": 6000,
          "systemPrompt": "Session nearing compaction. Run the observational-memory observer now. Write compressed observations to MEMORY.md under ## Observations. Reply with NO_REPLY.",
          "prompt": "Run: bash scripts/observer.sh && reply NO_REPLY"
        }
      }
    }
  },
  "skills": {
    "entries": {
      "observational-memory": {
        "enabled": true,
        "config": {
          "observationThresholdTokens": 30000,
          "reflectionThresholdTokens": 40000,
          "observerModel": "google/gemini-2.5-flash"
        },
        "env": {
          "OBSERVATIONAL_MEMORY_MODEL": "google/gemini-2.5-flash",
          "OBSERVATIONAL_MEMORY_PROVIDER_API_KEY": "${GOOGLE_API_KEY}"
        }
      }
    }
  }
}
```

### Cron-Based Reflection

For the Reflector (which condenses old observations), add a cron job:

```json
{
  "cron": {
    "jobs": [
      {
        "id": "om-reflector",
        "schedule": "0 */4 * * *",
        "command": "bash ~/clawd/skills/observational-memory/scripts/reflector.sh",
        "description": "Condense old observations when they exceed threshold"
      }
    ]
  }
}
```

## Important Notes

- **MEMORY.md size**: Observations are injected via MEMORY.md, which is capped at
  `bootstrapMaxChars` (default 20,000 chars). The Reflector keeps observations under
  this limit. If you have existing MEMORY.md content, reduce the observation budget
  accordingly.
- **Private sessions only**: MEMORY.md is only loaded in private sessions, never in
  group contexts. This is a security feature — observations may contain sensitive info.
- **Prompt caching**: Because observations form a stable prefix in MEMORY.md that only
  changes when the Observer runs, they are highly cache-friendly with Anthropic's
  prompt caching.
- **Compaction still runs**: This skill doesn't disable OpenClaw's compaction — it runs
  _before_ compaction to ensure critical context is preserved as observations. After
  compaction, the observations survive in MEMORY.md while raw messages are summarized.

## Manual Commands

- `/observe` — Force an observation pass on the current session
- `/reflect` — Force a reflection pass to condense old observations
- `/om-status` — Show observation stats (token counts, last run times)

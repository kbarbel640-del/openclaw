---
name: bootstrap-executor
description: "Injects BOOTSTRAP.md execution instruction into new sessions"
metadata: { "openclaw": { "emoji": "🚀", "events": ["command:new", "command:reset"] } }
---

# Bootstrap Executor

Ensures BOOTSTRAP.md is actually executed when a new session starts.

## What It Does

When `/new` or `/reset` is issued, this hook adds a system message reminding the agent to read and execute BOOTSTRAP.md before responding.

## Why

BOOTSTRAP.md is injected into the system prompt, but the agent doesn't automatically execute its instructions. This hook adds an explicit reminder.

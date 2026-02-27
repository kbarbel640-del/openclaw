---
name: skill-usage-tracker
description: Track OpenClaw skill invocation counts and export usage reports.
metadata: { "openclaw": { "emoji": "📊", "skillKey": "skill-usage-tracker" } }
---

# Skill Usage Tracker

This skill documents the built-in usage telemetry for OpenClaw skills.

## What Gets Counted

- Explicit skill command invocations (for example `/skill foo ...` or `/<skill-command> ...`)
- Mapped tool calls inferred from tool-event streams
- Newly discovered or installed skills are auto-registered with zero counts

## View Usage

Use the CLI command:

```bash
openclaw skills usage
```

## Export Formats

```bash
openclaw skills usage --format json
openclaw skills usage --format csv
openclaw skills usage --format markdown
```

## Filters

```bash
openclaw skills usage --top 20
openclaw skills usage --since 2026-02-26T00:00:00Z
```

---
summary: "Install and enable OpenClaw safe operations plus skill usage tracking."
read_when:
  - You want to share safety and usage features with others
  - You need a minimal setup checklist for a fresh machine
title: "Safe Ops and Skill Usage Quickstart"
---

# Safe Ops and Skill Usage Quickstart

This guide helps you ship and consume two features together:

- Safe operations guardrail (`openclaw-safe-ops`)
- Skill usage tracking (`openclaw skills usage`)

## Scope and safety defaults

Only share these artifacts:

- `scripts/openclaw-safe.sh`
- `skills/openclaw-safe-ops/SKILL.md`
- `skills/skill-usage-tracker/SKILL.md`
- `src/agents/skills-usage-store.ts`
- `src/agents/skills-usage-tracker.ts`
- `src/auto-reply/reply/get-reply-inline-actions.ts`
- `src/commands/agent.ts`
- `src/cli/skills-cli.ts`
- Related tests under `src/agents`, `src/cli`, and `src/commands`
- `openclaw.example.json` (template only)

Never share local runtime state such as `~/.openclaw/openclaw.json` or any real credentials.

## Install

```bash
pnpm install
```

Optional alias for safer high-risk operations:

```bash
alias ocl-safe="/absolute/path/to/openclaw/scripts/openclaw-safe.sh"
```

## Configure (template-first)

Copy from template and fill your own values:

```bash
cp openclaw.example.json ~/.openclaw/openclaw.json
```

Then replace placeholders with real values on the target machine.

## Use

- Run high-risk changes through wrapper:
  - `ocl-safe gateway restart`
  - `ocl-safe config set ...`
  - `ocl-safe plugins update ...`
- Check usage counters:
  - `openclaw skills usage`
  - `openclaw skills usage --format json`
  - `openclaw skills usage --format markdown`

Related:

- [skills CLI](/cli/skills)
- [Skills](/tools/skills)
- [ClawHub](/tools/clawhub)

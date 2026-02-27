---
summary: "Release scope lock for shipping only safe-ops and skill-usage features."
read_when:
  - You want to prevent unrelated changes from being published
  - You need a whitelist before creating release commits
title: "Safe Ops and Skill Usage Scope Lock"
---

# Safe Ops and Skill Usage Scope Lock

Use this whitelist before commit and release.

## Include

- `scripts/openclaw-safe.sh`
- `skills/openclaw-safe-ops/SKILL.md`
- `skills/skill-usage-tracker/SKILL.md`
- `src/agents/skills-usage-store.ts`
- `src/agents/skills-usage-tracker.ts`
- `src/agents/skills/workspace.ts`
- `src/agents/skills-install.ts`
- `src/auto-reply/reply/get-reply-inline-actions.ts`
- `src/commands/agent.ts`
- `src/gateway/server.impl.ts`
- `src/cli/skills-cli.ts`
- `src/agents/skills-usage-store.test.ts`
- `src/agents/skills-usage-tracker.test.ts`
- `src/commands/agent.test.ts`
- `src/cli/skills-cli.usage.test.ts`
- `openclaw.example.json`
- `docs/safe-ops-and-skill-usage/*`

## Exclude

- Any file under `.cursor/`
- Any file under `~/.openclaw/`
- Temporary logs and local scripts
- Unrelated feature branches and experiments

## Quick check

Before release:

```bash
git status --short
git diff --name-only
```

If any changed file is outside the include list, stop and split the release.

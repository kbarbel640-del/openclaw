---
summary: "Security rules for shipping safe operations and skill usage tracking."
read_when:
  - You are preparing a public release
  - You need to avoid leaking local credentials or runtime state
title: "Safe Ops and Skill Usage Security"
---

# Safe Ops and Skill Usage Security

Use these rules when sharing to GitHub or ClawHub.

## Never publish local runtime state

Do not publish:

- `~/.openclaw/openclaw.json`
- `~/.openclaw/credentials/*`
- `~/.openclaw/sessions/*`
- Any file containing real tokens, phone numbers, or hostnames

Publish only `openclaw.example.json` as a template.

## Keep release scope minimal

Only include files required by:

- Safe operations workflow (`openclaw-safe-ops`)
- Skill usage tracker and CLI output

Exclude unrelated experiments, local plan files, and temporary scripts.

## Required guardrails

- For risky actions, prefer `scripts/openclaw-safe.sh`.
- Run verification checklist before every release.
- Fail closed: if verification fails, do not publish.

## Release wording consistency

Use the same release summary for GitHub and ClawHub:

- What is included
- How to verify
- Known boundaries (for example, shell-based skills may have lower mapped-tool attribution)

This keeps user expectations aligned across channels.

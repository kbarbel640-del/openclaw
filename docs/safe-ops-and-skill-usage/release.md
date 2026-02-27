---
summary: "Publish checklist for GitHub and ClawHub with a single version and release note."
read_when:
  - You are publishing these two features externally
  - You need a consistent release process across channels
title: "Safe Ops and Skill Usage Release"
---

# Safe Ops and Skill Usage Release

This checklist keeps GitHub and ClawHub releases consistent.

## Pre-release checks

1. Run tests for skill usage changes.
2. Run the verification checklist from [Verification](/safe-ops-and-skill-usage/verify).
3. Confirm no secrets or local state files are included.

## Versioning

Use one version string for both channels (for example `2026.2.27-safe-ops-skill-usage.1`).

## Release note template

Use the exact same note on both GitHub and ClawHub:

```text
Includes:
- Safe operations guardrail via openclaw-safe-ops and scripts/openclaw-safe.sh
- Skill usage tracking with JSON diagnostics (mapped/unmapped split + attribution strategy version)

Verification:
- openclaw-safe.sh --dry-run gateway restart
- openclaw skills usage
- openclaw skills usage --format json
- openclaw skills usage --format markdown
- one explicit skill command run confirms commandCalls increments

Known boundaries:
- Shell-based skills may show low mappedToolCalls because they do not dispatch OpenClaw tools directly.
```

## Publish steps

### GitHub

1. Create tag from the verified commit.
2. Create release with the shared release note.
3. Attach verification output if required by your workflow.

### ClawHub

1. Publish using the same version string.
2. Paste the same release note text.
3. Confirm install and update metadata is visible.

## Post-release sanity

- Install from GitHub path and run verification.
- Install from ClawHub path and run verification.
- Compare outputs; they must match the same feature set.

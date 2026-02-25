---
name: refining-designs
description: Refines UI/CSS layouts via sequential multi-reviewer critique loops. Use when iterating on design quality, layout polish, or visual hierarchy.
invocation: user
arguments: "[target=. ] [reviewers=default] [max_rounds=3] [artifact_glob=/tmp/.../*.png]"
---

# Refining Designs

Iterative design refinement using sequential reviewer critiques, structured issue tracking, and re-render loops.

## Quick Reference

| Input           | Default          | Notes                                    |
| --------------- | ---------------- | ---------------------------------------- |
| `target`        | `.`              | Project or layout root directory         |
| `reviewers`     | `default`        | Comma-separated list, or `default` order |
| `max_rounds`    | `3`              | Safety cap on iterations                 |
| `artifact_glob` | `/tmp/.../*.png` | Glob for preview images                  |

## Default Reviewers

`claude-opus-4.5`
`gpt-5.2`
`gemini-3-pro-preview`
`delegate`

## Workflow

1. Preparation. Confirm `target`, identify the render command, and set `artifact_glob`.
2. Capture artifacts. Render and export images that match `artifact_glob`.
3. Review loop. For each reviewer in order, send the review prompt with images, log feedback, convert feedback into issues with severity, fix all Critical and Major items, then re-render.
4. Stop condition. Stop when all reviewers report zero Critical issues, or when `max_rounds` is reached.
5. Report. Summarize fixes and remaining issues. Do not show user previews until Critical issues are cleared.

## Review Prompts

See `references/review-prompts.md`.

## Review Logs

Always save review logs to `~/Desktop/docs/` using:
`refining-designs-YYYY-MM-DD-<reviewer>.md`

See `references/review-log-template.md`.

## Tooling

Use the highest-signal models first and provide images with every review request.

Example commands:
`copilot -p "$PROMPT" --model claude-opus-4.5 --allow-all-tools`
`copilot -p "$PROMPT" --model gpt-5.2 --allow-all-tools`
`copilot -p "$PROMPT" --model gemini-3-pro-preview --allow-all-tools`
`node ~/OneDrive/skills/delegate/scripts/copilot-delegate.mjs --prompt "$PROMPT"`

## Verification

1. `ls $artifact_glob` returns images.
2. All reviewers report zero Critical issues.
3. `max_rounds` not exceeded unless explicitly overridden.

# Orchestrator Mode — Agent Guidelines

Use this short mode file when operating in Orchestrator mode (coordination, cross-repo thinking, release checks).

- When to switch into Orchestrator mode
  - You need to coordinate multiple files, scripts, or subprojects (examples: release prep, plugin dependency updates, multi-package refactor).
  - You're summarizing repository state for engineers or creating PR checklists.

- Mode expectations
  - Be conservative: propose changes, list impacted files, then ask to apply edits.
  - Prefer small, testable edits. When a change touches many packages, produce a clear plan and a staged todo list.

- Quick checklist for Orchestrator edits
  - Read `AGENTS.md` and `docs/` relevant pages.
  - Run `pnpm install` then `pnpm check` locally before making formatting or lint fixes.
  - Run `pnpm test` (or `pnpm test:coverage`) to detect regressions.
  - Use `scripts/committer` to create commits when ready; include test results in the PR description.

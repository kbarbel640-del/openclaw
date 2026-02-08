# Fork Purpose

This repository is a personal fork of [openclaw/openclaw](https://github.com/openclaw/openclaw).

## Goal

- Pick a beginner-friendly or small bug from [upstream issues](https://github.com/openclaw/openclaw/issues) labeled `bug`.
- Fix the bug on a dedicated branch and submit a Pull Request to the upstream repository.
- Scope is limited to **bug fixes only**. Feature requests and other issue types are out of scope.

## Workflow

1. Browse open issues filtered by the [`bug` label](https://github.com/openclaw/openclaw/labels/bug) and select one that is clearly scoped and reproducible.
   - Upstream uses a "Bug report" issue template (`.github/ISSUE_TEMPLATE/bug_report.md`) which auto-labels issues as `bug`.
2. Read the upstream CONTRIBUTING.md and Security Policy before starting (see `issue-tracking.md`).
3. Create a working branch from the latest `main` (see `source-control.md`).
4. Implement the fix, add or update tests as needed, and run the full gate (`pnpm build && pnpm check && pnpm test`).
5. Write a clear commit message referencing the issue number (e.g., `fix: resolve X (#123)`).
6. Open a PR against the upstream repository following the upstream PR guidelines (`docs/help/submitting-a-pr.md`).

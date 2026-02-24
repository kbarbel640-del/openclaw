# Orchestrator / AI Agent Instructions — OpenClaw

Purpose: give an AI Orchestrator agent the minimal, actionable knowledge to be productive in this repository.

- Quick start (first reads)
  - Read `AGENTS.md` (root) for repository-wide rules and workflows.
  - Inspect `src/` and `extensions/*` to learn core vs plugin boundaries (channels live in `src/*`, plugins in `extensions/*`).
  - Open `docs/` for Mintlify linking rules and i18n notes.

- Essential commands (use these exactly when running tasks)
  - Install deps: `pnpm install` (or `bun install` for faster TS script execution).
  - Build: `pnpm build`
  - Typecheck: `pnpm tsgo`
  - Lint/format checks: `pnpm check`
  - Fix formatting: `pnpm format:fix`
  - Tests: `pnpm test` (Vitest). Live tests use env flags: `CLAWDBOT_LIVE_TEST=1 pnpm test:live`.
  - Dev CLI: `pnpm openclaw ...` or `pnpm dev` (many scripts assume Bun is available).

- Orchestrator responsibilities (what this agent should focus on)
  - Coordinate multi-step developer workflows: install, build, test, format, and release checks.
  - Aggregate context from `src/` and `extensions/*` when producing code changes, PR text, or docs updates.
  - Prefer minimal, surgical edits; when in doubt, propose changes and ask for confirmation before applying broad refactors.

- Project structure & architecture notes (big picture)
  - Core runtime and CLI live under `src/` (CLI wiring in `src/cli`, commands in `src/commands`).
  - Messaging channels: core channel code is in `src/telegram`, `src/discord`, `src/slack`, `src/signal`, `src/imessage`, `src/web`, and routed via `src/channels` / `src/routing`.
  - Extensions are workspace packages under `extensions/*` (runtime plugins). Keep extension-only deps in the extension's `package.json`.
  - Docs are the authoritative surface (Mintlify). Generated `docs/zh-CN` should not be hand-edited.

- Coding conventions and gotchas (practical, repository-specific)
  - TypeScript ESM with strict typing; avoid adding `any` or `@ts-nocheck`.
  - Formatting is enforced by Oxlint/Oxfmt. Always run `pnpm check` before committing.
  - Do not change `workspace:*` dependencies in packages; prefer `peerDependencies`/`devDependencies` per `AGENTS.md` guidance.
  - Avoid prototype mutation; prefer explicit inheritance or composition.

- Release & PR workflow highlights
  - Use `scripts/committer "<msg>" <file...>` to produce commits that match project expectations.
  - Keep commits focused and follow Conventional Commit style when applicable.

- Useful code pointers
  - CLI progress/spinners: `src/cli/progress.ts`.
  - Terminal tables & status formatting: `src/terminal/table.ts`.
  - CI and test patterns: `vitest.*.config.ts` files at repo root.

- Multi-agent and safety notes
  - Never create or apply `git stash` entries unless explicitly requested.
  - Do not switch branches or modify worktrees without user approval.
  - For formatting-only fixes, auto-stage and include in the same commit if appropriate.

If you want this file expanded to include example PR templates, commit samples, or a short checklist for releases, tell me which section to expand.

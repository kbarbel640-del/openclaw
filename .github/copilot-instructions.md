# Copilot / AI Agent Instructions — OpenClaw

Purpose: give an AI coding agent the minimal, actionable knowledge to be productive in this repository.

- Quick start (first reads)
  - Read `AGENTS.md` (root) for repository-wide rules and workflows.
  - Inspect `src/` and `extensions/*` to learn core vs plugin boundaries (channels live in `src/*`, plugins in `extensions/*`).
  - Open `docs/` for Mintlify linking rules and i18n notes.

- Essential commands
  - Install deps: `pnpm install` (or `bun install` for faster TS script execution).
  - Build: `pnpm build`
  - Typecheck: `pnpm tsgo`
  - Lint/format checks: `pnpm check`
  - Fix formatting: `pnpm format:fix`
  - Tests: `pnpm test` (Vitest). Live tests use env flags: `CLAWDBOT_LIVE_TEST=1 pnpm test:live`.
  - Dev CLI: `pnpm openclaw ...` or `pnpm dev` (many scripts assume Bun is available).

- Project structure & architecture notes (big picture)
  - Core runtime and CLI live under `src/` (CLI wiring in `src/cli`, commands in `src/commands`).
  - Messaging channels: core channel code is in `src/telegram`, `src/discord`, `src/slack`, `src/signal`, `src/imessage`, `src/web`, and routed via `src/channels` / `src/routing`.
  - Extensions are workspace packages under `extensions/*` (runtime plugins). Keep extension-only deps in the extension's `package.json`.
  - Docs are the authoritative surface (Mintlify). Generated `docs/zh-CN` should not be hand-edited.

- Coding conventions and gotchas
  - Language: TypeScript (ESM). Prefer strict typing; avoid `any` and `@ts-nocheck`.
  - Formatting: use Oxfmt + Oxlint. Run `pnpm check` before commits.
  - Never edit `node_modules`.
  - Avoid `workspace:*` in a package's `dependencies`; follow `AGENTS.md` guidance for plugin deps (use `peerDependencies`/`devDependencies` as appropriate).
  - Do not mutate prototypes for behavior; prefer explicit inheritance/composition.

- Tests and CI patterns
  - Tests colocated as `*.test.ts` and e2e as `*.e2e.test.ts`.
  - Vitest is used across the repo; coverage thresholds are enforced in CI.
  - Live/provider tests require explicit env flags and are separate from fast unit runs.

- Release & version notes
  - Version locations: `package.json`, mobile app Info.plists, `apps/*` manifests — see `AGENTS.md` list. Do NOT change `appcast.xml` except when cutting a Sparkle macOS release.
  - Follow `docs/reference/RELEASING.md` and `docs/platforms/mac/release.md` for release steps.

- PR / commit workflow
  - Use `scripts/committer "<msg>" <file...>` to create commits that match project expectations.
  - Keep commits scoped and descriptive; use Conventional Commit style when appropriate.

- Where agents should look for examples
  - CLI progress/spinners: `src/cli/progress.ts`.
  - Terminal tables & status formatting: `src/terminal/table.ts`.
  - Scripts and packaging helpers: `scripts/` (mac packaging, bundling helpers).

- Multi-agent and safety notes
  - Do NOT create or apply `git stash` entries unless requested. Do not switch branches without explicit permission.
  - If making formatting-only fixes, auto-stage them and include in the same commit where sensible.

If anything in this file is unclear or you want more detail (examples or file pointers), tell me which section to expand. 

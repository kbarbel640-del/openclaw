# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Full conventions and rules:** see `AGENTS.md` (commit workflow, release process, macOS ops, multi-agent safety, tool schema guardrails, docs i18n, security advisories, etc.).

## Project

OpenClaw is a personal AI assistant platform in TypeScript (ESM) that orchestrates AI agents across 15+ messaging channels (Telegram, Discord, Slack, WhatsApp, Signal, iMessage, Teams, Matrix, IRC, etc.).

## Environment

- **Package manager:** pnpm 10.23.0 (`pnpm-lock.yaml` is the lockfile)
- **Runtime:** Node 22+ (Bun also supported for scripts/dev/tests)

## Key Commands

```sh
pnpm install           # Install deps
pnpm build             # Full build (tsdown → dist/)
pnpm check             # Lint + format check (oxlint + oxfmt)
pnpm format:fix        # Auto-fix formatting (oxfmt --write)
pnpm tsgo              # TypeScript strict type-check
pnpm test              # All tests (vitest, parallel)
pnpm test:coverage     # Tests with V8 coverage (70% threshold)
pnpm test:fast         # Unit tests only
pnpm openclaw ...      # Run CLI in dev mode (via bun/tsx)
pnpm gateway:watch     # Dev gateway with hot reload
```

## Architecture Overview

**Monorepo layout:**
- `src/` — Core TypeScript source (~70 modules)
  - `src/cli/` — Commander-based CLI; dependency injection via `createDefaultDeps` in `src/cli/deps.ts`
  - `src/commands/` — Individual CLI commands (gateway, agent, send, doctor, wizard, etc.)
  - `src/gateway/` — WebSocket control plane; sessions, auth, channels, webhooks, Canvas host
  - `src/agents/` — Pi agent runtime, tool definitions, skill loading, sandbox
  - `src/channels/` — Shared channel abstractions, routing, allowlists, pairing
  - `src/telegram/`, `src/discord/`, `src/slack/`, `src/whatsapp/`, etc. — Core channel implementations
  - `src/config/` — Config schema (Zod), session/state management (`~/.openclaw/`)
  - `src/infra/` — Runtime guards, binary management, error types, port utilities
  - `src/media/` — Image/audio/video pipeline, transcription hooks
  - `src/memory/` — Memory plugins (Postgres, SQLite, semantic search)
  - `src/plugins/` — Plugin SDK, lifecycle, loading
  - `src/terminal/` — ANSI-safe tables, color palette (`src/terminal/palette.ts` — use this, no hardcoded colors)
  - `src/cli/progress.ts` — Spinner/progress bars (`osc-progress` + `@clack/prompts`)
- `extensions/` — 39 workspace packages for pluggable channels (Matrix, Teams, Zalo, IRC, Line, etc.)
- `skills/` — ~54 bundled user-facing agent skills
- `packages/` — Companion packages (clawdbot, moltbot)
- `apps/` — Companion apps (iOS, Android, macOS menu bar)
- `ui/` — Web control UI (Lit web components)
- `docs/` — Mintlify documentation (hosted at docs.openclaw.ai)
- `dist/` — Built output (tsdown, ~733 hashed JS bundles)
- `scripts/` — Build, release, deployment scripts

**Data flow:** CLI commands → gateway (WebSocket control plane) → Pi agent runtime → channel adapters → messaging platforms. Config/sessions stored in `~/.openclaw/`.

**Key conventions:**
- Colocated tests (`*.test.ts`); e2e tests use `*.e2e.test.ts`
- Files target ~500–700 LOC; split rather than create "V2" copies
- Use `stringEnum`/`Type.Optional` in tool schemas; avoid `Type.Union`/`anyOf`/`oneOf`
- Commits via `scripts/committer "<msg>" <file...>` (not manual `git add`/`git commit`)
- Product name: **OpenClaw** in docs/UI; `openclaw` for CLI/packages/config/paths
- Version is date-based: `YYYY.M.D` (e.g. `2026.2.20`)

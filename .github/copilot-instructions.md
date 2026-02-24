# OpenClaw — Copilot Instructions

## Architecture Overview

OpenClaw is a personal AI assistant gateway. The core flow: **messaging channel → gateway → AI provider → response back to channel**.

- **Gateway** (`src/gateway/`): WebSocket + HTTP server, session/agent management, auth, config reload, plugin routing. Entry: `src/gateway/server.ts` → `server.impl.ts`.
- **Channels** (`src/channels/`, `src/telegram/`, `src/discord/`, `src/slack/`, `src/signal/`, `src/imessage/`, `src/web/`, `src/whatsapp/`): Built-in messaging adapters implementing `ChannelMessagingAdapter` and related interfaces from `src/plugin-sdk/`.
- **Extensions** (`extensions/*/`): Channel plugins (msteams, matrix, zalo, voice-call, etc.) — separate `package.json` per plugin; runtime deps in `dependencies`, not `devDependencies`. Resolved via jiti alias `openclaw/plugin-sdk`.
- **Routing** (`src/routing/`): Dispatches inbound messages to the right agent/channel.
- **CLI** (`src/cli/`, `src/commands/`): Commander-based; uses `createDefaultDeps` for dependency injection.
- **Config** (`src/config/`): Plain TypeScript types (`types.gateway.ts`) + Zod schema (`zod-schema.ts`). Key types: `GatewayConfig`, `GatewayAuthConfig`, `GatewayAuthMode`.
- **Sessions**: Pi-style session transcript stored as a `parentId` DAG under `~/.openclaw/sessions/`. Always write via `SessionManager.appendMessage()` — never raw JSONL writes.

## Essential Commands

```bash
pnpm install          # Install deps
pnpm build            # Type-check + build → dist/
pnpm tsgo             # TypeScript check only
pnpm check            # Lint + format (Oxlint + Oxfmt) — run before commits
pnpm format:fix       # Auto-fix formatting
pnpm test             # Vitest unit tests
pnpm test:coverage    # With V8 coverage
pnpm openclaw ...     # Run CLI in dev (via Bun)
```

Commit via `scripts/committer "<msg>" <file...>` — never `git add`/`git commit` directly (except in interactive human sessions).

## Project Conventions

- **TypeScript ESM strict** — `.js` extensions on all local imports (`from "./auth.js"`), `import type` for type-only imports.
- **No re-export wrapper files** — import directly from the source module.
- **Formatting/linting**: Oxlint + Oxfmt; `pnpm check` must pass before committing.
- **File size**: aim for ~500–700 LOC max; extract helpers rather than appending.
- **Tests**: colocated `*.test.ts`; E2E in `*.e2e.test.ts`; live tests need `CLAWDBOT_LIVE_TEST=1`.
- **No `any`**: use strict types; infer or assert where needed.

## Source of Truth for Common Utilities

| Need                     | Location                                                    |
| ------------------------ | ----------------------------------------------------------- |
| Time/duration formatting | `src/infra/format-time`                                     |
| Terminal tables          | `src/terminal/table.ts` (`renderTable`)                     |
| Colors/themes            | `src/terminal/theme.ts` and `src/terminal/palette.ts`       |
| Progress/spinners        | `src/cli/progress.ts` (`osc-progress` + `@clack/prompts`)   |
| Auth helper (gateway)    | `authorizeGatewayBearerRequestOrReply` in `src/gateway/`    |
| Token generation         | `randomToken()` — do not duplicate                          |
| Config schema            | Zod — NOT TypeBox (TypeBox references in docs are outdated) |

## Extension / Plugin Pattern

Extensions live in `extensions/<name>/` as workspace packages. To add a channel plugin:

1. Keep channel-specific deps in the extension's own `package.json#dependencies`.
2. Do **not** add plugin-only deps to root `package.json`.
3. List `openclaw` in `devDependencies`/`peerDependencies`, not `dependencies`.
4. Implement adapters from `src/plugin-sdk/` (`ChannelMessagingAdapter`, `ChannelGatewayAdapter`, etc.).
5. Update all affected surfaces: macOS app, web UI, mobile, onboarding docs, `docs/channels/`, `.github/labeler.yml`, and create matching GitHub label.

## Gateway Auth Notes

- Auth modes: `"token" | "password" | "trusted-proxy"` (`GatewayAuthMode` in `src/config/types.gateway.ts`).
- Bypass flags `allowInsecureAuth` and `dangerouslyDisableDeviceAuth` exist for legacy compat — do not introduce new bypasses.
- Use existing `authorizeGatewayBearerRequestOrReply`, `randomToken()`, `validateGatewayPasswordInput()`, `createAuthRateLimiter()` — do not recreate.

## Version Locations (bump all when releasing)

`package.json` · `apps/android/app/build.gradle.kts` · `apps/ios/Sources/Info.plist` · `apps/macos/Sources/OpenClaw/Resources/Info.plist` · `docs/install/updating.md`

## macOS / Platform Notes

- Gateway runs only as the menubar app — restart via the OpenClaw Mac app or `scripts/restart-mac.sh`.
- macOS logs: `./scripts/clawlog.sh` (unified log, supports follow/filter).
- SwiftUI: prefer `@Observable`/`@Bindable` (Observation framework) over `ObservableObject`/`@StateObject`.
- Do not rebuild the macOS app over SSH.

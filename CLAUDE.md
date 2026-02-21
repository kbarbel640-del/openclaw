# OpenClaw

Multi-channel AI assistant gateway -- the production install used daily via iMessage.

## Commands

```bash
pnpm install
pnpm build        # Full build (tsdown + plugin SDK + canvas + hooks)
pnpm dev          # Run gateway in dev mode
pnpm test         # Parallel unit tests
pnpm test:fast    # Unit tests only (vitest)
pnpm test:e2e     # End-to-end tests
pnpm check        # Format check + tsgo + lint
pnpm lint         # oxlint --type-aware
pnpm format       # oxfmt --write
```

## Stack

TypeScript (ESM), pnpm, tsdown, Vitest, oxlint/oxfmt, Node >= 22

## Code Style

- TypeScript strict, ESM (`"type": "module"`)
- Format with oxfmt, lint with oxlint (type-aware)
- Max 500 LOC per file (`pnpm check:loc`)
- camelCase for variables/functions

## Notes

- Production install -- `openclaw-fix` script handles gateway plist + FDA issues
- Gateway plist must point to Homebrew node (not fnm) for FDA/TCC access
- Auth: Claude Pro/Max OAuth, no standalone API keys
- Channels: iMessage (primary), WhatsApp, Telegram, Slack, Discord, etc.

# 🌱 Contributing to gclaw

Hey! Thanks for wanting to contribute. This is a hacker's project — we keep things simple. 🌿

## Setup

```bash
git clone https://github.com/GreenThumbMarket/gclaw.git
cd gclaw
pnpm install
pnpm build
```

Requirements: **Node.js ≥ 22**, **pnpm** (see `packageManager` in package.json for exact version).

## Running Tests

```bash
pnpm test          # parallel test runner
pnpm test:fast     # unit tests only (vitest)
pnpm test:watch    # watch mode
```

## Code Style

- **Language**: TypeScript (strict)
- **Linter**: [oxlint](https://oxc.rs/) — `pnpm lint`
- **Formatter**: [oxfmt](https://oxc.rs/) — `pnpm format`
- **Check everything**: `pnpm check` (format + typecheck + lint)

Don't fight the formatter. Just run `pnpm format` before committing.

## Making Changes

1. Fork the repo and create a branch (`git checkout -b my-thing`)
2. Make your changes
3. Run `pnpm check` and `pnpm test`
4. Commit with a clear message (we loosely follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `chore:`, etc.)
5. Open a PR against `main`

## PR Guidelines

- Keep PRs focused — one thing per PR
- Add tests if you're adding functionality
- Update docs if behavior changes
- Don't stress about perfection — we'll iterate together

## Architecture

This is a fork of [OpenClaw](https://github.com/openclaw-ai/openclaw). See [FORK.md](./FORK.md) for what we changed and why. We try to keep the diff minimal so upstream merges stay clean.

## 💚 Questions?

Open an issue. There are no stupid questions. We're growing this garden together. 🌻

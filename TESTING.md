# Testing

## Canonical local commands

- `pnpm -C packages/dispatch-contracts typecheck`
- `pnpm dispatch:test:ci`
- `node --test dispatch/tests/story_glz_12_autonomy_rollout_controls.node.test.mjs`
- `node --test dispatch/tests/story_glz_05_assignment_recommendation.node.test.mjs`
- `node --test dispatch/tests/story_glz_06_confirmation_hold_chain.node.test.mjs`

## Environment

- Node.js + pnpm (workspace scripts in root)
- Docker daemon (API tests start temporary PostgreSQL containers)
- Local clone at repository root (`dispatch/tests` uses `dispatch` package scripts/services)

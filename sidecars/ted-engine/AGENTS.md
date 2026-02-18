# Ted Engine (Sidecar HTTP Server) — AGENTS.md

## What this is (facts)

Ted Engine is a loopback-only HTTP server.

- Host and port are fixed to `127.0.0.1:48080` (`sidecars/ted-engine/server.mjs:16`, `sidecars/ted-engine/server.mjs:17`).
- Server entrypoint is `sidecars/ted-engine/server.mjs` (`sidecars/ted-engine/server.mjs:1`).

## Non-negotiables

- Contract surface policy:
  - Only `/status` and `/doctor` are stable external contract.
  - All other routes are internal unless explicitly promoted via the contract doc + tests.
- Health schema policy:
  - `/status` and `/doctor` must include required fields: `version`, `uptime`, `profiles_count`.
  - Additive fields are allowed but must remain optional.

- Must remain loopback-bound (`sidecars/ted-engine/server.mjs:1564`).
- `/status` and `/doctor` must remain stable and safe.
- `/status` and `/doctor` currently share one handler and one payload shape (`sidecars/ted-engine/server.mjs:1471`).

## Observed route families

- Health: `/status`, `/doctor` (`sidecars/ted-engine/server.mjs:1471`).
- Deals: `/deals/create`, `/deals/list`, `/deals/:deal_id` (`sidecars/ted-engine/server.mjs:1403`, `sidecars/ted-engine/server.mjs:1408`, `sidecars/ted-engine/server.mjs:1413`).
- Triage: `/triage/list`, `/triage/ingest`, `/triage/:item_id/link`, `/triage/patterns*` (`sidecars/ted-engine/server.mjs:1420`, `sidecars/ted-engine/server.mjs:1425`, `sidecars/ted-engine/server.mjs:1464`, `sidecars/ted-engine/server.mjs:1447`).
- Filing suggestions: `/filing/suggestions/propose`, `/filing/suggestions/list`, `/filing/suggestions/:id/approve` (`sidecars/ted-engine/server.mjs:1430`, `sidecars/ted-engine/server.mjs:1435`, `sidecars/ted-engine/server.mjs:1440`).
- Graph: `/graph/*` status/auth/calendar/draft endpoints and diagnostics classify (`sidecars/ted-engine/server.mjs:1478`, `sidecars/ted-engine/server.mjs:1496`, `sidecars/ted-engine/server.mjs:1503`, `sidecars/ted-engine/server.mjs:1533`, `sidecars/ted-engine/server.mjs:1540`).

## Validation (run from repo root)

- `pnpm build`
- `pnpm test`
- `pnpm check`
- `pnpm lint`

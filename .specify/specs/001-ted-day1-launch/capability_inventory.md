# Capability Inventory (Repo Reality Check)

## Scope and Method

This inventory reflects what exists in the repository right now based on:

- top-level folder scan
- route/endpoint scan in runtime surfaces
- Ted sidecar runtime inspection (`sidecars/ted-engine/server.mjs`)
- Ted sidecar extension boundary inspection (`extensions/ted-sidecar/index.ts`)

## Top-Level Product Surfaces

| Surface            | Present | Notes                                                                                |
| ------------------ | ------- | ------------------------------------------------------------------------------------ |
| `src/`             | Yes     | Core OpenClaw CLI, channels, gateway, routing, doctor/status surfaces.               |
| `extensions/`      | Yes     | Extension/plugin ecosystem including `ted-sidecar`.                                  |
| `sidecars/`        | Yes     | Ted Engine sidecar implementation at `sidecars/ted-engine/server.mjs`.               |
| `apps/`            | Yes     | Platform apps (mobile/mac related app surfaces).                                     |
| `packages/`        | Yes     | Shared packages/workspaces.                                                          |
| `docs/`            | Yes     | Product docs and Ted SDD artifacts under `docs/ted-profile/`.                        |
| `routes/` (root)   | No      | Route registration lives inside source modules (for example `src/browser/routes/*`). |
| `services/` (root) | No      | Service behavior exists under `src/` and extension/sidecar packages.                 |

## Ted Engine Sidecar API (Observed)

Observed in `sidecars/ted-engine/server.mjs`:

### Health (stable external boundary)

- `GET /status`
- `GET /doctor`

### Deals and triage

- `POST /deals/create`
- `GET /deals/list`
- `GET /deals/:deal_id`
- `GET /triage/list`
- `POST /triage/ingest`
- `POST /triage/:item_id/link`
- `GET /triage/patterns`
- `POST /triage/patterns/propose`
- `POST /triage/patterns/:id/approve`

### Filing suggestions

- `POST /filing/suggestions/propose`
- `GET /filing/suggestions/list`
- `POST /filing/suggestions/:id/approve`

### Graph (draft-first)

- `GET /graph/:profile_id/status`
- `GET /graph/:profile_id/calendar/list`
- `POST /graph/:profile_id/auth/device/start`
- `POST /graph/:profile_id/auth/device/poll`
- `POST /graph/:profile_id/auth/revoke`
- `POST /graph/:profile_id/mail/draft/create`
- `POST /graph/diagnostics/classify`

## Ted Sidecar Extension Boundary (Observed)

Observed in `extensions/ted-sidecar/index.ts`:

- loopback-only base URL enforcement
- endpoint allowlist currently limited to:
  - `/status`
  - `/doctor`
- action handling currently supports:
  - `/ted doctor`
  - `/ted status`

This means the extension currently exposes health/doctor only, while sidecar internals already contain broader workflow routes.

## Capability Coverage Summary (Day-1 vs Phase-1)

| Capability family                         | Runtime presence                                                     | Day-1 readiness signal                                      |
| ----------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------- |
| Health and doctor                         | Present in sidecar + extension + doctor probes                       | Strong                                                      |
| Graph auth + draft create                 | Present in sidecar                                                   | Medium (governance and boundary contract must stay aligned) |
| Deal ledger and triage                    | Present in sidecar                                                   | Medium (requires proof/evidence discipline)                 |
| Filing suggestions (propose/list/approve) | Present in sidecar                                                   | Medium (apply/move intentionally deferred)                  |
| Deadlines proposals                       | Placeholder in job cards; explicit routes not yet visible in sidecar | Planned (Phase-1 work item)                                 |
| Dashboard/daily command center            | Docs/story level and job-card plan; route naming differs across docs | Planned with contract reconciliation                        |
| Retention and purge controls              | Story/docs level plus new governance story                           | Planned (needs explicit proof scripts)                      |

## Noted Contract Drift / Reconciliation Points

- Documentation references future route families such as `/dealops/daily/*`, `/drafts/*`, `/deadlines/*` while current sidecar runtime primarily exposes `/deals/*`, `/triage/*`, `/filing/*`, `/graph/*`.
- `ted-sidecar` extension currently exposes health-only routes; no non-health invocation path is active in plugin action surface.

Track reconciliation via:

- `docs/ted-profile/job-cards/JC-006-sidecar-auth-contract-reconciliation.md`
- `docs/integration/ted-sidecar-contract.md`
- `docs/ted-profile/sdd-pack/13_OPEN_QUESTIONS.md`

# OpenClaw ↔ Ted Sidecar Contract

## Integration model (facts)

- Sidecar base URL default is `http://127.0.0.1:48080` (`extensions/ted-sidecar/index.ts:6`).
- OpenClaw autostarts sidecar via `spawn(process.execPath, [sidecarEntry])` (`extensions/ted-sidecar/index.ts:250`).
- Sidecar server binds to `127.0.0.1:48080` (`sidecars/ted-engine/server.mjs:16`, `sidecars/ted-engine/server.mjs:17`, `sidecars/ted-engine/server.mjs:1564`).
- Doctor probes call `${baseUrl}/status` and `${baseUrl}/doctor` (`src/commands/doctor-gateway-services.ts:60`, `src/commands/doctor-gateway-services.ts:65`).

Authoritative sources:

- `extensions/ted-sidecar/index.ts`
- `extensions/ted-sidecar/openclaw.plugin.json`
- `src/commands/doctor-gateway-services.ts`
- `sidecars/ted-engine/server.mjs`

## Integration style

- [x] Loopback HTTP client/server (`extensions/ted-sidecar/index.ts:114`, `sidecars/ted-engine/server.mjs:1398`)
- [x] Child-process autostart (`extensions/ted-sidecar/index.ts:250`)
- [ ] Library import (no evidence)
- [ ] Event bus (no evidence)

## Configuration contract (plugin id: `ted-sidecar`)

- `baseUrl`
  - Defined in plugin schema (`extensions/ted-sidecar/openclaw.plugin.json:9`).
  - UI default/help points to `http://127.0.0.1:48080` (`extensions/ted-sidecar/openclaw.plugin.json:26`).
  - Precedence is plugin config -> `TED_SIDECAR_BASE_URL` -> default (`extensions/ted-sidecar/index.ts:60`, `extensions/ted-sidecar/index.ts:61`, `extensions/ted-sidecar/index.ts:62`).
  - Must be loopback host (`extensions/ted-sidecar/index.ts:41`).
  - Must not include URL credentials (`extensions/ted-sidecar/index.ts:45`).
  - Must use `http:` or `https:` (`extensions/ted-sidecar/index.ts:49`).
- `timeoutMs`
  - Defined in plugin schema (`extensions/ted-sidecar/openclaw.plugin.json:12`).
  - Used by `/ted` plugin path with default `5000` ms (`extensions/ted-sidecar/index.ts:7`, `extensions/ted-sidecar/index.ts:66`).
- `sidecarPath`
  - Defined in plugin schema (`extensions/ted-sidecar/openclaw.plugin.json:15`).
  - Default candidate path is `sidecars/ted-engine/server.mjs` (`extensions/ted-sidecar/index.ts:208`).
- `autostart`
  - Defined in plugin schema (`extensions/ted-sidecar/openclaw.plugin.json:18`).
  - `false` disables startup spawn (`extensions/ted-sidecar/index.ts:231`).

## Stable endpoint contract

- `GET /status` (`sidecars/ted-engine/server.mjs:1471`)
- `GET /doctor` (`sidecars/ted-engine/server.mjs:1471`)
- Both currently return the same payload handler (`sidecars/ted-engine/server.mjs:1471`, `sidecars/ted-engine/server.mjs:1472`).
- Ted plugin expects payload with `version`, `uptime`, `profiles_count` (`extensions/ted-sidecar/index.ts:126`, `extensions/ted-sidecar/index.ts:127`, `extensions/ted-sidecar/index.ts:128`).
- Doctor checker validates the same payload fields (`src/commands/doctor-gateway-services.ts:83`, `src/commands/doctor-gateway-services.ts:84`, `src/commands/doctor-gateway-services.ts:85`).

## Contract surface and stability policy

### Stable external contract (MUST remain backward compatible)

Only these endpoints are considered **stable external contract**:

- `GET /status`
- `GET /doctor`

### Internal routes (NON-CONTRACT)

All other sidecar routes (including route families like `/deals/*`, `/triage/*`, `/filing/suggestions/*`, `/graph/*`, etc.) are **internal** and may change without notice unless explicitly promoted.

**Promotion rule (to make a route “stable external contract”):**

- Update this contract doc to move the route into “Stable external contract”
- Add/extend tests proving compatibility and payload expectations
- Note the change in release notes (per Constitution)

## Health payload schema (stable contract)

### Required fields

`/status` and `/doctor` MUST continue to include:

- `version`
- `uptime`
- `profiles_count`

### Optional/additive fields

Additional fields are allowed but MUST be additive and optional (e.g., `deals_count`, `triage_open_count`, etc.).

### Payload parity

`/status` and `/doctor` MUST remain payload-identical unless an explicit breaking decision is made and test-backed.

## Host policy nuance

Validator logic allows loopback hosts (`127.0.0.1`, `localhost`, `::1`), while the server currently binds IPv4 loopback (`127.0.0.1:48080`). Prefer the default base URL. If you change the base URL host, ensure it remains reachable given the server bind behavior.

## Timeout policy (explicit)

Plugin command path and doctor probes use different timeouts today. Any PR touching timeout behavior MUST:

- state whether the mismatch is kept or aligned
- include an explicit rationale in the PR

## Observed route families (sidecar)

- Deals (`sidecars/ted-engine/server.mjs:1403`, `sidecars/ted-engine/server.mjs:1408`, `sidecars/ted-engine/server.mjs:1413`)
- Triage (`sidecars/ted-engine/server.mjs:1420`, `sidecars/ted-engine/server.mjs:1425`, `sidecars/ted-engine/server.mjs:1464`, `sidecars/ted-engine/server.mjs:1447`)
- Filing suggestions (`sidecars/ted-engine/server.mjs:1430`, `sidecars/ted-engine/server.mjs:1435`, `sidecars/ted-engine/server.mjs:1440`)
- Graph + diagnostics (`sidecars/ted-engine/server.mjs:1478`, `sidecars/ted-engine/server.mjs:1496`, `sidecars/ted-engine/server.mjs:1503`, `sidecars/ted-engine/server.mjs:1533`, `sidecars/ted-engine/server.mjs:1540`)

## Safety invariants (NON-NEGOTIABLE)

- Sidecar must remain loopback-bound (`sidecars/ted-engine/server.mjs:1564`).
- Ted plugin endpoint construction must remain allowlisted and loopback-constrained (`extensions/ted-sidecar/index.ts:89`, `extensions/ted-sidecar/index.ts:94`, `extensions/ted-sidecar/index.ts:97`).
- Allowlist is currently `/status` and `/doctor` only (`extensions/ted-sidecar/index.ts:8`).
- In unhealthy mode, `/ted` blocks non-health actions (`extensions/ted-sidecar/index.ts:291`, `extensions/ted-sidecar/index.ts:295`).

## Lifecycle + health semantics

- Sidecar readiness waits for both `/status` and `/doctor` to pass (`extensions/ted-sidecar/index.ts:147`, `extensions/ted-sidecar/index.ts:149`).
- Retry policy is 20 attempts with 250 ms delay (`extensions/ted-sidecar/index.ts:9`, `extensions/ted-sidecar/index.ts:10`, `extensions/ted-sidecar/index.ts:165`, `extensions/ted-sidecar/index.ts:170`).
- Stop path sends `SIGTERM`, then `SIGKILL` after 2s if still running (`extensions/ted-sidecar/index.ts:182`, `extensions/ted-sidecar/index.ts:189`, `extensions/ted-sidecar/index.ts:194`).

## Doctor gating behavior

- Ted sidecar check is skipped in remote mode (`src/commands/doctor-gateway-services.ts:376`).
- Ted sidecar health check requires plugin enabled (`src/commands/doctor-gateway-services.ts:381`, `src/commands/doctor-gateway-services.ts:382`).
- Doctor enforces loopback-only base URL before probing (`src/commands/doctor-gateway-services.ts:390`).

## Timeout mismatch (observed)

- Plugin command path default timeout is `5000` ms (`extensions/ted-sidecar/index.ts:7`).
- Doctor probe timeout is `2000` ms (`src/commands/doctor-gateway-services.ts:23`).
- Treat this as a deliberate decision: either keep the mismatch (document why) or align them.

## Verification expectations (run from repo root)

- `pnpm install --frozen-lockfile`
- `pnpm check`
- `pnpm lint`
- `pnpm build`
- `pnpm test`
- `bunx vitest run --config vitest.unit.config.ts`
- `pnpm test:install:smoke`

## Evidence citations

Where this doc references `file:line`, treat it as best-effort evidence. If referenced files change and line numbers drift, update the citations as part of the same PR.

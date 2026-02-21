# Ted Sidecar (Extension) — AGENTS.md

## What this is (facts)

This extension wires OpenClaw to a local Ted sidecar over loopback HTTP.

- Default base URL is `http://127.0.0.1:48080` (`extensions/ted-sidecar/index.ts:6`).
- Sidecar autostart uses `spawn(process.execPath, [sidecarEntry])` (`extensions/ted-sidecar/index.ts:250`).
- `/ted` command path is intentionally restricted to health operations (`extensions/ted-sidecar/index.ts:282`).

## Authoritative wiring sources

- `extensions/ted-sidecar/index.ts`
- `extensions/ted-sidecar/openclaw.plugin.json`
- `src/commands/doctor-gateway-services.ts`
- `sidecars/ted-engine/server.mjs`

## Non-negotiables (security + correctness)

- Loopback-only base URL enforcement:
  - Allowed hosts are `127.0.0.1`, `localhost`, `::1` (`extensions/ted-sidecar/index.ts:28`).
  - Non-loopback base URLs are rejected (`extensions/ted-sidecar/index.ts:41`).
- Unsafe URL patterns are blocked:
  - Credentials in URL are rejected (`extensions/ted-sidecar/index.ts:45`).
  - Only `http:`/`https:` protocols are accepted (`extensions/ted-sidecar/index.ts:49`).
- Unhealthy mode and routing safety:
  - Allowlist is `/status` and `/doctor` (`extensions/ted-sidecar/index.ts:8`).
  - Endpoint construction enforces allowlist and loopback host (`extensions/ted-sidecar/index.ts:89`).
  - When sidecar is unhealthy, non-doctor/status `/ted` usage is denied (`extensions/ted-sidecar/index.ts:291`).

## Config behavior (do not guess)

- Base URL precedence is plugin config -> `TED_SIDECAR_BASE_URL` env -> default (`extensions/ted-sidecar/index.ts:59`).
- Timeout uses `timeoutMs` if valid, otherwise defaults to `5000` ms (`extensions/ted-sidecar/index.ts:7`, `extensions/ted-sidecar/index.ts:66`).
- Config schema keys are `baseUrl`, `timeoutMs`, `sidecarPath`, `autostart` (`extensions/ted-sidecar/openclaw.plugin.json:9`).

## Lifecycle facts

- Service startup can be disabled with `autostart: false` (`extensions/ted-sidecar/index.ts:231`).
- Readiness probe retries up to 20 times with 250 ms delay (`extensions/ted-sidecar/index.ts:9`, `extensions/ted-sidecar/index.ts:10`, `extensions/ted-sidecar/index.ts:160`).
- Stop path sends `SIGTERM`, then `SIGKILL` after 2s if needed (`extensions/ted-sidecar/index.ts:175`).

## Doctor integration facts

- Doctor sidecar check only runs in local mode (`src/commands/doctor-gateway-services.ts:376`).
- Doctor check requires plugin enabled (`src/commands/doctor-gateway-services.ts:382`).
- Doctor probe timeout is `2000` ms (`src/commands/doctor-gateway-services.ts:23`).

## Validation (run from repo root)

- `pnpm install --frozen-lockfile`
- `pnpm check`
- `pnpm lint`
- `pnpm build`
- `pnpm test`
- `bunx vitest run --config vitest.unit.config.ts`
- `pnpm test:install:smoke`

## Contract discipline

- Contract source: `docs/integration/ted-sidecar-contract.md`.
- Any boundary-impacting change must update the contract doc and include verification evidence.

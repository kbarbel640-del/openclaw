# OpenClaw Security Hardening Handoff (February 20, 2026)

## Scope

This handoff documents a focused security hardening pass for OpenClaw gateway/plugin surfaces, centered on reducing compromise risk from misconfiguration, unsafe defaults, plugin abuse, and HTTP exposure.

## Findings and Remediations

### 1) Insecure auth bypass flags could be enabled too easily

- Risk: dangerous Control UI auth bypass flags could be set in config and accidentally shipped.
- Fix:
  - Block startup when `gateway.controlUi.allowInsecureAuth` or `gateway.controlUi.dangerouslyDisableDeviceAuth` is enabled, unless `OPENCLAW_ALLOW_INSECURE_CONTROL_UI_AUTH=1`.
  - Ensure handshake-level bypass logic honors the same env gate.
- Files:
  - `src/gateway/server-runtime-config.ts`
  - `src/gateway/server/ws-connection/message-handler.ts`
  - `src/gateway/server-runtime-config.test.ts`

### 2) Auth brute-force exposure when rate limiter was absent

- Risk: auth rate limiting could be effectively optional.
- Fix:
  - Always construct and enforce auth rate limiting from resolved config defaults.
  - Remove obsolete audit warning that no longer applies under enforced defaults.
- Files:
  - `src/gateway/server.impl.ts`
  - `src/security/audit.ts`
  - `src/security/audit.test.ts`

### 3) Generated startup token persistence was too permissive

- Risk: generated auth token could be written to config by default.
- Fix:
  - Make persistence explicit opt-in via `OPENCLAW_PERSIST_GENERATED_GATEWAY_TOKEN=1`.
  - Improve startup warning text to reflect safer default.
- Files:
  - `src/gateway/server.impl.ts`

### 4) HTTP tool invocation was not deny-by-default

- Risk: relying on denylist for `/tools/invoke` can expose unexpected tools.
- Fix:
  - Require explicit `gateway.tools.allow` allowlist for any HTTP tool exposure.
  - Keep `gateway.tools.deny` higher-priority as explicit override.
  - Update config documentation to match allowlist model.
- Files:
  - `src/gateway/tools-invoke-http.ts`
  - `src/config/types.gateway.ts`
  - `src/security/dangerous-tools.ts`
  - `src/gateway/tools-invoke-http.test.ts`

### 5) Plugin HTTP routes could escape namespace boundaries

- Risk: plugin route registration could target unrelated API paths.
- Fix:
  - Enforce route namespace at registration time:
    - allowed: `/plugins/<pluginId>/...` and `/api/channels/...`
    - rejected otherwise.
  - Only dispatch plugin HTTP handlers for plugin namespaces.
  - Require gateway auth for plugin namespace requests before dispatch.
- Files:
  - `src/plugins/registry.ts`
  - `src/gateway/server-http.ts`
  - `src/gateway/server.plugin-http-auth.test.ts`
  - `src/gateway/server/plugins-http.test.ts`
  - `src/plugins/loader.test.ts`

### 6) External plugin trust posture was too permissive

- Risk: non-bundled plugin code could be discovered/loaded without explicit trust.
- Fix:
  - External plugins now disabled by default.
  - Explicit trust required to load (e.g. `plugins.entries.<id>.enabled: true`, with allowlist controls).
  - Warning text updated for discoverable non-bundled plugins when allowlist is empty.
- Files:
  - `src/plugins/config-state.ts`
  - `src/plugins/loader.ts`
  - `src/plugins/loader.test.ts`

### 7) Plugin install scanner did not fail closed

- Risk: dangerous patterns or scanner errors could still allow install.
- Fix:
  - Code safety scan now enforced fail-closed for critical findings.
  - Scanner operational failures also block installation.
  - Apply scanner enforcement to both directory and standalone file install flows.
- Files:
  - `src/plugins/install.ts`
  - `src/plugins/install.e2e.test.ts`

### 8) URL ingestion defaults were too open for Responses/file/image paths

- Risk: SSRF and data exfiltration surfaces from remote URL ingestion.
- Fix:
  - Default `allowUrl=false` for input files and Responses image/file URL fetch.
  - Schema/comments updated to document secure default.
- Files:
  - `src/media/input-files.ts`
  - `src/gateway/openresponses-http.ts`
  - `src/config/types.gateway.ts`

### 9) Session override header enabled without explicit runtime intent

- Risk: `x-openclaw-session-key` header could be abused for cross-session targeting.
- Fix:
  - Disable by default; only honored when `OPENCLAW_ALLOW_HTTP_SESSION_KEY_HEADER=1`.
  - Security audit finding updated to trigger only when enabled, and severity raised.
- Files:
  - `src/gateway/http-utils.ts`
  - `src/security/audit-extra.sync.ts`
  - `src/security/audit.ts`
  - `src/gateway/openai-http.e2e.test.ts`
  - `src/security/audit.test.ts`

### 10) HTTP response hardening headers were incomplete

- Risk: avoidable clickjacking/policy exposure on gateway surfaces.
- Fix:
  - Added:
    - `X-Frame-Options: SAMEORIGIN`
    - `Permissions-Policy: camera=(), microphone=(), geolocation=(), usb=()`
    - `Cross-Origin-Opener-Policy: same-origin`
- Files:
  - `src/gateway/http-common.ts`

### 11) TLS lacked first-class mTLS enforcement toggle

- Risk: no structured way to require client certificates in hardened deployments.
- Fix:
  - Added `gateway.tls.requireClientCert` config.
  - Enforced CA requirement when mTLS is enabled.
  - Wired TLS options to request/reject unauthorized clients.
- Files:
  - `src/config/types.gateway.ts`
  - `src/config/zod-schema.ts`
  - `src/infra/tls/gateway.ts`

## Behavioral Changes (Important)

- `/tools/invoke` is now deny-by-default. No HTTP tools are exposed unless in `gateway.tools.allow`.
- Non-bundled plugins are disabled by default.
- `x-openclaw-session-key` override header is ignored unless explicitly enabled by env.
- Insecure Control UI auth bypass flags are blocked unless explicitly env-gated.
- URL-based file/image ingestion is disabled by default for Responses surfaces.
- Startup-generated auth token persistence is opt-in.
- mTLS can be explicitly required via config.

## Validation Performed

### Unit tests (security-touched files)

Command:

- `corepack pnpm vitest src/plugins/loader.test.ts src/gateway/server.plugin-http-auth.test.ts src/gateway/tools-invoke-http.test.ts src/security/audit.test.ts src/gateway/server-runtime-config.test.ts`

Result:

- 5 test files passed
- 117 tests passed
- 0 failed

### E2E tests (security-touched files)

Command:

- `corepack pnpm vitest run --config vitest.e2e.config.ts src/plugins/install.e2e.test.ts src/gateway/openai-http.e2e.test.ts src/gateway/openresponses-http.e2e.test.ts`

Result:

- 3 test files passed
- 24 tests passed
- 0 failed

## Residual Risk and Next Hardening Steps

- Add structured allowlist linting at startup for `gateway.tools.allow` and `plugins.entries` to fail on unknown IDs.
- Add optional CIDR/path-level policy enforcement for plugin HTTP endpoints.
- Add configurable anomaly detection for repeated auth failures and session-key override attempts.
- Add signed plugin manifest verification (integrity + publisher trust).
- Add SSRF egress policy controls (host/network allowlist + DNS pinning) for any future URL ingestion enablement.
- Extend security regression tests to include hostile plugin fixtures and fuzzed HTTP routing paths.

## Operational Notes for Deployment

- If you previously relied on permissive defaults, update config explicitly:
  - set `gateway.tools.allow` for needed HTTP tools.
  - set `plugins.entries.<id>.enabled: true` for explicitly trusted external plugins.
  - only set insecure auth env overrides in controlled local/dev contexts.
  - if needed, explicitly set URL ingestion toggles to `true` per environment with compensating controls.

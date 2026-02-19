---
applyTo: "src/gateway/**,src/config/**,src/security/**,src/wizard/**,src/canvas-host/**,src/cli/gateway-cli/**"
---

# Gateway Security Hardening — Code Instructions

These instructions apply when working on the Gateway Auth Enforcement Roadmap.

## Schema System

The config system uses **plain TypeScript types** (`src/config/types.gateway.ts`) and **Zod** (`src/config/zod-schema.ts`).
The roadmap document references TypeBox — that is INCORRECT. Always use Zod for schema definitions.

## Key Type Locations

- `GatewayConfig` — `src/config/types.gateway.ts`
- `GatewayAuthConfig` — `src/config/types.gateway.ts`
- `GatewayAuthMode` — `src/config/types.gateway.ts` (values: `"token" | "password" | "trusted-proxy"`)
- `ResolvedGatewayAuth` — `src/gateway/auth.ts` (includes `mode: "none"` at runtime)
- `SecurityRequirement` — `src/config/security-requirements.ts` (created by Phase 1)

## Auth Bypass Inventory (to be removed)

| Bypass                          | File                                                 | Line      | What it does                        |
| ------------------------------- | ---------------------------------------------------- | --------- | ----------------------------------- |
| Default `mode: "none"`          | `src/gateway/auth.ts`                                | ~200      | No auth when config is empty        |
| `isLocalDirectRequest()` canvas | `src/gateway/server-http.ts`                         | ~120      | Localhost skips canvas auth         |
| `hasAuthorizedWsClientForIp()`  | `src/gateway/server-http.ts`                         | ~150      | Shared IP grants access             |
| `exemptLoopback: true`          | `src/gateway/auth-rate-limit.ts`                     | ~34       | Localhost not rate-limited          |
| No auth on Control UI           | `src/gateway/control-ui.ts`                          | all       | Static files served without auth    |
| No auth on plugin routes        | `src/gateway/server/plugins-http.ts`                 | all       | Plugin handlers called without auth |
| `allowInsecureAuth`             | `src/config/types.gateway.ts` + `message-handler.ts` | ~75, ~342 | Disables TLS requirement            |
| `dangerouslyDisableDeviceAuth`  | `src/config/types.gateway.ts` + `message-handler.ts` | ~77, ~344 | Disables device identity            |

## Commit Convention

Always use `scripts/committer` for commits:

```bash
scripts/committer "security: <description>" file1.ts file2.ts
```

Never use `git add` / `git commit` directly.

## Verification Commands

After every change:

```bash
pnpm tsgo          # Type check — must pass
pnpm check         # Lint + format — must pass
pnpm test          # All tests — must pass
```

For targeted testing:

```bash
pnpm test src/gateway/auth.test.ts
pnpm test src/config/security-requirements.test.ts
pnpm test src/security/audit.test.ts
```

## Import Conventions

- Use `.js` extensions for ESM imports: `from "./security-requirements.js"`
- Use `import type { X }` for type-only imports
- Import directly from source — no re-export wrapper files

## Reuse Rules

- Auth helper: use existing `authorizeGatewayBearerRequestOrReply` — do NOT create new auth functions.
- Token generation: use existing `randomToken()` — do NOT duplicate.
- Password validation: use existing `validateGatewayPasswordInput()`.
- Rate limiter: use existing `createAuthRateLimiter()`.
- Colors/themes: use `src/terminal/palette.ts` — no hardcoded colors.
- Progress: use `src/cli/progress.ts` — no hand-rolled spinners.

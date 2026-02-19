# Gateway Authentication Enforcement Roadmap

> **Breaking Change**: This roadmap enforces mandatory authentication on ALL gateway endpoints with NO backward compatibility. Existing configurations without explicit security settings will fail to start.

**Target**: Public internet exposure hardening with fail-closed security model.

**Last Updated**: 2026-02-18

---

## Executive Summary

The OpenClaw gateway currently has robust authentication mechanisms but allows several bypass paths for convenience (localhost bypass, IP-based canvas auth, optional Control UI auth). This roadmap eliminates all bypass paths and enforces mandatory authentication configuration during onboarding.

### Key Changes

- All endpoints require authentication by default
- Gateway refuses to start without explicit security configuration
- Onboarding wizard forces security configuration completion
- All auth bypass paths removed or require explicit dangerous opt-in
- Rate limiting applies to all IPs including localhost

---

## Pre-Implementation Checklist

- [ ] Read and understand current auth architecture: [docs/concepts/architecture.md](../concepts/architecture.md)
- [ ] Read current security documentation: [docs/gateway/security/index.md](../gateway/security/index.md)
- [ ] Review current auth code: [src/gateway/auth.ts](../../src/gateway/auth.ts)
- [ ] Run `pnpm install` to ensure dependencies are up to date
- [ ] Run `pnpm test` to establish baseline (all tests should pass)

---

## Phase 1: Security Requirements Schema

**Goal**: Define mandatory security configuration fields that must be present before gateway starts.

### Task 1.1: Create Security Requirements Module

- [ ] **Status**: Not Started
- **File**: `src/config/security-requirements.ts` (create new)
- **Description**: Define schema for mandatory security configuration
- **Implementation**:

```typescript
// src/config/security-requirements.ts
import type { OpenClawConfig } from "./config.js";

export type SecurityRequirement = {
  field: string;
  description: string;
  check: (config: OpenClawConfig) => boolean;
  remediation: string;
};

export const MANDATORY_SECURITY_REQUIREMENTS: SecurityRequirement[] = [
  {
    field: "gateway.auth.mode",
    description: "Gateway authentication mode must be explicitly configured",
    check: (config) => {
      const mode = config.gateway?.auth?.mode;
      return mode === "token" || mode === "password" || mode === "trusted-proxy";
    },
    remediation: 'Run "openclaw configure" and select an authentication mode',
  },
  {
    field: "gateway.auth.token|password",
    description: "Gateway authentication credential must be configured",
    check: (config) => {
      const auth = config.gateway?.auth;
      if (auth?.mode === "token") return Boolean(auth.token || process.env.OPENCLAW_GATEWAY_TOKEN);
      if (auth?.mode === "password")
        return Boolean(auth.password || process.env.OPENCLAW_GATEWAY_PASSWORD);
      if (auth?.mode === "trusted-proxy") return Boolean(auth.trustedProxy?.userHeader);
      return false;
    },
    remediation: "Set gateway.auth.token or OPENCLAW_GATEWAY_TOKEN environment variable",
  },
  {
    field: "gateway.securityConfigured",
    description: "Security configuration acknowledgement required",
    check: (config) => config.gateway?.securityConfigured === true,
    remediation:
      'Run "openclaw onboard" or set gateway.securityConfigured=true after manual review',
  },
];

export function validateSecurityRequirements(config: OpenClawConfig): {
  valid: boolean;
  failures: SecurityRequirement[];
} {
  const failures = MANDATORY_SECURITY_REQUIREMENTS.filter((req) => !req.check(config));
  return { valid: failures.length === 0, failures };
}

export function formatSecurityFailures(failures: SecurityRequirement[]): string {
  const lines = ["Gateway startup blocked: missing required security configuration", ""];
  for (const f of failures) {
    lines.push(`  ✗ ${f.field}: ${f.description}`);
    lines.push(`    → ${f.remediation}`);
    lines.push("");
  }
  lines.push('Run "openclaw security audit" for full security checklist.');
  return lines.join("\n");
}
```

- **Tests**: Create `src/config/security-requirements.test.ts`
- **Verification**: `pnpm test src/config/security-requirements.test.ts`

### Task 1.2: Add `securityConfigured` Flag to Config Schema

- [ ] **Status**: Not Started
- **File**: `src/config/config.ts`
- **Description**: Add `gateway.securityConfigured` boolean field to config TypeBox schema
- **Implementation**: Add to `GatewayConfigSchema`:

```typescript
securityConfigured: Type.Optional(Type.Boolean({
  description: "Set to true after completing security configuration. Gateway will not start without this.",
})),
```

- **Verification**: `pnpm tsgo` passes

---

## Phase 2: Onboarding Wizard Security Enforcement

**Goal**: Force users to complete mandatory security configuration during onboarding.

### Task 2.1: Add Mandatory Security Step to Onboarding

- [ ] **Status**: Not Started
- **File**: `src/wizard/onboarding.ts`
- **Description**: Add new step after `requireRiskAcknowledgement()` that forces security configuration
- **Implementation**:
  1. Create new function `requireSecurityConfiguration()`
  2. Prompt for auth mode selection (no default - must choose)
  3. Generate secure token or prompt for password
  4. Confirm DM policy (pairing by default, explicit selection required)
  5. Set `gateway.securityConfigured = true` only after completion
- **Key Changes**:
  - Cannot skip security prompts
  - Cannot proceed with "none" auth mode
  - Must acknowledge understanding of security model

### Task 2.2: Update Gateway Config Wizard for Mandatory Auth

- [ ] **Status**: Not Started
- **File**: `src/wizard/onboarding.gateway-config.ts`
- **Description**: Remove defaults from auth mode selection, require explicit choice
- **Implementation**:
  1. Change auth mode prompt to required selection (no "skip" option)
  2. Auto-generate secure token if token mode selected
  3. Validate password strength if password mode selected
  4. Configure `trustedProxy` settings if trusted-proxy mode selected
- **Prompt Changes**:

```typescript
const authMode = await select({
  message: "Choose gateway authentication mode (required):",
  options: [
    { value: "token", label: "Token - Recommended for most setups" },
    { value: "password", label: "Password - For human-memorable auth" },
    { value: "trusted-proxy", label: "Trusted Proxy - For reverse proxy setups" },
  ],
  // NO default - user must choose
});
```

### Task 2.3: Add Token Generation Helper

- [ ] **Status**: Not Started
- **File**: `src/wizard/onboarding.gateway-config.ts`
- **Description**: Auto-generate secure tokens during onboarding
- **Implementation**:

```typescript
import { randomBytes } from "node:crypto";

function generateSecureToken(): string {
  return randomBytes(32).toString("base64url");
}
```

- Display generated token and prompt user to save it securely

---

## Phase 3: Gateway Startup Validation

**Goal**: Block gateway startup without mandatory security configuration.

### Task 3.1: Add Security Validation to Gateway CLI

- [ ] **Status**: Not Started
- **File**: `src/cli/gateway-cli/run.ts`
- **Description**: Check security requirements before starting gateway
- **Implementation**: Add after line ~165 (after config exists check):

```typescript
import {
  validateSecurityRequirements,
  formatSecurityFailures,
} from "../../config/security-requirements.js";

// ... in runGatewayCommand() ...

// Security requirements check (no bypass)
const securityCheck = validateSecurityRequirements(cfg);
if (!securityCheck.valid) {
  runtime.error(formatSecurityFailures(securityCheck.failures));
  runtime.exit(1);
}
```

- **Verification**: Gateway refuses to start without security config

### Task 3.2: Add Server-Side Security Validation (Defense-in-Depth)

- [ ] **Status**: Not Started
- **File**: `src/gateway/server.impl.ts`
- **Description**: Double-check security requirements in server startup
- **Implementation**: Add validation in `startGatewayServer()` initialization block
- This catches cases where gateway is started programmatically

---

## Phase 4: Control UI Authentication Enforcement

**Goal**: Require authentication for ALL Control UI HTTP requests.

### Task 4.1: Add HTTP Auth to Control UI Static Files

- [ ] **Status**: Not Started
- **File**: `src/gateway/control-ui.ts`
- **Description**: Run `authorizeGatewayBearerRequestOrReply` before serving any Control UI file
- **Implementation**:
  1. Import `authorizeGatewayBearerRequestOrReply` from http-auth-helpers
  2. Add auth check before serving static files (around line 189)
  3. Return 401 with `WWW-Authenticate: Bearer` header on failure
  4. Auth check applies to ALL routes including `/bootstrap.json` and avatars

```typescript
// Before serving any file:
const authResult = await authorizeGatewayBearerRequestOrReply({
  req,
  res,
  auth: gatewayAuth,
  trustedProxies,
  rateLimiter,
});
if (!authResult.ok) {
  return; // Response already sent
}
```

### Task 4.2: Remove `allowInsecureAuth` and `dangerouslyDisableDeviceAuth`

- [ ] **Status**: Not Started
- **File**: `src/gateway/control-ui.ts`
- **Description**: Remove or block these dangerous bypass options
- **Implementation**:
  1. Remove handling of `gateway.controlUi.allowInsecureAuth`
  2. Remove handling of `gateway.controlUi.dangerouslyDisableDeviceAuth`
  3. If these config values are present, log warning and ignore them
  4. Update config schema to mark these as deprecated/removed

---

## Phase 5: Canvas/A2UI Authentication Hardening

**Goal**: Remove IP-based authentication fallback for canvas routes.

### Task 5.1: Remove IP-Based Canvas Auth Fallback

- [ ] **Status**: Not Started
- **File**: `src/canvas-host/server.ts`
- **Description**: Remove `hasAuthorizedWsClientForIp` fallback path
- **Implementation**:
  1. Find `authorizeCanvasRequest` function (around line 301-380)
  2. Remove the IP-based fallback block:

  ```typescript
  // REMOVE THIS BLOCK:
  if (isPrivateOrLoopbackAddress(clientIp) && hasAuthorizedWsClientForIp(clients, clientIp)) {
    return { authorized: true, method: "ip-fallback" };
  }
  ```

  3. Canvas routes now require explicit Bearer token auth

### Task 5.2: Remove Local Direct Request Bypass for Canvas

- [ ] **Status**: Not Started
- **File**: `src/canvas-host/server.ts`
- **Description**: Remove localhost bypass in canvas auth
- **Implementation**: Remove `isLocalDirectRequest` bypass - all requests require token

---

## Phase 6: Plugin Route Authentication

**Goal**: Enforce gateway auth on ALL plugin HTTP routes.

### Task 6.1: Add Auth to All Plugin Routes

- [ ] **Status**: Not Started
- **File**: `src/gateway/server/plugins-http.ts`
- **Description**: Run gateway auth on all plugin routes, not just `/api/channels/*`
- **Implementation**:
  1. Find plugin route handler registration
  2. Add `authorizeGatewayBearerRequestOrReply` middleware to all routes
  3. Remove the `/api/channels/*` special case - all routes now auth-protected

### Task 6.2: Update Plugin Documentation

- [ ] **Status**: Not Started
- **File**: `docs/tools/plugin.md`
- **Description**: Document that all plugin routes now require gateway auth
- **Changes**:
  - Remove references to plugins implementing their own auth
  - Document that gateway auth is enforced on all plugin HTTP routes
  - Note breaking change for plugins that relied on unauthenticated routes

---

## Phase 7: Rate Limiter Hardening

**Goal**: Apply rate limiting to ALL IPs including localhost.

### Task 7.1: Remove Loopback Exemption Default

- [ ] **Status**: Not Started
- **File**: `src/gateway/auth-rate-limit.ts`
- **Description**: Change `exemptLoopback` default to `false`
- **Implementation**:

```typescript
// Change from:
exemptLoopback: options.exemptLoopback ?? true,
// To:
exemptLoopback: options.exemptLoopback ?? false,
```

### Task 7.2: Update Rate Limiter Call Sites

- [ ] **Status**: Not Started
- **Files**: Search for `createAuthRateLimiter` usages
- **Description**: Remove any explicit `exemptLoopback: true` overrides
- **Verification**: Rate limiting applies to 127.0.0.1 requests

---

## Phase 8: Local Request Bypass Removal

**Goal**: Remove automatic auth bypass for localhost requests.

### Task 8.1: Remove `isLocalDirectRequest` Auth Bypass

- [ ] **Status**: Not Started
- **File**: `src/gateway/auth.ts`
- **Description**: The `isLocalDirectRequest` function should not be used for auth bypass
- **Implementation**:
  1. Keep `isLocalDirectRequest` function (useful for logging/diagnostics)
  2. Remove its usage as auth bypass in `authorizeGatewayConnect` and `authorizeCanvasRequest`
  3. All requests must provide valid credentials regardless of source IP

### Task 8.2: Update `authorizeGatewayConnect` to Remove Local Bypass

- [ ] **Status**: Not Started
- **File**: `src/gateway/auth.ts`
- **Description**: Remove `localDirect` bypass path in auth function
- **Find and remove**:

```typescript
// REMOVE any code like:
const localDirect = isLocalDirectRequest(req, trustedProxies);
if (localDirect && auth.mode === "none") {
  return { ok: true, method: "local" };
}
```

---

## Phase 9: Hooks Authentication Enforcement

**Goal**: Require hooks token when hooks are enabled.

### Task 9.1: Validate Hooks Token on Startup

- [ ] **Status**: Not Started
- **File**: `src/cli/gateway-cli/run.ts`
- **Description**: Fail startup if hooks are configured without `hooks.token`
- **Implementation**:

```typescript
const hooksConfig = cfg.hooks;
if (
  hooksConfig?.enabled !== false &&
  hooksConfig?.mappings &&
  Object.keys(hooksConfig.mappings).length > 0
) {
  if (!hooksConfig.token && !process.env.OPENCLAW_HOOKS_TOKEN) {
    runtime.error(
      "Hooks are configured but hooks.token is not set. Set hooks.token or OPENCLAW_HOOKS_TOKEN.",
    );
    runtime.exit(1);
  }
}
```

### Task 9.2: Add Hooks Token to Security Requirements

- [ ] **Status**: Not Started
- **File**: `src/config/security-requirements.ts`
- **Description**: Add hooks token check to security requirements
- **Implementation**: Add to `MANDATORY_SECURITY_REQUIREMENTS` array (conditional on hooks being enabled)

---

## Phase 10: Security Audit Tool Updates

**Goal**: Update audit tool to check new mandatory requirements.

### Task 10.1: Add Critical Severity for Missing Security Config

- [ ] **Status**: Not Started
- **File**: `src/security/audit.ts`
- **Description**: Add new audit checks with "critical" severity
- **New Checks**:
  - [ ] `gateway.securityConfigured` must be true
  - [ ] `gateway.auth.mode` must be explicitly set
  - [ ] Auth credential must be present
  - [ ] Rate limiter loopback exemption should be false
  - [ ] Control UI dangerous flags should not be present
  - [ ] Hooks token required when hooks enabled

### Task 10.2: Add `--strict` Flag to Security Audit

- [ ] **Status**: Not Started
- **File**: `src/security/audit.ts`
- **Description**: Add flag that fails with non-zero exit on any critical finding
- **Usage**: `openclaw security audit --strict`
- **Purpose**: CI/CD integration for security validation

---

## Phase 11: End-to-End Security Tests

**Goal**: Comprehensive test coverage for auth enforcement.

### Task 11.1: Create Mandatory Auth E2E Tests

- [ ] **Status**: Not Started
- **File**: `src/gateway/server.auth-mandatory.e2e.test.ts` (create new)
- **Tests**:
  - [ ] Gateway refuses to start without `gateway.securityConfigured`
  - [ ] Gateway refuses to start without auth mode
  - [ ] Gateway refuses to start without auth credential
  - [ ] Control UI returns 401 without Bearer token
  - [ ] Canvas routes return 401 without Bearer token
  - [ ] Plugin routes return 401 without Bearer token
  - [ ] WebSocket `connect` fails without valid auth
  - [ ] Rate limiting applies to localhost requests
  - [ ] Hooks require token when enabled

### Task 11.2: Update Existing Auth Tests

- [ ] **Status**: Not Started
- **File**: `src/gateway/server.auth.e2e.test.ts`
- **Description**: Update tests to reflect removal of bypass paths
- **Changes**:
  - Remove tests for localhost bypass (no longer valid)
  - Remove tests for IP-based canvas auth (no longer valid)
  - Update test fixtures to always include valid auth

---

## Phase 12: Documentation Updates

**Goal**: Comprehensive documentation of new security model.

### Task 12.1: Rewrite Gateway Security Documentation

- [ ] **Status**: Not Started
- **File**: `docs/gateway/security/index.md`
- **Changes**:
  - [ ] Document mandatory security configuration requirement
  - [ ] Remove references to localhost bypass
  - [ ] Remove references to IP-based canvas auth
  - [ ] Update "Quick check" section for new requirements
  - [ ] Add migration guide from previous versions
  - [ ] Document breaking changes

### Task 12.2: Update Configuration Reference

- [ ] **Status**: Not Started
- **File**: `docs/gateway/configuration-reference.md`
- **Changes**:
  - [ ] Mark `gateway.auth.mode` as required
  - [ ] Mark `gateway.securityConfigured` as required
  - [ ] Remove deprecated `allowInsecureAuth` docs
  - [ ] Remove deprecated `dangerouslyDisableDeviceAuth` docs

### Task 12.3: Add Migration Guide

- [ ] **Status**: Not Started
- **File**: `docs/gateway/security/migration-mandatory-auth.md` (create new)
- **Content**:
  - [ ] What changed and why
  - [ ] Step-by-step upgrade instructions
  - [ ] How to configure security for existing installations
  - [ ] Common error messages and solutions

### Task 12.4: Update CHANGELOG

- [ ] **Status**: Not Started
- **File**: `CHANGELOG.md`
- **Entry**:

```markdown
### Breaking Changes

- **Gateway now requires explicit security configuration**. The gateway will refuse to start without:
  - `gateway.auth.mode` set to `token`, `password`, or `trusted-proxy`
  - Corresponding authentication credentials configured
  - `gateway.securityConfigured: true` set after completing security setup

  Run `openclaw onboard` to complete mandatory security configuration.

- **Removed localhost authentication bypass**. All requests now require valid credentials regardless of source IP.

- **Removed IP-based canvas authentication**. Canvas/A2UI routes now require Bearer token authentication.

- **Removed Control UI dangerous bypass flags**. `allowInsecureAuth` and `dangerouslyDisableDeviceAuth` are no longer supported.

- **Rate limiting now applies to localhost**. The `exemptLoopback` default changed from `true` to `false`.

- **Plugin routes now require gateway auth**. All plugin HTTP routes are protected by gateway authentication.

- **Hooks require token when enabled**. Gateway will not start if hooks are configured without `hooks.token`.
```

---

## Phase 13: Final Verification

**Goal**: Ensure all changes work together correctly.

### Task 13.1: Full Test Suite

- [ ] **Status**: Not Started
- **Commands**:
  ```bash
  pnpm test
  pnpm test:coverage
  pnpm tsgo
  pnpm check
  ```
- **All must pass**

### Task 13.2: Manual Verification Checklist

- [ ] **Status**: Not Started
- **Verify**:
  - [ ] Fresh install requires security configuration
  - [ ] `openclaw onboard` forces security prompts
  - [ ] Gateway fails to start without security config
  - [ ] Existing config without security fails to start
  - [ ] Control UI requires Bearer token
  - [ ] Canvas requires Bearer token
  - [ ] WebSocket requires auth
  - [ ] Localhost requests require auth
  - [ ] `openclaw security audit` passes with proper config
  - [ ] `openclaw security audit --strict` exits non-zero on violations

### Task 13.3: Security Audit Verification

- [ ] **Status**: Not Started
- **Command**: `openclaw security audit --deep --strict`
- **Expected**: Clean pass with properly configured gateway

---

## Implementation Order

Execute phases in this order to minimize test breakage:

1. **Phase 1**: Security requirements schema (foundation)
2. **Phase 3**: Gateway startup validation (blocks startup without config)
3. **Phase 2**: Onboarding wizard updates (provides path to configure)
4. **Phase 4**: Control UI auth (endpoint hardening)
5. **Phase 5**: Canvas auth (endpoint hardening)
6. **Phase 6**: Plugin route auth (endpoint hardening)
7. **Phase 7**: Rate limiter hardening
8. **Phase 8**: Local bypass removal
9. **Phase 9**: Hooks auth enforcement
10. **Phase 10**: Security audit updates
11. **Phase 11**: E2E tests
12. **Phase 12**: Documentation
13. **Phase 13**: Final verification

---

## Rollback Plan

If critical issues discovered:

1. Revert `gateway.securityConfigured` check to optional
2. Keep auth enforcement but allow `--allow-insecure` CLI flag for migration period
3. Document workaround in GitHub issue

**Note**: This is a hard breaking change by design. Ensure thorough testing before release.

---

## Success Criteria

- [ ] Gateway refuses to start without explicit security configuration
- [ ] Zero endpoints accessible without authentication
- [ ] Onboarding wizard requires security configuration completion
- [ ] All existing bypass paths removed
- [ ] Security audit tool validates new requirements
- [ ] Full test suite passes
- [ ] Documentation updated with migration guide

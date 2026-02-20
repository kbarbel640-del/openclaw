---
name: security-audit
description: Implements Phase 10 of the Gateway Auth Enforcement Roadmap. Updates the security audit tool with new mandatory checks and adds --strict flag for CI.
tools:
  - read
  - edit
  - search
  - terminal
---

You are a security tooling engineer updating the OpenClaw security audit system.

## Chat Invocation

```
@copilot /security-audit

Implement Phase 10 of the Gateway Auth Enforcement Roadmap.
Read docs/security/GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md for full requirements.
Branch: gateway-auth/phase-10-security-audit
Commit via: scripts/committer
Verification: pnpm tsgo && pnpm check && pnpm test src/security/audit
```

For Sprint 9 (final verification):

```
@copilot /security-audit

Run openclaw security audit --strict and report results.
Fix any critical findings.
```

## Your Domain

| File                         | LOC    | Role                                                                 |
| ---------------------------- | ------ | -------------------------------------------------------------------- |
| `src/security/audit.ts`      | ~690   | Main audit logic: `runSecurityAudit`, `collectGatewayConfigFindings` |
| `src/security/audit.test.ts` | varies | Audit test suite                                                     |

## Task 10.1: Add New Critical Checks

Add these 6 new checks to `collectGatewayConfigFindings()`:

1. `gateway.security_not_configured` (critical) -- `gateway.securityConfigured !== true`
2. `gateway.auth_mode_not_set` (critical) -- mode not explicitly token/password/trusted-proxy
3. `gateway.auth_credential_missing` (critical) -- mode set but credentials missing
4. `gateway.rate_limit_loopback_exempt` (warn) -- `exemptLoopback` explicitly `true`
5. `gateway.dangerous_flags_present` (critical) -- `allowInsecureAuth` or `dangerouslyDisableDeviceAuth` present
6. `gateway.hooks_no_token` (critical, conditional) -- hooks enabled without token

## Task 10.2: Add `--strict` Flag

1. Add `strict?: boolean` parameter to `runSecurityAudit()`.
2. When `strict` is `true` and any critical finding exists: return failure result.
3. Wire into CLI command: add `--strict` option, exit(1) on critical findings.
4. Usage: `openclaw security audit --strict`

## Testing

Update `src/security/audit.test.ts`:

- Test each of the 6 new checks with passing and failing configs.
- Test `--strict` mode exit behavior.
- Do NOT change existing check IDs or modify existing tests.

## Coding Standards

- TypeScript ESM, strict typing, no `any`.
- Follow existing finding patterns exactly.
- New checks APPEND to findings array -- do not reorder existing.
- Keep `audit.ts` under ~700 LOC; extract helper if needed.

## Verification Gate

```bash
pnpm tsgo
pnpm test src/security/audit
pnpm check
```

## Branch

Create branch: `gateway-auth/phase-10-security-audit`

## Output Contract (MANDATORY)

When you finish implementation, you MUST end your response with:

```markdown
## Next Step

Phase 10 implementation complete. Now invoke **test-engineer** to verify:

    @copilot /test-engineer

    Verify Phase 10 (security-audit) implementation.
    Run: pnpm tsgo && pnpm check && pnpm test src/security/audit
    Verify: 6 new checks fire correctly, --strict flag exits 1 on critical findings.
    Report all results. Fix any failures.

After test-engineer confirms, update the tracker:

    @copilot /sprint-planner Phase 10 done. PR #NNN merged. Update tracker and give next step.
```

---
name: onboarding-wizard
description: Implements Phases 2 and 9 of the Gateway Auth Enforcement Roadmap. Enforces mandatory security configuration in the onboarding wizard and hooks auth.
tools: [vscode, execute, read, agent, edit, search, memory]
---

You are a CLI/UX engineer updating the OpenClaw onboarding wizard for mandatory security configuration.

## Chat Invocation

```
@copilot /onboarding-wizard

Implement Phases 2 and 9 of the Gateway Auth Enforcement Roadmap.
Read docs/security/GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md for full requirements.
Branch: gateway-auth/phase-2-9-onboarding-hooks
Commit via: scripts/committer
Verification: pnpm tsgo && pnpm check && pnpm test src/wizard/ src/config/security-requirements
```

## Your Domain

| File                                      | LOC    | Role                                 |
| ----------------------------------------- | ------ | ------------------------------------ |
| `src/wizard/onboarding.ts`                | ~468   | Main onboarding wizard flow          |
| `src/wizard/onboarding.gateway-config.ts` | ~253   | Gateway config sub-wizard            |
| `src/config/security-requirements.ts`     | varies | Security checks (created by Phase 1) |
| `src/cli/gateway-cli/run.ts`              | ~360   | Hooks validation addition            |

## Current Onboarding Flow (src/wizard/onboarding.ts)

```
1. requireRiskAcknowledgement()  -- line ~22
2. Config existence check
3. Flow selection (QuickStart / Manual)
4. Existing config handling (keep/modify/reset)
5. QuickStart defaults derivation
6. Gateway reachability probe
7. Mode selection (local/remote)
8. Workspace config
9. Auth choice (provider API keys)
10. Model selection
11. configureGatewayForOnboarding()  -- gateway-specific config
12. Channel setup
13. Skills setup
14. Hooks setup
15. Finalization
```

## Phase 2: Onboarding Enforcement

### Task 2.1: Add Mandatory Security Step

In `src/wizard/onboarding.ts`, INSERT a new `requireSecurityConfiguration()` function AFTER `requireRiskAcknowledgement()` (~line 22):

- Prompt for auth mode -- NO default, NO skip, NO "none"
- Generate token or validate password
- Set `gateway.securityConfigured = true` ONLY after completion

### Task 2.2: Update Gateway Config Wizard

In `src/wizard/onboarding.gateway-config.ts`:

- Remove `initialValue` from auth mode prompt -- user MUST choose explicitly.
- Keep `randomToken()` for auto-generation.
- Add password strength validation (min 12 chars).
- Display generated token with `@clack/prompts` `note()` and save warning.

### Task 2.3: Token Generation

Verify `randomToken()` uses `crypto.randomBytes` (cryptographically secure). Display via `note()`.

## Phase 9: Hooks Auth Enforcement

### Task 9.1: Validate Hooks Token on Startup

In `src/cli/gateway-cli/run.ts`, AFTER the security requirements check: if hooks enabled with mappings but no token, error and exit.

### Task 9.2: Add Hooks Token to Security Requirements

In `src/config/security-requirements.ts`, add a CONDITIONAL check -- only triggers when hooks are enabled with non-empty mappings.

## UI Framework

Use existing dependencies -- do NOT add new ones:

- `@clack/prompts`: `select()`, `text()`, `note()`, `confirm()`
- `src/cli/progress.ts`: spinners if needed
- `src/terminal/palette.ts`: colors (lobster seam convention)

## Coding Standards

- TypeScript ESM, strict typing, no `any`.
- Import with `.js` extensions.
- Keep files under 500 LOC.
- Reuse ALL existing helpers -- never duplicate.

## Verification Gate

```bash
pnpm tsgo
pnpm test src/wizard/ src/config/security-requirements
pnpm check
```

## Commit Convention

```bash
scripts/committer "security: require security config in onboarding wizard" \
  src/wizard/onboarding.ts \
  src/wizard/onboarding.gateway-config.ts

scripts/committer "security: validate hooks token on gateway startup" \
  src/cli/gateway-cli/run.ts \
  src/config/security-requirements.ts
```

## Branch

Create branch: `gateway-auth/phase-2-9-onboarding-hooks`

## Output Contract (MANDATORY)

When you finish implementation, you MUST end your response with:

```markdown
## Next Step

Phases 2 and 9 implementation complete. Now invoke **test-engineer** to verify:

    @copilot /test-engineer

    Verify Phases 2 and 9 (onboarding-wizard) implementation.
    Run: pnpm tsgo && pnpm check && pnpm test src/wizard/ src/config/security-requirements
    Verify: onboarding requires explicit auth mode, hooks require token when enabled.
    Report all results. Fix any failures.

After test-engineer confirms, update the tracker:

    @copilot /sprint-planner Phases 2 and 9 done. PR #NNN merged. Update tracker and give next step.
```

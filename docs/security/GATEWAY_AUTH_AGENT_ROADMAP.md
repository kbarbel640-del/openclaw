# Gateway Auth Enforcement -- Agent Execution Roadmap

> Complete step-by-step execution plan using GitHub Copilot custom agents with chat-based handoff.
> Each step shows the exact `@copilot` prompt to invoke. Follow the chain top-to-bottom.

**Roadmap**: [GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md](GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md)
**Tracker**: [GATEWAY_AUTH_SPRINT_TRACKER.md](GATEWAY_AUTH_SPRINT_TRACKER.md)
**Workflow**: [../../.github/agents/GATEWAY_AUTH_WORKFLOW.md](../../.github/agents/GATEWAY_AUTH_WORKFLOW.md)

---

## Agent Chain Overview

```
                          START
                            |
                            v
  +----------------------------------------------------------+
  |                                                          |
  |   For each Sprint (1-9):                                 |
  |                                                          |
  |   sprint-planner -----> specialized-agent                |
  |        ^                      |                          |
  |        |                      v                          |
  |        +---- sprint-planner <-- test-engineer            |
  |                                                          |
  +----------------------------------------------------------+
                            |
                            v
                         COMPLETE
```

### Per-Sprint Handoff Pattern

```
You: @copilot /sprint-planner Start Sprint N
         |
         | creates issues, updates tracker
         v
     Output: "Next Step: invoke @copilot /<agent>"
         |
You: @copilot /<agent> (copy-paste the prompt)
         |
         | implements the phase
         v
     Output: "Next Step: invoke @copilot /test-engineer"
         |
You: @copilot /test-engineer (copy-paste the prompt)
         |
         | verifies: tsgo + check + test
         |
     PASS?----YES----> Output: "invoke @copilot /sprint-planner"
         |                          |
         NO                   You: @copilot /sprint-planner Phase N done.
         |                          |
         v                          v
     Output: "re-invoke         sprint-planner updates tracker
     @copilot /<agent>"         and outputs next sprint prompt
         |
     (fix loop until PASS)
```

---

## Complete Execution Sequence

### Prerequisites

```bash
pnpm install && pnpm build && pnpm check && pnpm test
```

---

### Sprint 1: Foundation (Phase 1)

**Goal**: Create security requirements schema -- the foundation everything depends on.

| Step | Agent           | Action                             |
| ---- | --------------- | ---------------------------------- |
| 1.1  | sprint-planner  | Create Phase 1 issues              |
| 1.2  | security-schema | Implement security-requirements.ts |
| 1.3  | test-engineer   | Verify implementation              |
| 1.4  | sprint-planner  | Update tracker, get next step      |

#### Step 1.1: Plan

```
@copilot /sprint-planner

Start Sprint 1. Create GitHub issues for Phase 1 (Tasks 1.1, 1.2) of the Gateway Auth Enforcement Roadmap.
Read docs/security/GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md for full context.
Labels: security, gateway, breaking-change
Update docs/security/GATEWAY_AUTH_SPRINT_TRACKER.md to mark Phase 1 as in-progress.
```

#### Step 1.2: Implement

```
@copilot /security-schema

Implement Phase 1 of the Gateway Auth Enforcement Roadmap.
Read docs/security/GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md for full requirements.
Branch: gateway-auth/phase-1-security-schema
Commit via: scripts/committer
Verification: pnpm tsgo && pnpm check && pnpm test src/config/security-requirements.test.ts
```

#### Step 1.3: Verify

```
@copilot /test-engineer

Verify Phase 1 (security-schema) implementation.
Run: pnpm tsgo && pnpm check && pnpm test src/config/
Check that security-requirements.ts and security-requirements.test.ts exist and pass.
Report all results. Fix any failures.
```

#### Step 1.4: Close Sprint

```
@copilot /sprint-planner Phase 1 done. PR #NNN merged. Update tracker and give next step.
```

**Unlocks**: Sprints 2, 3

---

### Sprint 2: Startup Validation (Phase 3)

**Goal**: Block gateway startup without security configuration.

| Step | Agent          | Action                                     |
| ---- | -------------- | ------------------------------------------ |
| 2.1  | sprint-planner | Create Phase 3 issues                      |
| 2.2  | auth-hardening | Add validateSecurityRequirements to run.ts |
| 2.3  | test-engineer  | Verify implementation                      |
| 2.4  | sprint-planner | Update tracker, get next step              |

#### Step 2.1: Plan

```
@copilot /sprint-planner

Start Sprint 2. Create issues for Phase 3 (startup validation).
Depends on: Sprint 1 (Phase 1) must be done.
Update tracker to mark Phase 3 as in-progress.
```

#### Step 2.2: Implement

```
@copilot /auth-hardening

Implement Phase 3 of the Gateway Auth Enforcement Roadmap.
Read docs/security/GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md for full requirements.
Branch: gateway-auth/phase-3-startup-validation
Commit via: scripts/committer
Verification: pnpm tsgo && pnpm check && pnpm test src/cli/gateway-cli/ src/gateway/server.impl
```

#### Step 2.3: Verify

```
@copilot /test-engineer

Verify Phase 3 (auth-hardening: startup validation) implementation.
Run: pnpm tsgo && pnpm check && pnpm test src/gateway/ src/cli/gateway-cli/
Report all results. Fix any failures.
```

#### Step 2.4: Close Sprint

```
@copilot /sprint-planner Phase 3 done. PR #NNN merged. Update tracker and give next step.
```

**Unlocks**: Sprint 4

---

### Sprint 3: Onboarding Wizard (Phases 2 + 9)

**Goal**: Force security configuration during onboarding, validate hooks token.

| Step | Agent             | Action                                  |
| ---- | ----------------- | --------------------------------------- |
| 3.1  | sprint-planner    | Create Phases 2 + 9 issues              |
| 3.2  | onboarding-wizard | Mandatory auth step + hooks enforcement |
| 3.3  | test-engineer     | Verify implementation                   |
| 3.4  | sprint-planner    | Update tracker, get next step           |

#### Step 3.1: Plan

```
@copilot /sprint-planner

Start Sprint 3. Create issues for Phases 2 and 9 (onboarding + hooks).
Depends on: Sprint 1 (Phase 1) must be done.
Update tracker to mark Phases 2 and 9 as in-progress.
```

#### Step 3.2: Implement

```
@copilot /onboarding-wizard

Implement Phases 2 and 9 of the Gateway Auth Enforcement Roadmap.
Read docs/security/GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md for full requirements.
Branch: gateway-auth/phase-2-9-onboarding-hooks
Commit via: scripts/committer
Verification: pnpm tsgo && pnpm check && pnpm test src/wizard/ src/config/security-requirements
```

#### Step 3.3: Verify

```
@copilot /test-engineer

Verify Phases 2 and 9 (onboarding-wizard) implementation.
Run: pnpm tsgo && pnpm check && pnpm test src/wizard/ src/config/security-requirements
Verify: onboarding requires explicit auth mode, hooks require token when enabled.
Report all results. Fix any failures.
```

#### Step 3.4: Close Sprint

```
@copilot /sprint-planner Phases 2 and 9 done. PR #NNN merged. Update tracker and give next step.
```

---

### Sprint 4: Endpoint Hardening (Phases 4, 5, 6)

**Goal**: Require auth on Control UI, Canvas, and Plugin routes.

| Step | Agent          | Action                                  |
| ---- | -------------- | --------------------------------------- |
| 4.1  | sprint-planner | Create Phases 4, 5, 6 issues            |
| 4.2  | auth-hardening | Add auth to control-ui, canvas, plugins |
| 4.3  | test-engineer  | Verify implementation                   |
| 4.4  | sprint-planner | Update tracker, get next step           |

#### Step 4.1: Plan

```
@copilot /sprint-planner

Start Sprint 4. Create issues for Phases 4, 5, 6 (endpoint hardening).
Depends on: Sprint 2 (Phase 3) must be done.
Update tracker to mark Phases 4, 5, 6 as in-progress.
```

#### Step 4.2: Implement

```
@copilot /auth-hardening

Implement Phases 4, 5, and 6 of the Gateway Auth Enforcement Roadmap.
Read docs/security/GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md for full requirements.
Branch: gateway-auth/phase-4-5-6-endpoint-hardening
Commit via: scripts/committer
Verification: pnpm tsgo && pnpm check && pnpm test src/gateway/
```

#### Step 4.3: Verify

```
@copilot /test-engineer

Verify Phases 4, 5, 6 (auth-hardening: endpoint hardening) implementation.
Run: pnpm tsgo && pnpm check && pnpm test src/gateway/
Verify: Control UI, Canvas, and Plugin routes return 401 without valid auth.
Report all results. Fix any failures.
```

#### Step 4.4: Close Sprint

```
@copilot /sprint-planner Phases 4, 5, 6 done. PR #NNN merged. Update tracker and give next step.
```

**Unlocks**: Sprint 5

---

### Sprint 5: Rate Limiter and Bypass Removal (Phases 7, 8)

**Goal**: Remove localhost exemptions and all remaining auth bypasses.

| Step | Agent          | Action                                     |
| ---- | -------------- | ------------------------------------------ |
| 5.1  | sprint-planner | Create Phases 7, 8 issues                  |
| 5.2  | auth-hardening | Change exemptLoopback, remove local bypass |
| 5.3  | test-engineer  | Verify implementation                      |
| 5.4  | sprint-planner | Update tracker, get next step              |

#### Step 5.1: Plan

```
@copilot /sprint-planner

Start Sprint 5. Create issues for Phases 7 and 8 (rate limiter + bypass removal).
Depends on: Sprint 4 (Phases 4-6) must be done.
Update tracker to mark Phases 7 and 8 as in-progress.
```

#### Step 5.2: Implement

```
@copilot /auth-hardening

Implement Phases 7 and 8 of the Gateway Auth Enforcement Roadmap.
Read docs/security/GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md for full requirements.
Branch: gateway-auth/phase-7-8-rate-limit-bypass-removal
Commit via: scripts/committer
Verification: pnpm tsgo && pnpm check && pnpm test src/gateway/auth
```

#### Step 5.3: Verify

```
@copilot /test-engineer

Verify Phases 7, 8 (auth-hardening: rate limiter + bypass removal) implementation.
Run: pnpm tsgo && pnpm check && pnpm test src/gateway/
Verify: exemptLoopback defaults to false, no auth bypass paths remain.
Report all results. Fix any failures.
```

#### Step 5.4: Close Sprint

```
@copilot /sprint-planner Phases 7 and 8 done. PR #NNN merged. Update tracker and give next step.
```

**Unlocks**: Sprints 6, 7

---

### Sprint 6: Security Audit (Phase 10)

**Goal**: Add 6 new audit checks and --strict flag for CI.

| Step | Agent          | Action                        |
| ---- | -------------- | ----------------------------- |
| 6.1  | sprint-planner | Create Phase 10 issues        |
| 6.2  | security-audit | Add checks + --strict flag    |
| 6.3  | test-engineer  | Verify implementation         |
| 6.4  | sprint-planner | Update tracker, get next step |

#### Step 6.1: Plan

```
@copilot /sprint-planner

Start Sprint 6. Create issues for Phase 10 (security audit updates).
Depends on: Sprints 1-5 must be done.
Update tracker to mark Phase 10 as in-progress.
```

#### Step 6.2: Implement

```
@copilot /security-audit

Implement Phase 10 of the Gateway Auth Enforcement Roadmap.
Read docs/security/GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md for full requirements.
Branch: gateway-auth/phase-10-security-audit
Commit via: scripts/committer
Verification: pnpm tsgo && pnpm check && pnpm test src/security/audit
```

#### Step 6.3: Verify

```
@copilot /test-engineer

Verify Phase 10 (security-audit) implementation.
Run: pnpm tsgo && pnpm check && pnpm test src/security/audit
Verify: 6 new checks fire correctly, --strict flag exits 1 on critical findings.
Report all results. Fix any failures.
```

#### Step 6.4: Close Sprint

```
@copilot /sprint-planner Phase 10 done. PR #NNN merged. Update tracker and give next step.
```

---

### Sprint 7: E2E Tests (Phase 11)

**Goal**: Create comprehensive E2E tests for mandatory auth, update broken bypass tests.

| Step | Agent          | Action                                |
| ---- | -------------- | ------------------------------------- |
| 7.1  | sprint-planner | Create Phase 11 issues                |
| 7.2  | test-engineer  | Implement 9 E2E tests + update broken |
| 7.3  | sprint-planner | Update tracker, get next step         |

#### Step 7.1: Plan

```
@copilot /sprint-planner

Start Sprint 7. Create issues for Phase 11 (E2E tests).
Depends on: Sprints 1-5 must be done.
Update tracker to mark Phase 11 as in-progress.
```

#### Step 7.2: Implement and Self-Verify

```
@copilot /test-engineer

Implement Phase 11 of the Gateway Auth Enforcement Roadmap.
Read docs/security/GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md for full requirements.
Branch: gateway-auth/phase-11-e2e-tests
Commit via: scripts/committer
Verification: pnpm test && pnpm test:coverage
```

#### Step 7.3: Close Sprint

```
@copilot /sprint-planner Phase 11 done. PR #NNN merged. Update tracker and give next step.
```

---

### Sprint 8: Documentation (Phase 12)

**Goal**: Update security docs, create migration guide, update changelog.

| Step | Agent          | Action                             |
| ---- | -------------- | ---------------------------------- |
| 8.1  | sprint-planner | Create Phase 12 issues             |
| 8.2  | docs-writer    | Write migration guide, update docs |
| 8.3  | sprint-planner | Update tracker, get next step      |

#### Step 8.1: Plan

```
@copilot /sprint-planner

Start Sprint 8. Create issues for Phase 12 (documentation).
Depends on: Sprints 1-7 must be done.
Update tracker to mark Phase 12 as in-progress.
```

#### Step 8.2: Implement

```
@copilot /docs-writer

Implement Phase 12 of the Gateway Auth Enforcement Roadmap.
Read docs/security/GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md for full requirements.
Branch: gateway-auth/phase-12-documentation
Commit via: scripts/committer
Verification: pnpm check
```

#### Step 8.3: Close Sprint

```
@copilot /sprint-planner Phase 12 done. PR #NNN merged. Update tracker and give next step.
```

---

### Sprint 9: Final Verification (Phase 13)

**Goal**: Full-stack verification -- all tests, coverage, security audit.

| Step | Agent          | Action                                |
| ---- | -------------- | ------------------------------------- |
| 9.1  | sprint-planner | Start final verification              |
| 9.2  | test-engineer  | Full gate: build + check + test + cov |
| 9.3  | security-audit | Run --strict, verify zero critical    |
| 9.4  | HUMAN          | Manual verification checklist         |
| 9.5  | sprint-planner | Final closeout                        |

#### Step 9.1: Plan

```
@copilot /sprint-planner

Start Sprint 9. Final verification phase (Phase 13).
Update tracker to mark Phase 13 as in-progress.
```

#### Step 9.2: Full Test Verification

```
@copilot /test-engineer

Phase 13 final verification. Run:
pnpm build && pnpm check && pnpm test && pnpm test:coverage && pnpm tsgo
Report all results. Fix any failures.
```

#### Step 9.3: Security Audit

```
@copilot /security-audit

Run openclaw security audit --strict and report results.
Fix any critical findings.
```

#### Step 9.4: Manual Verification (HUMAN)

- [ ] Fresh install requires security configuration
- [ ] `openclaw onboard` forces security prompts with no skip
- [ ] Gateway fails to start without `securityConfigured: true`
- [ ] Gateway fails to start without `auth.mode`
- [ ] Gateway fails to start without auth credential
- [ ] Control UI returns 401 without Bearer token
- [ ] Canvas routes return 401 without Bearer token
- [ ] Plugin routes return 401 without Bearer token
- [ ] WebSocket connect fails without valid auth
- [ ] Localhost requests require auth
- [ ] Rate limiting applies to localhost
- [ ] Hooks require token when enabled
- [ ] `openclaw security audit --strict` exits 0 with proper config, 1 without

#### Step 9.5: Closeout

```
@copilot /sprint-planner

All 13 phases complete. Final closeout:
- Mark all remaining tasks as done
- Add final verification date
- Update Summary section counts
- Add Sprint Log entry for project completion
```

---

## Dependency Graph

```
Phase 1 (security-schema)
   |
   +---> Phase 3 (startup validation)
   |        |
   |        +---> Phase 4 (control UI auth)
   |        +---> Phase 5 (canvas auth)
   |        +---> Phase 6 (plugin auth)
   |                 |
   |                 +---> Phase 7 (rate limiter)
   |                 +---> Phase 8 (local bypass)
   |
   +---> Phase 2 (onboarding wizard)
   +---> Phase 9 (hooks auth)
   |
   +---> Phase 10 (security audit) [depends on 1-9]
   +---> Phase 11 (E2E tests) [depends on 1-8]
   +---> Phase 12 (documentation) [depends on 1-11]
   +---> Phase 13 (final verification) [depends on ALL]
```

---

## Error Recovery

If test-engineer reports FAIL:

```
test-engineer FAIL
     |
     v
Re-invoke the implementing agent with fix instructions:

    @copilot /<original-agent>

    Fix the following issues from Phase <N>:
    1. <issue from test-engineer output>
    2. <issue from test-engineer output>
    Verification: pnpm tsgo && pnpm check && pnpm test <path>

     |
     v
Re-verify:

    @copilot /test-engineer

    Re-verify Phase <N> after fixes.
    Run: pnpm tsgo && pnpm check && pnpm test <path>

     |
     v
If PASS: continue to sprint-planner
If FAIL again: implement fix manually, then re-verify
```

---

## Quick Start

To begin the entire roadmap from scratch:

```
@copilot /sprint-planner

Initialize the Gateway Auth Enforcement project.
Read docs/security/GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md for full context.
Read docs/security/GATEWAY_AUTH_SPRINT_TRACKER.md for current status.
Create issues for Phase 1 (Sprint 1) and start the execution chain.
```

Then follow the `## Next Step` prompts from each agent.

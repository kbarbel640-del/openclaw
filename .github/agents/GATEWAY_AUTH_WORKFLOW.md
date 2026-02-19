# Gateway Auth Enforcement — Chat-Driven Agent Workflow

> Execute the [Gateway Auth Enforcement Roadmap](../../docs/security/GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md) using GitHub Copilot custom agents with explicit chat-to-chat handoff.

**Last Updated**: 2025-07-14

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Agent Inventory](#agent-inventory)
- [Sprint Execution Chain](#sprint-execution-chain)
- [Quick Reference Prompts](#quick-reference-prompts)
- [Error Recovery](#error-recovery)
- [Verification Checklist](#verification-checklist)
- [Rollback](#rollback)

---

## Overview

This workflow uses **7 specialized GitHub Copilot agents** chained via explicit chat handoff. Each agent ends its response with a `## Next Step` block containing the exact `@copilot /<agent>` prompt to invoke next. The human operator copies and pastes the prompt to drive the pipeline forward.

**Key principle**: Agents do NOT invoke each other. Instead, each agent's Output Contract provides the exact prompt for the next step. The human operator is the orchestrator.

### Execution Model

```
Human pastes prompt → Agent runs → Agent outputs "## Next Step" → Human pastes next prompt → ...
```

Every agent follows this contract:

1. Do the work (implement, test, or verify)
2. Run verification gates (`pnpm tsgo && pnpm check && pnpm test <path>`)
3. Commit via `scripts/committer`
4. End with `## Next Step` containing the exact next `@copilot` prompt

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                         HUMAN OPERATOR                                │
│                                                                       │
│  Copies ## Next Step prompts from one agent → pastes to invoke next   │
│  Reviews PRs · Merges when ready · Provides feedback if needed        │
└───────────────┬───────────────────────────────────────────────────────┘
                │
                │ paste @copilot /<agent> prompt
                ▼
┌───────────────────────────────────────────────────────────────────────┐
│                      AGENT CHAIN (per sprint)                         │
│                                                                       │
│   sprint-planner ──► implementing agent ──► test-engineer ──►         │
│                        (one of 5)           (verify)                  │
│                                                  │                    │
│                                                  ▼                    │
│                                           sprint-planner              │
│                                           (update tracker,            │
│                                            give next sprint)          │
└───────────────────────────────────────────────────────────────────────┘

Standard chain per sprint:
  1. sprint-planner  → assigns sprint, gives implementing agent prompt
  2. <impl-agent>    → does the work, ends with test-engineer prompt
  3. test-engineer   → verifies, ends with sprint-planner prompt
  4. sprint-planner  → marks done, gives next sprint prompt
  5. Repeat from step 2 with next implementing agent
```

---

## Agent Inventory

| Agent               | File                         | Domain                         | Sprints   |
| ------------------- | ---------------------------- | ------------------------------ | --------- |
| `sprint-planner`    | `sprint-planner.agent.md`    | Orchestration, tracking        | All       |
| `security-schema`   | `security-schema.agent.md`   | Config schema, security types  | 1         |
| `auth-hardening`    | `auth-hardening.agent.md`    | Gateway endpoints, bypasses    | 2, 4, 5   |
| `onboarding-wizard` | `onboarding-wizard.agent.md` | Wizard UX, hooks auth          | 3         |
| `security-audit`    | `security-audit.agent.md`    | Audit tool, --strict flag      | 6, 9      |
| `test-engineer`     | `test-engineer.agent.md`     | Testing, verification          | 7, 9, ALL |
| `docs-writer`       | `docs-writer.agent.md`       | Documentation, migration guide | 8         |

### Sprint-to-Agent Mapping

| Sprint | Phases  | Implementing Agent | Description                   |
| ------ | ------- | ------------------ | ----------------------------- |
| 1      | 1       | security-schema    | Security requirements module  |
| 2      | 3       | auth-hardening     | Gateway startup validation    |
| 3      | 2, 9    | onboarding-wizard  | Onboarding + hooks auth       |
| 4      | 4, 5, 6 | auth-hardening     | Endpoint hardening            |
| 5      | 7, 8    | auth-hardening     | Rate limiter + bypass removal |
| 6      | 10      | security-audit     | Audit tool updates            |
| 7      | 11      | test-engineer      | E2E test suite                |
| 8      | 12      | docs-writer        | Documentation                 |
| 9      | 13      | test-engineer      | Final verification            |

---

## Sprint Execution Chain

### How to Start

Paste this into Copilot chat to begin:

```
@copilot /sprint-planner

Initialize the Gateway Auth Enforcement project.
Read docs/security/GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md and create the sprint tracker.
List all 9 sprints with status. Give me the first sprint prompt.
```

### How to Continue

After each agent finishes, it provides a `## Next Step` section. Copy the prompt and paste it into a new Copilot chat. The chain is:

```
sprint-planner → impl-agent → test-engineer → sprint-planner → impl-agent → ...
```

### Sprint Details

#### Sprint 1: Foundation (Phase 1)

**Agent**: `security-schema`

Chain: `sprint-planner` → `security-schema` → `test-engineer` → `sprint-planner`

Creates:

- `src/config/security-requirements.ts`
- `src/config/security-requirements.test.ts`
- Adds `securityConfigured` to gateway config types

#### Sprint 2: Startup Validation (Phase 3)

**Agent**: `auth-hardening`

Chain: `sprint-planner` → `auth-hardening` → `test-engineer` → `sprint-planner`

Depends on: Sprint 1 merged

Modifies:

- `src/cli/gateway-cli/run.ts`
- `src/gateway/server.impl.ts`

#### Sprint 3: Onboarding Wizard (Phases 2, 9)

**Agent**: `onboarding-wizard`

Chain: `sprint-planner` → `onboarding-wizard` → `test-engineer` → `sprint-planner`

Depends on: Sprint 1 merged

Modifies:

- `src/wizard/onboarding.ts`
- `src/wizard/onboarding.gateway-config.ts`
- `src/config/security-requirements.ts`

#### Sprint 4: Endpoint Hardening (Phases 4, 5, 6)

**Agent**: `auth-hardening`

Chain: `sprint-planner` → `auth-hardening` → `test-engineer` → `sprint-planner`

Depends on: Sprints 2 and 3 merged

Modifies:

- `src/gateway/control-ui.ts`
- `src/gateway/server-http.ts`
- `src/gateway/server/plugins-http.ts`

#### Sprint 5: Rate Limiter and Bypass Removal (Phases 7, 8)

**Agent**: `auth-hardening`

Chain: `sprint-planner` → `auth-hardening` → `test-engineer` → `sprint-planner`

Depends on: Sprint 4 merged

Modifies:

- `src/gateway/auth-rate-limit.ts`
- `src/gateway/auth.ts`

#### Sprint 6: Security Audit (Phase 10)

**Agent**: `security-audit`

Chain: `sprint-planner` → `security-audit` → `test-engineer` → `sprint-planner`

Depends on: Sprint 5 merged

Modifies:

- `src/security/audit.ts`
- `src/security/audit.test.ts`

#### Sprint 7: E2E Tests (Phase 11)

**Agent**: `test-engineer`

Chain: `sprint-planner` → `test-engineer` (impl) → `test-engineer` (verify) → `sprint-planner`

Depends on: Sprint 6 merged

Creates/modifies:

- `src/gateway/server.auth-mandatory.e2e.test.ts`
- Multiple existing test files updated

#### Sprint 8: Documentation (Phase 12)

**Agent**: `docs-writer`

Chain: `sprint-planner` → `docs-writer` → `sprint-planner`

Depends on: Sprint 7 merged

Creates/modifies:

- `docs/gateway/security/index.md`
- `docs/gateway/security/migration-mandatory-auth.md`
- `docs/gateway/configuration-reference.md`
- `CHANGELOG.md`

#### Sprint 9: Final Verification (Phase 13)

**Agents**: `test-engineer` → `security-audit` → `sprint-planner`

Chain: `sprint-planner` → `test-engineer` (full verify) → `security-audit` (--strict) → `sprint-planner` (closeout)

Depends on: All sprints 1-8 merged

---

## Quick Reference Prompts

Copy-paste these prompts to drive each sprint. Each prompt is self-contained.

### Sprint 1

```
@copilot /security-schema

Implement Phase 1 of the Gateway Auth Enforcement Roadmap.
Read docs/security/GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md for full requirements.
Branch: gateway-auth/phase-1-security-schema
Commit via: scripts/committer
Verification: pnpm tsgo && pnpm check && pnpm test src/config/security-requirements.test.ts
```

### Sprint 2

```
@copilot /auth-hardening

Implement Phase 3 of the Gateway Auth Enforcement Roadmap.
Read docs/security/GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md for full requirements.
Branch: gateway-auth/phase-3-startup-validation
Commit via: scripts/committer
Verification: pnpm tsgo && pnpm check && pnpm test src/gateway/
```

### Sprint 3

```
@copilot /onboarding-wizard

Implement Phases 2 and 9 of the Gateway Auth Enforcement Roadmap.
Read docs/security/GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md for full requirements.
Branch: gateway-auth/phase-2-9-onboarding-hooks
Commit via: scripts/committer
Verification: pnpm tsgo && pnpm check && pnpm test src/wizard/ src/config/security-requirements
```

### Sprint 4

```
@copilot /auth-hardening

Implement Phases 4, 5, 6 of the Gateway Auth Enforcement Roadmap.
Read docs/security/GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md for full requirements.
Branch: gateway-auth/phase-4-5-6-endpoint-hardening
Commit via: scripts/committer
Verification: pnpm tsgo && pnpm check && pnpm test src/gateway/
```

### Sprint 5

```
@copilot /auth-hardening

Implement Phases 7, 8 of the Gateway Auth Enforcement Roadmap.
Read docs/security/GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md for full requirements.
Branch: gateway-auth/phase-7-8-bypass-removal
Commit via: scripts/committer
Verification: pnpm tsgo && pnpm check && pnpm test src/gateway/
```

### Sprint 6

```
@copilot /security-audit

Implement Phase 10 of the Gateway Auth Enforcement Roadmap.
Read docs/security/GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md for full requirements.
Branch: gateway-auth/phase-10-security-audit
Commit via: scripts/committer
Verification: pnpm tsgo && pnpm check && pnpm test src/security/audit
```

### Sprint 7

```
@copilot /test-engineer

Implement Phase 11 of the Gateway Auth Enforcement Roadmap.
Read docs/security/GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md for full requirements.
Branch: gateway-auth/phase-11-e2e-tests
Commit via: scripts/committer
Verification: pnpm test && pnpm test:coverage
```

### Sprint 8

```
@copilot /docs-writer

Implement Phase 12 of the Gateway Auth Enforcement Roadmap.
Read docs/security/GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md for full requirements.
Branch: gateway-auth/phase-12-documentation
Commit via: scripts/committer
Verification: pnpm check
```

### Sprint 9

```
@copilot /test-engineer

Phase 13 final verification. Run:
pnpm build && pnpm check && pnpm test && pnpm test:coverage && pnpm tsgo
Report all results. Fix any failures.
```

Then:

```
@copilot /security-audit

Run openclaw security audit --strict and report results.
Fix any critical findings.
```

Then:

```
@copilot /sprint-planner All phases complete. Mark all tasks done. Final closeout.
```

---

## Error Recovery

### Test Failures

If `test-engineer` reports FAIL:

1. Copy the failure details from the `## Next Step` block
2. Paste the re-invoke prompt for the original implementing agent
3. After fixes, re-invoke `test-engineer` to re-verify

### Merge Conflicts

If a sprint branch has conflicts with `main`:

```
@copilot /sprint-planner

Sprint <N> has merge conflicts. Rebase branch gateway-auth/<branch> on main and resolve.
```

### Stuck Agent

If an agent seems stuck or produces incomplete output:

```
@copilot /<agent-name>

Resume Phase <N> implementation. Previous attempt was incomplete.
Read the existing code on branch gateway-auth/<branch> and continue from where it left off.
Run verification: pnpm tsgo && pnpm check && pnpm test <path>
```

---

## Verification Checklist

After all 9 sprints complete:

- [ ] `pnpm build` passes
- [ ] `pnpm tsgo` passes
- [ ] `pnpm check` passes
- [ ] `pnpm test` passes (all tests)
- [ ] `pnpm test:coverage` meets 70% thresholds
- [ ] `openclaw security audit --strict` reports no critical findings
- [ ] Gateway refuses to start without `securityConfigured: true`
- [ ] Gateway refuses to start without explicit auth mode
- [ ] All endpoints return 401 without authentication
- [ ] Onboarding wizard requires explicit auth mode selection
- [ ] Hooks require token when enabled
- [ ] `allowInsecureAuth` and `dangerouslyDisableDeviceAuth` are deprecated
- [ ] `exemptLoopback` defaults to `false`
- [ ] Documentation updated, migration guide created
- [ ] CHANGELOG updated with breaking changes

---

## Rollback

If a sprint introduces regressions that cannot be fixed:

1. Revert the PR: `git revert <merge-commit>`
2. Update tracker: `@copilot /sprint-planner Sprint <N> reverted. Mark as not-started.`
3. Re-attempt with additional context about what went wrong

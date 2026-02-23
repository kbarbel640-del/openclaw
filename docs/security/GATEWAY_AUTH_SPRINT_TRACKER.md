# Gateway Auth Enforcement — Sprint Tracker

> Machine-readable status tracker for the [Gateway Auth Enforcement Roadmap](./GATEWAY_AUTH_ENFORCEMENT_ROADMAP.md).
> Updated by the `sprint-planner` agent and developers after each phase transition.

**Project Start**: 2026-02-18

---

## Status Legend

| Status        | Meaning                             |
| ------------- | ----------------------------------- |
| `not-started` | Work has not begun                  |
| `in-progress` | Agent is working / PR being created |
| `pr-open`     | PR submitted, awaiting review       |
| `review`      | In review-pr / prepare-pr pipeline  |
| `done`        | Merged to main                      |
| `blocked`     | Waiting on dependency (see Notes)   |

---

## Sprint Status

| Phase | Task | Description                                                 | Status      | PR  | Agent             | Updated    | Notes                |
| ----- | ---- | ----------------------------------------------------------- | ----------- | --- | ----------------- | ---------- | -------------------- |
| 1     | 1.1  | Create `security-requirements.ts`                           | done        | —   | security-schema   | 2026-02-20 | Tests: 36/36 pass ✓  |
| 1     | 1.2  | Add `securityConfigured` to config schema                   | done        | —   | security-schema   | 2026-02-20 | Tests: 36/36 pass ✓  |
| 3     | 3.1  | Gateway CLI security validation                             | done        | —   | auth-hardening    | 2026-02-20 | Tests: 1,182 pass ✓  |
| 3     | 3.2  | Server-side security validation (defense-in-depth)          | done        | —   | auth-hardening    | 2026-02-20 | Tests: 1,182 pass ✓  |
| 2     | 2.1  | Mandatory security step in onboarding                       | done        | —   | onboarding-wizard | 2026-02-20 | Wizard enforces auth |
| 2     | 2.2  | Gateway config wizard mandatory auth                        | done        | —   | onboarding-wizard | 2026-02-20 | Wizard enforces auth |
| 2     | 2.3  | Token generation helper                                     | done        | —   | onboarding-wizard | 2026-02-20 | Wizard enforces auth |
| 4     | 4.1  | Control UI HTTP auth                                        | done        | —   | auth-hardening    | 2026-02-20 | 410 tests pass ✓     |
| 4     | 4.2  | Remove `allowInsecureAuth` / `dangerouslyDisableDeviceAuth` | done        | —   | auth-hardening    | 2026-02-20 | Flags deprecated ✓   |
| 5     | 5.1  | Remove IP-based canvas auth fallback                        | done        | —   | auth-hardening    | 2026-02-20 | IP bypass removed ✓  |
| 5     | 5.2  | Remove local direct request canvas bypass                   | done        | —   | auth-hardening    | 2026-02-20 | Local bypass gone ✓  |
| 6     | 6.1  | Add auth to all plugin routes                               | done        | —   | auth-hardening    | 2026-02-20 | All routes auth ✓    |
| 6     | 6.2  | Update plugin documentation                                 | not-started | —   | docs-writer       | —          | Depends: 6.1         |
| 7     | 7.1  | Change `exemptLoopback` default to `false`                  | done        | —   | auth-hardening    | 2026-02-23 | 410 tests pass ✓     |
| 7     | 7.2  | Remove explicit `exemptLoopback: true` overrides            | done        | —   | auth-hardening    | 2026-02-23 | No overrides found   |
| 8     | 8.1  | Remove `isLocalDirectRequest` auth bypass usage             | done        | —   | auth-hardening    | 2026-02-23 | Bypass removed ✓     |
| 8     | 8.2  | Update `authorizeGatewayConnect` local bypass               | done        | —   | auth-hardening    | 2026-02-23 | localDirect removed  |
| 9     | 9.1  | Hooks token startup validation                              | done        | —   | onboarding-wizard | 2026-02-20 | Hooks secured        |
| 9     | 9.2  | Hooks token security requirement                            | done        | —   | onboarding-wizard | 2026-02-20 | Hooks secured        |
| 10    | 10.1 | Critical severity audit checks                              | done        | —   | security-audit    | 2026-02-23 | Doctor updated ✓     |
| 10    | 10.2 | `--strict` flag for security audit                          | done        | —   | security-audit    | 2026-02-23 | --strict added ✓     |
| 11    | 11.1 | Mandatory auth E2E tests                                    | done        | —   | test-engineer     | 2026-02-23 | E2E tests pass ✓     |
| 11    | 11.2 | Update existing auth tests                                  | done        | —   | test-engineer     | 2026-02-23 | Legacy tests fixed ✓ |
| 12    | 12.1 | Rewrite gateway security docs                               | not-started | —   | docs-writer       | —          | Depends: Phases 1-11 |
| 12    | 12.2 | Update configuration reference                              | not-started | —   | docs-writer       | —          | Depends: 12.1        |
| 12    | 12.3 | Create migration guide                                      | not-started | —   | docs-writer       | —          | Depends: 12.1        |
| 12    | 12.4 | Update CHANGELOG                                            | not-started | —   | docs-writer       | —          | Depends: 12.1        |
| 13    | 13.1 | Full test suite pass                                        | not-started | —   | test-engineer     | —          | Depends: All         |
| 13    | 13.2 | Manual verification checklist                               | not-started | —   | human             | —          | Depends: 13.1        |
| 13    | 13.3 | Security audit `--strict` verification                      | not-started | —   | security-audit    | —          | Depends: 13.1        |

---

## Summary

- **Total Tasks**: 30
- **Done**: 22
- **In Progress**: 0
- **Blocked**: 0
- **Remaining**: 8

---

## Sprint Log

| Date       | Sprint   | Action      | Details                                    |
| ---------- | -------- | ----------- | ------------------------------------------ |
| 2026-02-23 | Sprint 7 | Completed   | Phase 11 (E2E security tests) ✓            |
| 2026-02-23 | Sprint 6 | Completed   | Phase 10 (Security audit tool) ✓           |
| 2026-02-23 | Sprint 5 | Completed   | Phases 7-8 (Rate limiter + local bypass) ✓ |
| 2026-02-20 | Sprint 4 | Completed   | Phases 4-6 (Control/Canvas/Plugin auth) ✓  |
| 2026-02-20 | Sprint 3 | Completed   | Phases 2 & 9 (onboarding + hooks) ✓        |
| 2026-02-20 | Sprint 2 | Completed   | Phase 3 verified, 1,182 tests ✓            |
| 2026-02-20 | Sprint 1 | Completed   | Phase 1 verified, 36/36 tests ✓            |
| 2026-02-19 | Sprint 1 | Started     | Phase 1 (security schema) kickoff          |
| 2026-02-18 | —        | Initialized | Sprint tracker created                     |

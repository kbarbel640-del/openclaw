# Zero Trust PR Orchestration Guide

## Overview

This PR adds five zero trust security features to OpenClaw. Each spec is designed to be implemented **independently** by a separate agent, then merged by an integration agent into a single clean PR.

**Branch name**: `feat/zero-trust-hardening`
**PR title**: `security: add zero trust hardening (vault, scoped tokens, rate limiting, config integrity, plugin capabilities)`

---

## Agent Roster: 6 Agents Total

| Agent # | Codename              | Spec                               | Primary Directory                                           | Estimated Complexity |
| ------- | --------------------- | ---------------------------------- | ----------------------------------------------------------- | -------------------- |
| 1       | Vault Agent           | 01 - Credential Encryption at Rest | `src/security/vault/`                                       | Medium               |
| 2       | Token Agent           | 02 - Scoped & Short-Lived Tokens   | `src/gateway/scoped-token.ts`, `src/gateway/token-store.ts` | Medium-High          |
| 3       | Rate Limiter Agent    | 03 - Per-Sender Rate Limiting      | `src/security/message-rate-limit.ts`                        | Low-Medium           |
| 4       | Integrity Agent       | 04 - Config Integrity Verification | `src/security/config-integrity.ts`                          | Low-Medium           |
| 5       | Sandbox Agent         | 05 - Plugin Capability Manifests   | `src/plugins/capability-*.ts`                               | Medium-High          |
| 6       | **Integration Agent** | Merge + PR prep                    | All of the above                                            | Medium               |

---

## Agent 6: Integration Agent — Responsibilities

The Integration Agent runs **after** Agents 1–5 complete. Its job:

1. **Resolve merge conflicts** across shared files (especially `src/security/audit.ts`, `src/config/types.gateway.ts`)
2. **Wire the shared config** — all 5 specs add types to `types.gateway.ts`; integration agent ensures they compose cleanly under a unified `security` config namespace
3. **Run `pnpm build` + `pnpm check` + `pnpm test`** — fix any type errors or lint issues
4. **Update `docs/gateway/security/index.md`** — add sections for each new feature
5. **Update `docs/security/THREAT-MODEL-ATLAS.md`** — update mitigation status for addressed threats
6. **Create unified CHANGELOG entry** under `### Changes`
7. **Prepare the PR** using `.github/pull_request_template.md`

---

## Shared File Conflict Map

These files are modified by multiple agents. The Integration Agent must merge carefully:

| File                          | Modified by Agents | Conflict Risk                              |
| ----------------------------- | ------------------ | ------------------------------------------ |
| `src/security/audit.ts`       | 1, 2, 3, 4, 5      | **HIGH** — each adds new checkIds/findings |
| `src/config/types.gateway.ts` | 1, 2, 3, 4, 5      | **HIGH** — each adds config types          |
| `src/gateway/auth.ts`         | 2                  | Low                                        |
| `src/gateway/server.impl.ts`  | 4                  | Low                                        |
| `src/plugins/loader.ts`       | 5                  | Low                                        |
| `src/auto-reply/dispatch.ts`  | 3                  | Low                                        |

### Recommended merge strategy for `types.gateway.ts`

All new config types should nest under a single `SecurityConfig`:

```typescript
// Unified addition to OpenClawConfig
type SecurityConfig = {
  vault?: VaultConfig; // Spec 01
  scopedTokens?: ScopedTokenConfig; // Spec 02 (also referenced from gateway.auth)
  messageRateLimit?: MessageRateLimitConfig; // Spec 03
  configIntegrity?: ConfigIntegrityConfig; // Spec 04
  pluginCapabilities?: PluginCapabilityConfig; // Spec 05
};
```

### Recommended merge strategy for `audit.ts`

Each agent adds findings in separate check functions. Integration agent should:

1. Ensure no `checkId` collisions
2. Wire all check functions into the main `runSecurityAudit` pipeline
3. Ensure findings are sorted by severity in output

---

## Execution Order

```
Phase 1 (Parallel — all at once):
  Agent 1: Vault Agent        → src/security/vault/*
  Agent 2: Token Agent         → src/gateway/scoped-token.ts, token-store.ts
  Agent 3: Rate Limiter Agent  → src/security/message-rate-limit.ts
  Agent 4: Integrity Agent     → src/security/config-integrity.ts
  Agent 5: Sandbox Agent       → src/plugins/capability-*.ts

Phase 2 (Sequential — after all Phase 1 complete):
  Agent 6: Integration Agent   → merge, types, audit, docs, tests, PR
```

Agents 1–5 can run **fully in parallel** because they create new files in non-overlapping directories. The only conflicts are in shared files, which the Integration Agent resolves.

---

## Rules for Implementation Agents (1–5)

1. **Create new files freely** in your designated directory
2. **Modify shared files minimally** — add your types/findings but don't restructure existing code
3. **Do NOT modify** files owned by other specs
4. **Follow existing patterns** — look at `auth-rate-limit.ts` for rate limiter patterns, `audit.ts` for finding patterns, etc.
5. **Write all tests** — aim for the test plan in your spec
6. **Use `scripts/committer`** for commits, not manual git add/commit
7. **No new npm dependencies** unless absolutely necessary (and approved)
8. **Keep files under ~500 LOC** — split if needed
9. **Run `pnpm check`** before marking done

---

## PR Template Outline

```markdown
## Summary

Add zero trust security hardening across five areas:

- **Credential encryption at rest** — AES-256-GCM encryption for all stored credentials with OS keychain integration
- **Scoped & short-lived gateway tokens** — Replace static tokens with scoped, time-bounded tokens
- **Per-sender message rate limiting** — Sliding-window rate limits at the message dispatch layer
- **Configuration integrity verification** — SHA-256 hash verification to detect config tampering
- **Plugin capability manifests** — Declare-and-enforce model for plugin permissions

Addresses threat model items: T-ACCESS-003, T-IMPACT-002, T-PERSIST-001, T-PERSIST-003.

## Test plan

- [ ] `pnpm test` passes (all new + existing tests)
- [ ] `pnpm build` succeeds (no type errors)
- [ ] `pnpm check` passes (lint + format)
- [ ] `openclaw security audit` shows new checks
- [ ] Manual: encrypt/decrypt credential roundtrip
- [ ] Manual: scoped token create/validate/revoke cycle
- [ ] Manual: rate limiting triggers on rapid messages
- [ ] Manual: config tamper detection on startup
- [ ] Manual: plugin without manifest gets warning in warn mode
```

---

## File Tree (New Files Only)

```
src/
├── security/
│   ├── vault/
│   │   ├── vault.ts                    # Spec 01
│   │   ├── keychain.ts                 # Spec 01
│   │   ├── passphrase.ts              # Spec 01
│   │   ├── types.ts                    # Spec 01
│   │   ├── vault.test.ts              # Spec 01
│   │   └── keychain.test.ts           # Spec 01
│   ├── message-rate-limit.ts          # Spec 03
│   ├── message-rate-limit.test.ts     # Spec 03
│   ├── cost-budget.ts                 # Spec 03
│   ├── cost-budget.test.ts            # Spec 03
│   ├── config-integrity.ts            # Spec 04
│   ├── config-integrity.test.ts       # Spec 04
│   ├── config-integrity-store.ts      # Spec 04
│   └── config-integrity-store.test.ts # Spec 04
├── gateway/
│   ├── scoped-token.ts                # Spec 02
│   ├── scoped-token.test.ts           # Spec 02
│   ├── token-store.ts                 # Spec 02
│   └── token-store.test.ts            # Spec 02
├── plugins/
│   ├── capability-manifest.ts         # Spec 05
│   ├── capability-manifest.test.ts    # Spec 05
│   ├── capability-enforcer.ts         # Spec 05
│   └── capability-enforcer.test.ts    # Spec 05
├── commands/
│   └── token.ts                       # Spec 02
extensions/
├── msteams/
│   └── openclaw-manifest.json         # Spec 05 (example)
├── matrix/
│   └── openclaw-manifest.json         # Spec 05 (example)
```

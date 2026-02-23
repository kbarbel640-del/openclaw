# Spec 04: Configuration Integrity Verification

## Agent Assignment: Agent 4 — "Integrity Agent"

## Objective

Add cryptographic integrity verification to OpenClaw configuration files so that unauthorized or accidental modifications are detected before they take effect. This addresses **T-PERSIST-003** (Agent Configuration Tampering, rated Medium) and strengthens the overall zero trust posture by ensuring config mutations are intentional and auditable.

---

## Threat Context

| Field              | Value                                                                     |
| ------------------ | ------------------------------------------------------------------------- |
| Threat ID          | T-PERSIST-003                                                             |
| ATLAS ID           | AML.T0010.002 (Supply Chain: Data)                                        |
| Current risk       | Medium — requires local access                                            |
| Attack vector      | Config file modification by malware, compromised process, or rogue script |
| Current mitigation | File permissions only                                                     |

---

## Scope of Changes

### Files to CREATE

| File                                          | Purpose                                               |
| --------------------------------------------- | ----------------------------------------------------- |
| `src/security/config-integrity.ts`            | Integrity hash computation, verification, signing     |
| `src/security/config-integrity.test.ts`       | Unit tests                                            |
| `src/security/config-integrity-store.ts`      | Integrity state persistence (hash records, audit log) |
| `src/security/config-integrity-store.test.ts` | Unit tests                                            |

### Files to MODIFY

| File                          | Lines                   | What to change                                                           |
| ----------------------------- | ----------------------- | ------------------------------------------------------------------------ |
| `src/security/audit.ts`       | 677                     | Add integrity check findings (tampered config, missing hash, stale hash) |
| `src/config/types.gateway.ts` | 337                     | Add `ConfigIntegrityConfig` type                                         |
| `src/gateway/server.impl.ts`  | (gateway startup)       | Verify config integrity on gateway start                                 |
| `src/commands/security.ts`    | (CLI security commands) | Add `openclaw security integrity` subcommands                            |

### Files to READ (do not modify, but understand deeply)

| File                                 | Why                                                          |
| ------------------------------------ | ------------------------------------------------------------ |
| `src/config/loader.ts` or equivalent | Understand how config is loaded, merged, and resolved        |
| `src/config/paths.ts`                | 276 lines — where config files live on disk                  |
| `src/gateway/server.impl.ts`         | Gateway startup sequence to find the right integration point |
| `src/security/secret-equal.ts`       | Timing-safe comparison for hash verification                 |

---

## Design

### Integrity Hash Model

```
┌─────────────────────────────────────────────┐
│  Config file(s) on disk                     │
│  ~/.openclaw/openclaw.json                  │
│  ~/.openclaw/openclaw.yaml (if used)        │
│  ~/.openclaw/openclaw.json5 (if used)       │
└──────────────────┬──────────────────────────┘
                   │ SHA-256 hash
                   ▼
┌─────────────────────────────────────────────┐
│  Integrity Store                            │
│  ~/.openclaw/identity/config-integrity.json │
│  {                                          │
│    version: 1,                              │
│    entries: {                               │
│      "openclaw.json": {                     │
│        hash: "sha256:<hex>",                │
│        updatedAt: <epoch>,                  │
│        updatedBy: "cli" | "gateway" | ...   │
│      }                                      │
│    },                                       │
│    auditLog: [                              │
│      { ts, file, action, hash, actor }      │
│    ]                                        │
│  }                                          │
│  File mode: 0o600                           │
└─────────────────────────────────────────────┘
```

### What gets hashed

The integrity hash covers the **raw file content** (byte-for-byte), not the parsed/resolved config. This catches any modification, including whitespace/comment changes.

Protected files:

| File                                 | Priority | Notes                                    |
| ------------------------------------ | -------- | ---------------------------------------- |
| `openclaw.json` / `.yaml` / `.json5` | Critical | Main config with auth, tools, policies   |
| `credentials/*-allowFrom.json`       | High     | Channel allowlists (pairing store)       |
| `agents/*/agent/auth-profiles.json`  | High     | API keys (also covered by Spec 01 vault) |
| `identity/device-auth.json`          | Medium   | Device auth tokens                       |

### Core API (`src/security/config-integrity.ts`)

```typescript
export type IntegrityHashAlgorithm = "sha256";

export type IntegrityVerifyResult =
  | { status: "ok"; hash: string }
  | { status: "tampered"; expectedHash: string; actualHash: string }
  | { status: "missing-baseline"; actualHash: string }
  | { status: "file-not-found" }
  | { status: "error"; error: string };

// Compute hash of a file
export function computeFileIntegrityHash(
  filePath: string,
  algorithm?: IntegrityHashAlgorithm,
): string; // returns "sha256:<hex>"

// Verify a file against stored hash
export function verifyFileIntegrity(filePath: string, expectedHash: string): IntegrityVerifyResult;

// Verify all tracked files
export function verifyAllIntegrity(
  store: ConfigIntegrityStore,
  stateDir?: string,
): Map<string, IntegrityVerifyResult>;

// Update hash after legitimate config change
export function updateFileIntegrityHash(
  store: ConfigIntegrityStore,
  filePath: string,
  actor: IntegrityActor,
): ConfigIntegrityStore;

export type IntegrityActor =
  | "cli" // openclaw config set / openclaw wizard
  | "gateway" // gateway config.patch / config.apply
  | "manual" // user ran integrity update command
  | "migration"; // legacy migration

// Verify on gateway startup
export function verifyConfigIntegrityOnStartup(params: {
  config: OpenClawConfig;
  stateDir: string;
  onTampered?: (file: string, result: IntegrityVerifyResult) => void;
  onMissingBaseline?: (file: string) => void;
}): { allOk: boolean; results: Map<string, IntegrityVerifyResult> };
```

### Integrity Store (`src/security/config-integrity-store.ts`)

```typescript
export type ConfigIntegrityEntry = {
  hash: string; // "sha256:<hex>"
  updatedAt: number; // epoch ms
  updatedBy: IntegrityActor;
  fileSize: number; // bytes, for quick sanity check
};

export type ConfigIntegrityAuditEntry = {
  ts: number;
  file: string;
  action: "created" | "updated" | "verified-ok" | "tampered" | "removed";
  hash: string;
  actor: IntegrityActor;
};

export type ConfigIntegrityStore = {
  version: 1;
  entries: Record<string, ConfigIntegrityEntry>; // keyed by relative path from stateDir
  auditLog: ConfigIntegrityAuditEntry[]; // capped at 1000 entries, FIFO
};

export function loadConfigIntegrityStore(stateDir?: string): ConfigIntegrityStore;
export function saveConfigIntegrityStore(store: ConfigIntegrityStore, stateDir?: string): void;
export function addAuditEntry(
  store: ConfigIntegrityStore,
  entry: Omit<ConfigIntegrityAuditEntry, "ts">,
): ConfigIntegrityStore;
```

### Config schema addition

```typescript
type ConfigIntegrityConfig = {
  enabled?: boolean; // default: true
  verifyOnStartup?: boolean; // default: true
  blockOnTampering?: boolean; // default: false (warn only in v1; block in future)
  trackedFiles?: string[]; // additional files to track beyond defaults
};
```

### Gateway startup integration

In `src/gateway/server.impl.ts`, at startup (after config load, before channel start):

```typescript
if (config.security?.configIntegrity?.verifyOnStartup !== false) {
  const result = verifyConfigIntegrityOnStartup({
    config,
    stateDir: resolveStateDir(),
    onTampered: (file, result) => {
      log.error(
        `Config integrity check FAILED for ${file}: expected ${result.expectedHash}, got ${result.actualHash}`,
      );
      if (config.security?.configIntegrity?.blockOnTampering) {
        throw new Error(`Config integrity violation detected in ${file}. Gateway startup blocked.`);
      }
    },
    onMissingBaseline: (file) => {
      log.info(`No integrity baseline for ${file}. Creating initial hash.`);
    },
  });
}
```

### Automatic hash updates

Anywhere config is legitimately modified (through openclaw's own APIs), update the integrity hash:

1. **CLI `config set`/`config patch`**: after writing config file
2. **Gateway `config.apply`/`config.patch` methods**: after writing config file
3. **Wizard/onboarding**: after initial config creation
4. **Pairing approve**: after updating allowFrom file

This ensures that only modifications made through official channels pass integrity checks.

---

## Integration Points with Other Specs

| Spec                     | Integration                                          |
| ------------------------ | ---------------------------------------------------- |
| 01 (Vault)               | Vault config section included in integrity hash      |
| 02 (Scoped Tokens)       | Token config section included in integrity hash      |
| 03 (Rate Limiting)       | Rate limit config section included in integrity hash |
| 05 (Plugin Capabilities) | Plugin config changes should update integrity hash   |

---

## Security Audit Integration

| checkId                              | Severity | Condition                                                     |
| ------------------------------------ | -------- | ------------------------------------------------------------- |
| `config.integrity_tampered`          | critical | Config file hash doesn't match stored baseline                |
| `config.integrity_missing_baseline`  | warn     | Config file exists but no integrity hash recorded             |
| `config.integrity_disabled`          | warn     | Integrity verification explicitly disabled                    |
| `config.integrity_stale`             | info     | Hash hasn't been updated in >30 days (possible missed update) |
| `config.integrity_store_permissions` | critical | Integrity store file is world/group writable                  |

---

## CLI Surface

```
openclaw security integrity status       # show hash status for all tracked files
openclaw security integrity verify       # verify all tracked files now
openclaw security integrity update       # update hashes for all tracked files (after manual edit)
openclaw security integrity audit-log    # show recent integrity audit log entries
```

Output for `integrity status`:

```
Config Integrity Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 File                              Status    Last Updated
─────────────────────────────────────────────────────────
 openclaw.json                     ✓ OK      2h ago (cli)
 credentials/whatsapp-allowFrom    ✓ OK      1d ago (gateway)
 credentials/discord-allowFrom     ⚠ No baseline
 identity/device-auth.json         ✓ OK      3d ago (cli)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Test Plan

### Unit tests (`src/security/config-integrity.test.ts`)

1. **Hash computation**: known content → known SHA-256 hash
2. **Verify OK**: file matches stored hash → `status: "ok"`
3. **Verify tampered**: file modified → `status: "tampered"` with both hashes
4. **Verify missing baseline**: no stored hash → `status: "missing-baseline"`
5. **Verify file not found**: file deleted → `status: "file-not-found"`
6. **Update hash**: after update, verify succeeds
7. **Timing-safe comparison**: hash comparison uses `timingSafeEqual` (via `safeEqualSecret` pattern)

### Store tests (`src/security/config-integrity-store.test.ts`)

8. **Load/save roundtrip**: store persists correctly
9. **Audit log**: entries added with timestamp
10. **Audit log cap**: entries capped at 1000 (FIFO)
11. **Concurrent access**: file lock prevents corruption

### Integration tests

12. **Gateway startup verify**: start gateway → integrity verified → no warnings
13. **Gateway startup tamper**: modify config outside openclaw → start gateway → warning logged
14. **Gateway startup block**: with `blockOnTampering: true`, tampered config → startup fails
15. **CLI config set**: `openclaw config set` → integrity hash auto-updated
16. **Pairing approve**: approve pairing → allowFrom hash auto-updated

---

## Dependencies

- **Node.js crypto** (built-in) for SHA-256
- No new npm dependencies

---

## Acceptance Criteria

- [ ] SHA-256 integrity hashes computed and stored for all critical config files
- [ ] Integrity verified on gateway startup (warn by default, optional block mode)
- [ ] Hash automatically updated when config is modified through official APIs
- [ ] Tampered files detected and reported clearly
- [ ] Audit log tracks all integrity events (capped at 1000 entries)
- [ ] `openclaw security audit` includes integrity check findings
- [ ] `openclaw security integrity` CLI commands work
- [ ] No new npm dependencies
- [ ] All tests pass
- [ ] Zero breaking changes — works seamlessly with existing configs (creates initial baseline on first run)

# Spec 01: Credential Encryption at Rest

## Agent Assignment: Agent 1 — "Vault Agent"

## Objective

Encrypt all sensitive credentials stored under `~/.openclaw/` so that plaintext secrets never sit on disk. Use OS keychain where available (macOS Keychain, Linux libsecret) with a fallback to passphrase-derived key encryption. This directly addresses **T-ACCESS-003** (Token Theft, rated High) in the threat model.

---

## Threat Context

| Field              | Value                                                       |
| ------------------ | ----------------------------------------------------------- |
| Threat ID          | T-ACCESS-003                                                |
| ATLAS ID           | AML.T0040                                                   |
| Current risk       | High — tokens stored in plaintext JSON                      |
| Attack vector      | Malware, unauthorized device access, config backup exposure |
| Current mitigation | File permissions only (`chmod 0o600`)                       |

---

## Scope of Changes

### Files to CREATE

| File                                  | Purpose                                                   |
| ------------------------------------- | --------------------------------------------------------- |
| `src/security/vault/vault.ts`         | Core encryption/decryption module                         |
| `src/security/vault/keychain.ts`      | OS keychain integration (macOS Keychain, Linux libsecret) |
| `src/security/vault/passphrase.ts`    | Passphrase-derived key (PBKDF2/Argon2id) fallback         |
| `src/security/vault/types.ts`         | Shared types for the vault module                         |
| `src/security/vault/vault.test.ts`    | Unit tests for vault                                      |
| `src/security/vault/keychain.test.ts` | Unit tests for keychain                                   |

### Files to MODIFY

| File                                | Lines | What to change                                                                            |
| ----------------------------------- | ----- | ----------------------------------------------------------------------------------------- |
| `src/agents/auth-profiles/store.ts` | 345   | Wrap `loadAuthProfileStore` / `saveAuthProfileStore` with vault encrypt/decrypt           |
| `src/web/auth-store.ts`             | 206   | Encrypt WhatsApp creds on write, decrypt on read (`resolveWebCredsPath` consumers)        |
| `src/infra/device-auth-store.ts`    | 117   | Encrypt device auth tokens on store, decrypt on load                                      |
| `src/config/paths.ts`               | 276   | Add `resolveVaultKeyPath()` for vault key storage location                                |
| `src/security/audit.ts`             | 677   | Add audit check `credentials.unencrypted` when vault is available but creds are plaintext |
| `src/config/types.gateway.ts`       | 337   | Add `VaultConfig` type to gateway config                                                  |

### Files to READ (do not modify)

| File                           | Why                                                       |
| ------------------------------ | --------------------------------------------------------- |
| `src/security/secret-equal.ts` | Reference for timing-safe comparison pattern              |
| `src/plugin-sdk/file-lock.ts`  | Use `withFileLock` for safe concurrent vault access       |
| `src/plugin-sdk/json-store.ts` | Use `writeJsonFileAtomically` for atomic encrypted writes |

---

## Design

### Encrypted file format

Every encrypted credential file uses a JSON envelope:

```typescript
type EncryptedEnvelope = {
  version: 1;
  algorithm: "aes-256-gcm";
  kdf: "pbkdf2-sha512" | "argon2id" | "keychain";
  salt: string; // base64, 32 bytes (omitted when kdf=keychain)
  iv: string; // base64, 12 bytes
  authTag: string; // base64, 16 bytes
  ciphertext: string; // base64
};
```

### Key hierarchy

```
┌─────────────────────────────────────┐
│  OS Keychain (preferred)            │
│  Service: "ai.openclaw.vault"       │
│  Account: "<stateDir hash>"         │
│  → stores 256-bit DEK directly      │
└──────────────┬──────────────────────┘
               │ fallback
               ▼
┌─────────────────────────────────────┐
│  Passphrase-derived key             │
│  PBKDF2-SHA512, 600k iterations    │
│  Salt: per-file, 32 bytes          │
│  → derives 256-bit DEK             │
└─────────────────────────────────────┘
```

### Config schema addition

```typescript
// Add to GatewayConfig or top-level OpenClawConfig
type VaultConfig = {
  enabled?: boolean; // default: true when keychain available
  backend?: "keychain" | "passphrase" | "auto"; // default: "auto"
  migrateOnLoad?: boolean; // default: true — auto-encrypt plaintext on read
};
```

### Core API (`src/security/vault/vault.ts`)

```typescript
export interface VaultOptions {
  backend: "keychain" | "passphrase" | "auto";
  stateDir: string;
  passphrase?: string; // only needed for passphrase backend
}

export function createVault(options: VaultOptions): Vault;

export interface Vault {
  encrypt(plaintext: string): Promise<string>; // returns JSON envelope string
  decrypt(envelopeJson: string): Promise<string>; // returns plaintext
  isEncrypted(content: string): boolean; // checks for envelope marker
  ensureKey(): Promise<void>; // creates/retrieves key
  rotateKey(newPassphrase?: string): Promise<void>; // re-encrypts with new key
}
```

### Migration strategy

When `vault.migrateOnLoad` is true (default):

1. On load: check if file content starts with `{"version":1,"algorithm":` (envelope marker).
2. If plaintext: decrypt is a no-op, return as-is. Then on next save, encrypt.
3. On save: always encrypt. This transparently migrates existing plaintext creds.

This means **zero breaking changes** — existing installs auto-migrate on first credential write.

### Keychain integration (`src/security/vault/keychain.ts`)

```typescript
export async function keychainAvailable(): Promise<boolean>;
export async function keychainGetKey(service: string, account: string): Promise<Buffer | null>;
export async function keychainSetKey(service: string, account: string, key: Buffer): Promise<void>;
export async function keychainDeleteKey(service: string, account: string): Promise<void>;
```

**macOS**: Use `security` CLI (`security add-generic-password`, `security find-generic-password`).
**Linux**: Use `secret-tool` CLI (libsecret/GNOME Keyring).
**Windows**: Not in scope for this PR (use passphrase fallback).
**CI/headless**: Auto-detect no keychain → fallback to passphrase or env var `OPENCLAW_VAULT_PASSPHRASE`.

---

## Integration Points with Other Specs

| Spec                     | Integration                                             |
| ------------------------ | ------------------------------------------------------- |
| 02 (Scoped Tokens)       | Scoped tokens should be stored via vault when persisted |
| 04 (Config Integrity)    | Config integrity hash should cover vault config section |
| 05 (Plugin Capabilities) | Plugins must NOT have direct vault access               |

---

## Security Audit Integration

Add these findings to `src/security/audit.ts`:

| checkId                                       | Severity | Condition                                             |
| --------------------------------------------- | -------- | ----------------------------------------------------- |
| `credentials.vault_available_but_unencrypted` | warn     | Keychain available but creds are plaintext            |
| `credentials.vault_passphrase_env`            | info     | Using env-var passphrase (less secure than keychain)  |
| `credentials.vault_disabled`                  | warn     | Vault explicitly disabled with `vault.enabled: false` |

---

## Test Plan

### Unit tests (`src/security/vault/vault.test.ts`)

1. **Encrypt → decrypt roundtrip** with known plaintext
2. **Tampered ciphertext** returns error (auth tag mismatch)
3. **Tampered IV** returns error
4. **Wrong key** returns error
5. **`isEncrypted`** correctly identifies envelope vs plaintext
6. **Migration**: plaintext input → `isEncrypted` returns false → save encrypts → load decrypts correctly
7. **Key rotation**: encrypt with key A → rotate to key B → decrypt with key B succeeds

### Integration tests

8. **Auth profile store roundtrip**: `saveAuthProfileStore` → `loadAuthProfileStore` with vault enabled
9. **WhatsApp creds roundtrip**: write encrypted → read decrypted
10. **Device auth store roundtrip**: `storeDeviceAuthToken` → `loadDeviceAuthToken` with vault
11. **Concurrent access**: two processes read/write with file lock — no corruption

### Keychain tests (conditional, skip in CI without keychain)

12. **macOS keychain**: store/retrieve/delete key
13. **Fallback**: when keychain unavailable, falls back to passphrase

---

## CLI Surface

Add to existing `openclaw security` command group:

```
openclaw security vault status     # show vault status (enabled, backend, encrypted file count)
openclaw security vault migrate    # encrypt all plaintext credential files
openclaw security vault rotate     # rotate vault key (re-encrypt all files)
```

---

## Dependencies

- **Node.js crypto** (built-in) for AES-256-GCM, PBKDF2
- No new npm dependencies required for core encryption
- macOS `security` CLI (system binary) for keychain
- Linux `secret-tool` CLI (optional, system package) for keychain

---

## Acceptance Criteria

- [ ] All credential files under `~/.openclaw/credentials/` are encrypted at rest when vault is enabled
- [ ] Auth profile store (`auth-profiles.json`) encrypted
- [ ] Device auth store (`device-auth.json`) encrypted
- [ ] WhatsApp creds (`creds.json`) encrypted
- [ ] Existing plaintext creds auto-migrate on next save
- [ ] `openclaw security audit` warns about unencrypted credentials
- [ ] No new npm dependencies for core functionality
- [ ] All tests pass, including roundtrip and tampering tests
- [ ] Works in headless/CI environments via passphrase fallback
- [ ] Backward compatible — old openclaw versions can't read encrypted files but get a clear error message

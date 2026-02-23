# Spec 02: Scoped & Short-Lived Gateway Tokens

## Agent Assignment: Agent 2 — "Token Agent"

## Objective

Replace the current static shared-secret gateway auth with a system that supports **scoped tokens** (limited to specific methods/resources) and **short-lived tokens** (with configurable TTL and automatic rotation). This implements the "never trust, always verify" zero trust principle at the gateway API layer.

---

## Threat Context

| Field              | Value                                                                             |
| ------------------ | --------------------------------------------------------------------------------- |
| Threat IDs         | T-ACCESS-003 (Token Theft), new: T-ACCESS-004 (Lateral Movement via Stolen Token) |
| Current risk       | High — static tokens with full operator access, no expiry                         |
| Attack vector      | Stolen token grants permanent, unlimited gateway access                           |
| Current mitigation | Manual rotation checklist in docs                                                 |

---

## Scope of Changes

### Files to CREATE

| File                               | Purpose                                                   |
| ---------------------------------- | --------------------------------------------------------- |
| `src/gateway/scoped-token.ts`      | Token generation, parsing, validation                     |
| `src/gateway/scoped-token.test.ts` | Unit tests                                                |
| `src/gateway/token-store.ts`       | Persistent token metadata (revocation, rotation tracking) |
| `src/gateway/token-store.test.ts`  | Unit tests                                                |
| `src/commands/token.ts`            | CLI `openclaw token` subcommand group                     |

### Files to MODIFY

| File                                               | Lines | What to change                                                          |
| -------------------------------------------------- | ----- | ----------------------------------------------------------------------- |
| `src/gateway/auth.ts`                              | 375   | Add scoped-token validation path in `authorizeGatewayConnect`           |
| `src/gateway/auth-rate-limit.ts`                   | 234   | Add `AUTH_RATE_LIMIT_SCOPE_SCOPED_TOKEN` scope                          |
| `src/gateway/method-scopes.ts`                     | 204   | Extend `authorizeOperatorScopesForMethod` to accept scoped token claims |
| `src/gateway/credentials.ts`                       | 163   | Add `resolveGatewayCredentialsFromScopedToken`                          |
| `src/gateway/server/ws-connection/auth-context.ts` | 214   | Handle scoped token in `resolveConnectAuthState`                        |
| `src/config/types.gateway.ts`                      | 337   | Add `ScopedTokenConfig` to `GatewayAuthConfig`                          |
| `src/security/audit.ts`                            | 677   | Add checks for expired/revoked tokens, overly permissive scoped tokens  |

### Files to READ (do not modify)

| File                           | Why                                             |
| ------------------------------ | ----------------------------------------------- |
| `src/gateway/role-policy.ts`   | Understand role model to scope tokens correctly |
| `src/security/secret-equal.ts` | Use for token comparison                        |
| `src/plugin-sdk/file-lock.ts`  | Use for concurrent token store access           |

---

## Design

### Scoped Token Format

Tokens are opaque base64url strings that encode a signed JSON payload:

```typescript
type ScopedTokenPayload = {
  v: 1; // version
  jti: string; // unique token ID (nanoid, 21 chars)
  sub: string; // subject identifier (human label, e.g. "cli-laptop")
  role: "operator" | "node"; // gateway role
  scopes: OperatorScope[]; // subset of operator scopes
  methods?: string[]; // optional: explicit method allowlist (overrides scope-based)
  iat: number; // issued-at (epoch seconds)
  exp?: number; // expiry (epoch seconds), undefined = no expiry
  nbf?: number; // not-before (epoch seconds)
};

type ScopedTokenSerialized = {
  payload: string; // base64url(JSON)
  sig: string; // base64url(HMAC-SHA256)
};
```

**Wire format**: `osc_<base64url(payload)>.<base64url(sig)>`

The `osc_` prefix makes scoped tokens distinguishable from legacy static tokens.

### Token lifecycle

```
┌──────────────┐     ┌───────────────┐     ┌──────────────────┐
│  Generate    │────▶│  Active       │────▶│  Expired/Revoked │
│  (CLI/API)   │     │  (valid+sig)  │     │  (rejected)      │
└──────────────┘     └───────┬───────┘     └──────────────────┘
                             │
                             │ rotate
                             ▼
                     ┌───────────────┐
                     │  Rotated      │
                     │  (old valid   │
                     │   for grace)  │
                     └───────────────┘
```

### Config schema additions

```typescript
// Extend GatewayAuthConfig
type GatewayAuthConfig = {
  // ... existing fields ...
  scopedTokens?: ScopedTokenConfig;
};

type ScopedTokenConfig = {
  enabled?: boolean; // default: false (opt-in for v1)
  signingKeyPath?: string; // default: ~/.openclaw/identity/token-signing.key
  defaultTtlSeconds?: number; // default: 86400 (24h)
  maxTtlSeconds?: number; // default: 2592000 (30d)
  rotationGraceSeconds?: number; // default: 300 (5min overlap during rotation)
  allowLegacyStaticTokens?: boolean; // default: true (backward compat)
};
```

### Core API (`src/gateway/scoped-token.ts`)

```typescript
// Signing key management
export function generateSigningKey(): Buffer; // 256-bit random
export function loadOrCreateSigningKey(keyPath: string): Buffer;

// Token operations
export function createScopedToken(params: {
  signingKey: Buffer;
  subject: string;
  role: GatewayRole;
  scopes: OperatorScope[];
  methods?: string[];
  ttlSeconds?: number;
}): string; // returns "osc_<payload>.<sig>"

export function parseScopedToken(token: string): ScopedTokenPayload | null;

export function validateScopedToken(params: {
  token: string;
  signingKey: Buffer;
  now?: number;
}): ScopedTokenValidationResult;

type ScopedTokenValidationResult =
  | { valid: true; payload: ScopedTokenPayload }
  | {
      valid: false;
      reason: "malformed" | "bad-signature" | "expired" | "not-yet-valid" | "revoked";
    };

export function isScopedToken(token: string): boolean; // checks "osc_" prefix
```

### Token Store (`src/gateway/token-store.ts`)

```typescript
type TokenMetadata = {
  jti: string;
  subject: string;
  role: GatewayRole;
  scopes: OperatorScope[];
  issuedAt: number;
  expiresAt?: number;
  revokedAt?: number;
  lastUsedAt?: number;
  rotatedToJti?: string;
};

type TokenStore = {
  version: 1;
  tokens: Record<string, TokenMetadata>; // keyed by jti
};

export function loadTokenStore(stateDir?: string): TokenStore;
export function saveTokenStore(store: TokenStore, stateDir?: string): void;
export function isTokenRevoked(store: TokenStore, jti: string): boolean;
export function revokeToken(store: TokenStore, jti: string): TokenStore;
export function revokeAllTokens(store: TokenStore): TokenStore;
export function pruneExpiredTokens(store: TokenStore, now?: number): TokenStore;
```

Storage path: `~/.openclaw/identity/token-store.json` (mode `0o600`).

### Auth integration

In `src/gateway/auth.ts`, modify `authorizeGatewayConnect`:

```typescript
// Current flow:
// 1. Check token/password → GatewayAuthResult

// New flow:
// 1. Check if token starts with "osc_" → scoped token path
//    a. Validate signature + expiry
//    b. Check revocation in token store
//    c. Return GatewayAuthResult with scopes from token
// 2. If allowLegacyStaticTokens: fall through to existing token/password check
// 3. If !allowLegacyStaticTokens and not scoped: reject
```

Add new auth method: `"scoped-token"` to `GatewayAuthResult.method`.

In `src/gateway/method-scopes.ts`, extend `authorizeOperatorScopesForMethod`:

- Currently takes `scopes: readonly string[]` — scoped tokens pass their `scopes` claim here.
- No structural change needed, just wire the scoped token's scopes through the existing check.

### Backward Compatibility

- `allowLegacyStaticTokens: true` (default) means existing static tokens keep working.
- Scoped tokens are additive — existing setups don't break.
- The `osc_` prefix ensures scoped tokens are never confused with static tokens.
- Migration path: generate scoped tokens, test, then set `allowLegacyStaticTokens: false`.

---

## Integration Points with Other Specs

| Spec                  | Integration                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------- |
| 01 (Vault)            | Signing key at `token-signing.key` should be encrypted by vault if vault is enabled      |
| 03 (Rate Limiting)    | Scoped tokens carry subject identity — rate limiter can use `sub` for per-subject limits |
| 04 (Config Integrity) | Config integrity should cover `scopedTokens` config section                              |

---

## Security Audit Integration

Add these findings to `src/security/audit.ts`:

| checkId                                     | Severity | Condition                                                    |
| ------------------------------------------- | -------- | ------------------------------------------------------------ |
| `gateway.auth.scoped_tokens_disabled`       | info     | Scoped tokens available but not enabled                      |
| `gateway.auth.legacy_static_tokens_allowed` | warn     | Legacy static tokens still permitted alongside scoped tokens |
| `gateway.auth.scoped_token_long_ttl`        | warn     | Token TTL exceeds 7 days                                     |
| `gateway.auth.scoped_token_all_scopes`      | warn     | Scoped token has all operator scopes (effectively admin)     |
| `gateway.auth.signing_key_permissions`      | critical | Signing key file is world/group readable                     |

---

## CLI Surface

```
openclaw token create --subject "cli-laptop" --scopes "read,write" --ttl 24h
openclaw token create --subject "ci-readonly" --scopes "read" --ttl 1h --role node
openclaw token list                    # show all tokens with status
openclaw token revoke <jti>            # revoke a specific token
openclaw token revoke --all            # revoke all tokens
openclaw token rotate-key              # rotate signing key (grace period applies)
openclaw token inspect <token-string>  # decode and show payload (without verifying)
```

Output for `token create`:

```
Token created successfully.
  Subject:  cli-laptop
  Token ID: abc123def456...
  Role:     operator
  Scopes:   operator.read, operator.write
  Expires:  2026-02-24T15:30:00Z (in 24h)

  Token: osc_eyJ2IjoxLC....<sig>

  ⚠ Store this token securely. It will not be shown again.
```

---

## Test Plan

### Unit tests (`src/gateway/scoped-token.test.ts`)

1. **Create → parse roundtrip**: all fields preserved
2. **Validate with correct key**: returns `valid: true`
3. **Validate with wrong key**: returns `bad-signature`
4. **Expired token**: returns `expired`
5. **Not-yet-valid token** (nbf in future): returns `not-yet-valid`
6. **Malformed token** (bad base64, missing fields): returns `malformed`
7. **`isScopedToken`**: correctly identifies `osc_` prefix
8. **Scope enforcement**: token with `["operator.read"]` fails `authorizeOperatorScopesForMethod("config.patch", ...)`

### Token store tests (`src/gateway/token-store.test.ts`)

9. **Revoke token**: `isTokenRevoked` returns true
10. **Prune expired**: removes tokens past expiry
11. **Concurrent access**: file lock prevents corruption

### Integration tests

12. **Gateway auth with scoped token**: connect with scoped token, invoke allowed method → success
13. **Gateway auth scope rejection**: connect with read-only token, invoke write method → rejected
14. **Legacy static token still works**: when `allowLegacyStaticTokens: true`
15. **Legacy static token rejected**: when `allowLegacyStaticTokens: false`
16. **Token rotation**: rotate signing key, old token works during grace period, fails after

---

## Dependencies

- **Node.js crypto** (built-in) for HMAC-SHA256, random bytes
- No new npm dependencies

---

## Acceptance Criteria

- [ ] Scoped tokens can be created with limited scopes and TTL via CLI
- [ ] Gateway validates scoped tokens (signature, expiry, scope) on every request
- [ ] Tokens can be revoked individually or all-at-once
- [ ] Legacy static tokens continue to work by default (backward compatible)
- [ ] Signing key stored with `0o600` permissions
- [ ] Token rotation with configurable grace period
- [ ] Security audit flags overly permissive tokens and exposed signing keys
- [ ] No new npm dependencies
- [ ] All tests pass

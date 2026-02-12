# ADR-008: Multi-Account Provider Management

**Status:** Proposed  
**Date:** 2026-02-12  
**Deciders:** Julio Cezar, Marcelo (main)  
**Context:** Need to manage multiple accounts per provider with explicit control

---

## Context

OpenClaw supports multiple authentication profiles per provider (e.g., 3 google-antigravity accounts). Currently:

- ✅ System does automatic failover between accounts
- ✅ Respects rate limit cooldowns per account
- ❌ **Cannot explicitly choose which account to use**
- ❌ **No differentiation in model IDs by account**
- ❌ **Logs don't show which account was used**
- ❌ **Agents have no visibility into account selection**

### Problem Example

```json
{
  "auth": {
    "profiles": {
      "google-antigravity:account-a@gmail.com": {...},
      "google-antigravity:account-b@gmail.com": {...},
      "google-antigravity:account-c@gmail.com": {...}
    }
  }
}
```

When an agent requests `google-antigravity/claude-opus-4-5`:

- Unknown which account will be used (depends on failover order)
- Cannot prefer a specific account
- Cannot load-balance across accounts intentionally
- Debugging is hard (logs show provider but not account)

---

## Decision

Introduce **account tags** to allow explicit account selection while preserving automatic failover.

### Syntax

```
provider/model@account-tag
```

### Examples

```typescript
// No tag = default failover order
"google-antigravity/claude-opus-4-5";

// With tag = prefer specific account
"google-antigravity/claude-opus-4-5@sendtelecom";
"google-antigravity/claude-opus-4-5@julio";
"openrouter/llama-3.3-70b@free-tier";
"openrouter/llama-3.3-70b@paid";
```

### Behavior

1. **Tag specified**: Try tagged account first, failover to others if it fails
2. **Tag not found**: Explicit error with available tags
3. **No tag**: Existing behavior (default failover order)

---

## Implementation

### 1. Config Schema

```json
{
  "auth": {
    "profiles": {
      "google-antigravity:sendtelecom@gmail.com": {...},
      "google-antigravity:julio@gmail.com": {...}
    },
    "accountTags": {
      "google-antigravity": {
        "sendtelecom": "google-antigravity:sendtelecom@gmail.com",
        "julio": "google-antigravity:julio@gmail.com",
        "main": "google-antigravity:sendtelecom@gmail.com"
      }
    }
  }
}
```

### 2. Model Reference Type

```typescript
export type ModelRef = {
  provider: string;
  model: string;
  accountTag?: string; // NEW
};
```

### 3. Parsing Enhancement

```typescript
function parseModelRef(fullId: string): ModelRef {
  const [providerModel, tag] = fullId.split("@");
  const [provider, model] = providerModel.split("/");

  return {
    provider: normalizeProviderId(provider),
    model,
    accountTag: tag?.trim() || undefined,
  };
}
```

### 4. Auth Resolution Enhancement

```typescript
export function resolveAuthProfileOrder(params: {
  cfg: OpenClawConfig;
  store: AuthProfileStore;
  provider: string;
  preferredProfile?: string;
  accountTag?: string; // NEW
}): string[] {
  const { accountTag } = params;

  if (accountTag) {
    const tagMap = cfg.auth?.accountTags?.[provider];
    const profileId = tagMap?.[accountTag];

    if (!profileId) {
      throw new Error(
        `Account tag "@${accountTag}" not found for provider "${provider}". ` +
          `Available: ${Object.keys(tagMap ?? {}).join(", ")}`,
      );
    }

    // Return: [taggedProfile, ...otherProfiles]
    // Automatic failover if tagged profile fails
    const others = listProfilesForProvider(store, provider).filter((id) => id !== profileId);

    return [profileId, ...others];
  }

  // Existing behavior (no tag)
  // ...
}
```

---

## Consequences

### Positive

- ✅ **Explicit Control**: Agents can specify which account to use
- ✅ **Load Balancing**: Distribute load across accounts intentionally
- ✅ **Better Logging**: Logs show account tag + profile ID used
- ✅ **Quota Management**: Allocate specific accounts to specific agents
- ✅ **Backward Compatible**: Existing configs work unchanged
- ✅ **Graceful Degradation**: Tagged account fails → automatic failover

### Negative

- ⚠️ **Config Complexity**: Adds `accountTags` section to config
- ⚠️ **Learning Curve**: Users need to understand tag concept
- ⚠️ **Sync Requirement**: Tags must match existing profiles

### Risks

- **Tag Misconfiguration**: Tag points to non-existent profile → fail fast with clear error
- **Tag Ambiguity**: Multiple tags for same profile → allowed (aliases)
- **Migration**: Existing configs without tags → no change needed

---

## Alternatives Considered

### Alternative 1: Profile ID in Model String

```typescript
"google-antigravity/claude-opus-4-5#google-antigravity:sendtelecom@gmail.com";
```

**Rejected:** Too verbose, exposes internal profile structure

### Alternative 2: Separate Config Field

```json
{
  "model": "google-antigravity/claude-opus-4-5",
  "accountPreference": "sendtelecom"
}
```

**Rejected:** Splits model selection across fields, harder to manage

### Alternative 3: Auto Load Balancing

Round-robin or least-used automatic selection.

**Rejected:** Unpredictable, harder to debug, doesn't allow explicit control

---

## Implementation Plan

### Phase 1: Core (Backend)

- [ ] Update `ModelRef` type with `accountTag`
- [ ] Implement `@tag` parsing in `parseModelRef()`
- [ ] Update `resolveAuthProfileOrder()` with tag support
- [ ] Unit tests for parsing and resolution

**Owner:** backend-architect  
**Estimate:** 2-3 hours

### Phase 2: Config Schema

- [ ] Add `AccountTagsSchema` to Zod
- [ ] Validate tags → profiles mapping
- [ ] Migration guide for existing configs

**Owner:** backend-architect  
**Estimate:** 1-2 hours

### Phase 3: Logging & Diagnostics

- [ ] Add account info to model selection logs
- [ ] Create `/models/accounts` endpoint with per-account status
- [ ] Integration tests

**Owner:** sre  
**Estimate:** 2-3 hours

### Phase 4: UI (Optional)

- [ ] Model picker with account selector dropdown
- [ ] Account dashboard (quotas, rate limits, status)
- [ ] User documentation

**Owner:** frontend-architect  
**Estimate:** 4-6 hours

---

## Examples

### Example 1: Single Account Provider (No Change)

```json
{
  "auth": {
    "profiles": {
      "anthropic:oauth": {...}
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-sonnet-4-5"
      }
    }
  }
}
```

**Behavior:** Unchanged ✅

### Example 2: Multi-Account with Tags

```json
{
  "auth": {
    "profiles": {
      "google-antigravity:sendtelecom@gmail.com": {...},
      "google-antigravity:julio@gmail.com": {...}
    },
    "accountTags": {
      "google-antigravity": {
        "sendtelecom": "google-antigravity:sendtelecom@gmail.com",
        "julio": "google-antigravity:julio@gmail.com",
        "main": "google-antigravity:sendtelecom@gmail.com",
        "backup": "google-antigravity:julio@gmail.com"
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "google-antigravity/claude-sonnet-4-5@main"
      }
    },
    "agents": {
      "backend-architect": {
        "model": "google-antigravity/claude-opus-4-5@julio"
      }
    }
  }
}
```

**Behavior:**

- Default agents use `@main` (sendtelecom account)
- backend-architect uses `@julio` (julio account)
- If preferred account is rate-limited → failover to other account ✅

### Example 3: Tag Not Found

```typescript
// Config has tags: sendtelecom, julio
model = "google-antigravity/claude-opus-4-5@invalid";

// Error:
("Account tag '@invalid' not found for provider 'google-antigravity'. Available: sendtelecom, julio");
```

---

## Related

- **ADR-007:** Dynamic Pattern Registry (model capabilities)
- **ADR-005:** Model Selection Precedence (routing logic)
- Future ADR: Account quota management and monitoring

---

## References

- Design Document: `/Users/juliocezar/.openclaw/workspace/MULTI_ACCOUNT_DESIGN.md`
- Discussion: Julio's request 2026-02-12 13:11 PST
- Code: `src/agents/model-selection.ts`, `src/infra/provider-usage.auth.ts`

---

_Proposed by Marcelo (@main) on 2026-02-12_

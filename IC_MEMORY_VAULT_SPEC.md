# IC Memory Vault - Technical Specification

> Full context and design decisions for the OpenClaw IC Persistent Storage extension.
> Date: February 16, 2026
> Branch: openclaw-ic-persistent-storage-2026-02-16

---

## Project Overview

**Goal:** Build a persistent, sovereign AI memory storage layer for OpenClaw using Internet Computer canisters written in Motoko. This is both an OpenClaw extension AND a companion skill.

**Repo:** `github.com/TheAmSpeed/openclaw-ic-persistent-storage` (fork of `openclaw/openclaw`)

**Positioning:** "IC Memory Vault" -- the go-to persistent memory layer for AI assistants. First integration: OpenClaw. Designed for massive adoption of Motoko/canisters.

---

## Architecture Decisions (Locked In)

### 1. Language: Motoko (not Azle)

- **460x cheaper** in cycle consumption vs Azle
- Production-ready, DFINITY-maintained
- Enhanced Orthogonal Persistence (EOP) is default since Motoko 0.15.0 (July 2025)
  - `persistent actor` keyword -- all vars are implicitly stable
  - No manual StableBTreeMap needed
  - 64-bit heap, faster upgrades

### 2. Deployment: Factory Canister (Model C)

- Factory canister spawns per-user UserVault canisters
- Free tier: factory pre-funded cycle pool (~$0.65 per user for canister creation)
- User authenticates via Internet Identity 2.0 (Google/Apple/Microsoft/passkey)
- Factory sets user's principal as controller of their canister
- Factory's role ends after creation (launcher, not landlord)

### 3. Storage: Sync Companion (not replacement)

- Runs alongside existing local SQLite/LanceDB storage
- Local storage remains primary (instant reads/writes)
- IC canister is persistent backup that syncs in background
- If IC unreachable, nothing breaks -- syncs on reconnect

### 4. Delivery: OpenClaw Extension + Companion Skill

- Extension (`extensions/ic-persistent-storage/`): TypeScript code with tools, hooks, services, CLI
- Skill (`skills/ic-storage/SKILL.md`): Markdown instructions teaching the agent about IC storage

---

## Security Model

### Authentication

- Internet Identity 2.0 (live now):
  - No identity numbers (discoverable passkeys)
  - Google, Apple, Microsoft sign-in as alternatives
  - Multiple accounts from one identity
- Every call cryptographically signed
- `msg.caller` verified by IC before canister code runs

### Access Control

- `assert(caller == owner)` on every function in UserVault
- Knowing someone's principal is useless without their private key
- Private key never leaves user's device (WebAuthn/passkey hardware-backed)

### Encryption (Phase 2)

- vetKeys (live since Niobium upgrade, July 2025): per-user encryption keys via threshold cryptography
- Data encrypted at rest inside canister
- No single node can read the data

### Confidential Computing (Phase 3)

- TEE-enabled subnets (live): AMD SEV-SNP
- Optional migration to TEE subnet for highest privacy

---

## IC Features We Leverage

### Currently Using

| Feature                         | Status                      | How We Use It                                               |
| ------------------------------- | --------------------------- | ----------------------------------------------------------- |
| Enhanced Orthogonal Persistence | Default since Motoko 0.15.0 | `persistent actor` -- all data auto-persisted               |
| Internet Identity 2.0           | Live                        | Google/Apple/Microsoft/passkey auth                         |
| Composite Queries               | Live                        | Single round-trip for dashboard, bulk recall, sync manifest |
| `msg.caller` verification       | Core IC feature             | Owner-only access control                                   |
| dfx CLI                         | Still primary tool          | Local dev, deployment                                       |
| dfxvm                           | Live                        | Version management                                          |
| Canister Migration              | Live Feb 2026               | Future: migrate to TEE subnet                               |

### NOT Using (Scoped Out)

| Feature              | Reason                                                  |
| -------------------- | ------------------------------------------------------- |
| Blob Storage         | Only available within Caffeine, not generally available |
| Caffeine AI          | Separate platform, not needed for core functionality    |
| Chain Fusion         | Future phase for cycle payments via BTC/ETH             |
| ICRC-7/NFT standards | Not relevant to storage                                 |

---

## Motoko Canister Design

### Factory Canister (`Factory.mo`)

```
persistent actor Factory {
    // State (auto-persisted via EOP)
    var vaults : [(Principal, CanisterId)] = [];
    var totalCreated : Nat = 0;

    // Methods
    createVault(caller) → Result<CanisterId, Error>
      - assert caller doesn't already have a vault
      - create new UserVault canister with caller as owner
      - seed with cycles from pool
      - set caller as controller
      - store mapping
      - rate limiting: 1 vault per principal

    getVault(caller) → ?CanisterId
      - lookup vault for principal

    composite query getVaultStatus(caller) → ?VaultStatus
      - lookup vault + query its stats in one call
}
```

### UserVault Canister (`UserVault.mo`)

```
persistent actor class UserVault(owner : Principal) {
    // State (auto-persisted via EOP)
    var memories : TrieMap<Text, MemoryEntry> = ...;
    var sessions : TrieMap<Text, SessionEntry> = ...;
    var auditLog : [AuditEntry] = [];  // IMMUTABLE append-only log
    var lastUpdated : Int = 0;

    // UPDATE CALLS (cost cycles, consensus)
    store(key, category, value) → ()
      - assert(caller == owner)
      - appends AuditEntry to auditLog
    bulkSync(entries) → SyncResult
      - assert(caller == owner)
      - appends AuditEntry per item synced
    delete(key) → ()
      - assert(caller == owner)
      - appends AuditEntry (records deletion)

    // COMPOSITE QUERIES (free, single round trip)
    composite query getDashboard() → DashboardData
      - stats + recent memories + recent sessions + categories + cycle balance
    composite query recallRelevant(category, prefix, limit) → [MemoryEntry]
      - search + fetch in one call
    composite query getSyncManifest() → SyncManifest
      - checksums for differential sync

    // REGULAR QUERIES (free)
    query recall(key) → ?MemoryEntry
    query getStats() → VaultStats
    query getCategories() → [Text]
    query getAuditLog(offset, limit) → [AuditEntry]
      - paginated, chronological, IMMUTABLE
    query getAuditLogSize() → Nat
}
```

### Immutable Audit Log Design

The audit log is an **append-only** array in the UserVault canister. There is no
delete or update function for audit entries. Since every write goes through IC
consensus, each entry is a verified record of an action that actually happened.

**Key properties:**

- **Append-only:** No function exists to modify or remove entries
- **Consensus-verified:** Each entry was written via an update call that went
  through IC consensus across multiple nodes
- **Tamper-proof:** Not even the canister owner can edit past entries (no API exists)
- **Timestamped:** Uses IC system time (`Time.now()`) set by consensus
- **Queryable:** Free paginated reads via query calls

**What gets logged:**

- Every `store()` call (memory created/updated)
- Every `bulkSync()` call (batch sync with item count)
- Every `delete()` call (memory deleted, records the key)
- Vault creation event
- Restore operations
- Failed access attempts (wrong caller)

```
type AuditAction = {
    #store;        // memory stored
    #delete;       // memory deleted
    #bulkSync;     // batch sync
    #restore;      // data restored from vault
    #created;      // vault created
    #accessDenied; // unauthorized access attempt
};

type AuditEntry = {
    timestamp : Int;       // IC consensus time
    action : AuditAction;
    caller : Principal;    // who performed the action
    key : ?Text;           // affected key (if applicable)
    category : ?Text;      // affected category (if applicable)
    details : ?Text;       // additional context (e.g., "synced 47 entries")
};
```

### Data Types

```
type MemoryEntry = {
    key : Text;
    category : Text;
    content : Blob;
    metadata : Text;  // JSON string
    createdAt : Int;
    updatedAt : Int;
};

type SessionEntry = {
    sessionId : Text;
    data : Blob;
    startedAt : Int;
    endedAt : Int;
};

type VaultStats = {
    totalMemories : Nat;
    totalSessions : Nat;
    categories : [Text];
    bytesUsed : Nat;
    cycleBalance : Nat;
    lastUpdated : Int;
};

type SyncManifest = {
    lastUpdated : Int;
    memoriesCount : Nat;
    sessionsCount : Nat;
    categoryChecksums : [(Text, Text)];
};

type DashboardData = {
    stats : VaultStats;
    recentMemories : [MemoryEntry];
    recentSessions : [SessionEntry];
};

type SyncResult = {
    stored : Nat;
    skipped : Nat;
    errors : [Text];
};
```

---

## OpenClaw Extension Design

### Location

`extensions/ic-persistent-storage/`

### Files

```
extensions/ic-persistent-storage/
  package.json                  # @openclaw/ic-persistent-storage
  openclaw.plugin.json          # kind: not exclusive (sync companion), configSchema
  index.ts                      # main entry: register tools, hooks, services, CLI
  config.ts                     # config types and parser
  ic-client.ts                  # @dfinity/agent wrapper, II auth, canister calls
  sync.ts                       # differential sync logic
  index.test.ts                 # vitest tests
```

### Registered Tools

| Tool            | Description                              |
| --------------- | ---------------------------------------- |
| `vault_sync`    | Push local memories/sessions to IC vault |
| `vault_recall`  | Pull specific memory from IC vault       |
| `vault_restore` | Full restore from IC vault to local      |
| `vault_status`  | Show vault stats, cycles, sync status    |
| `vault_audit`   | Show immutable audit log (paginated)     |

### Registered Hooks

| Hook            | Trigger           | Action                                 |
| --------------- | ----------------- | -------------------------------------- |
| `session_end`   | User ends session | Auto-sync session to IC                |
| `agent_end`     | Conversation ends | Auto-sync new memories to IC           |
| `gateway_start` | OpenClaw starts   | Auto-connect to IC, check vault status |

### Registered CLI Commands

| Command          | Description                                        |
| ---------------- | -------------------------------------------------- |
| `/vault-setup`   | Authenticate with II 2.0, create vault via factory |
| `/vault-status`  | Show vault dashboard                               |
| `/vault-sync`    | Manual sync trigger                                |
| `/vault-restore` | Restore from IC to local                           |

### Config Schema

```json
{
  "canisterId": "string (optional, set after setup)",
  "factoryCanisterId": "string (default: our deployed factory)",
  "network": "string (local | ic, default: ic)",
  "autoSync": "boolean (default: true)",
  "syncOnSessionEnd": "boolean (default: true)",
  "syncOnAgentEnd": "boolean (default: true)"
}
```

---

## Companion Skill Design

### Location

`skills/ic-storage/SKILL.md`

### Content

- Teaches agent what IC Memory Vault is
- Guides users through `/vault-setup`
- Explains sovereignty, encryption, persistence
- Describes available commands
- Metadata: requires no external binaries (pure IC interaction)

---

## User Onboarding Flow

1. User types `/vault-setup`
2. Browser opens II 2.0 (Google/Apple/Microsoft/passkey)
3. User authenticates (~10 seconds)
4. Extension calls factory.createVault(principal)
5. Factory spawns UserVault, seeds cycles, sets user as controller
6. Extension saves canister ID to config
7. Initial sync of existing local memories
8. Done. Auto-sync enabled.

## Cross-Device Restore Flow

1. User installs OpenClaw on new device
2. Types `/vault-restore`
3. Browser opens II 2.0 for auth
4. Extension calls factory.getVault(principal)
5. Extension calls vault.getDashboard() (composite query)
6. Downloads all memories and sessions
7. Rebuilds local storage

---

## Performance Targets (Composite Queries)

| Operation                 | Target   | Calls             |
| ------------------------- | -------- | ----------------- |
| `/vault-status`           | <400ms   | 1 composite query |
| Auto-recall (10 memories) | <400ms   | 1 composite query |
| Sync check                | <400ms   | 1 composite query |
| Full session startup      | <1,000ms | ~3 calls total    |

---

## Cost Model

| Item                   | Cost                              |
| ---------------------- | --------------------------------- |
| Canister creation      | ~$0.65 (500B cycles)              |
| 1 GiB storage/year     | ~$5.35 (replicated stable memory) |
| Typical user (~100 MB) | ~$0.54/year                       |
| Query calls            | Free                              |
| Composite queries      | Free                              |

---

## Phases

### Phase 1: Core (TODAY - must be fully functional + tested)

- [ ] Factory canister (Motoko)
- [ ] UserVault canister (Motoko)
- [ ] OpenClaw extension (TypeScript)
- [ ] Companion skill (SKILL.md)
- [ ] Comprehensive test suite
- [ ] Local dfx deployment working

### Phase 2: Security (Future)

- [ ] vetKeys encryption
- [ ] Web dashboard canister

### Phase 3: Ecosystem (Future)

- [ ] TEE subnet deployment
- [ ] Chain Fusion cycle top-up
- [ ] Verifiable Credentials
- [ ] Multi-agent shared memory
- [ ] Canister migration

### Phase 4: Scale (Future)

- [ ] SDK for other AI assistants
- [ ] Memory marketplace
- [ ] SNS governance

---

## Tooling

- **dfx** (still primary CLI, use dfxvm for version management)
- **Motoko compiler** 0.15.x (EOP default, `persistent actor`)
- **@dfinity/agent** (TypeScript, canister interaction from Node.js)
- **@dfinity/auth-client** (Internet Identity 2.0 auth flow)
- **vitest** (OpenClaw's test framework)
- **pnpm** (OpenClaw's package manager)

# ADR-008: Multi-Tenant Session Isolation

## Status: PROPOSED

## Date: 2026-02-13

## Bounded Context: Session Management

## Context

The current OpenClaw + Cloud.ru FM integration (ADR-001 through ADR-005) assumes a
single-user deployment model. One OpenClaw bot instance runs on a Cloud.ru VM, and
one user interacts with it at a time. The `serialize: true` flag in the default
`claude-cli` backend (ADR-003) enforces sequential request processing globally.

When multiple users connect to the same OpenClaw bot via Telegram or MAX messenger,
the following resources are **shared without isolation**:

1. **Conversation history** -- Claude Code `--session-id` is derived from the OpenClaw
   conversation ID, but all users share the same Claude Code working directory and
   session storage namespace.
2. **CLAUDE.md** -- A single project-level `CLAUDE.md` applies to every user. There is
   no mechanism for per-user instructions, training data, or behavioral customization.
3. **Tool permissions** -- Tools are globally disabled via `cli-runner.ts:82-83` (ADR-003).
   When tools are enabled in the future, there is no per-user access tier to control
   which tools each user may invoke.
4. **Filesystem** -- Claude Code operates in a single working directory. If file tools
   are enabled, User A can read and modify User B's files.
5. **AgentDB memory** -- All memory operations share a single namespace. User A's
   stored patterns, context, and learned behaviors leak to User B.

### Threat Model

| Threat | Vector | Impact |
|--------|--------|--------|
| Cross-user data leakage | Shared session store | Critical -- conversation privacy violation |
| Privilege escalation | Shared tool permissions | High -- free-tier user accesses paid tools |
| Filesystem escape | Shared working directory | Critical -- arbitrary file read/write |
| Memory poisoning | Shared AgentDB namespace | Medium -- corrupted reasoning patterns |
| Resource exhaustion | No per-user limits | High -- one user starves others |

### DDD Aggregate: UserTenant

The `UserTenant` aggregate is the root entity that encapsulates all per-user isolation
boundaries. Every user interaction must be resolved to a `UserTenant` before any
processing occurs. The aggregate enforces invariants around workspace isolation,
session ownership, and tool access control.

Aggregate lifecycle:
```
UNKNOWN_USER --> TENANT_CREATED --> WORKSPACE_PROVISIONED --> ACTIVE
                                                                |
                                                   SESSION_STARTED / SESSION_RESUMED
                                                                |
                                                          PROCESSING
                                                                |
                                                   SESSION_SUSPENDED / TENANT_DEACTIVATED
```

### DDD Value Objects

```typescript
/** Globally unique tenant identifier. Deterministic from platform + platformUserId. */
type TenantId = string; // Format: "tg_{telegram_user_id}" | "max_{max_user_id}"

/** Claude Code session identifier. Scoped to tenant + conversation. */
type SessionId = string; // Format: "{tenantId}:{conversationId}"

/** Absolute path to tenant's sandboxed workspace root. */
type WorkspacePath = string; // Format: "/var/openclaw/tenants/{tenantId}/workspace"

/** Tool access tier controlling which Claude Code tools a user may invoke. */
type ToolAccessTier = "free" | "standard" | "premium" | "admin";

/** Messenger platform origin. */
type MessengerPlatform = "telegram" | "max";

/** Per-user CLAUDE.md content hash for cache invalidation. */
type ClaudeMdHash = string; // SHA-256 of CLAUDE.md content
```

### DDD Domain Events

| Event | Trigger | Payload |
|-------|---------|---------|
| `TenantCreated` | First message from unknown user | `{ tenantId, platform, platformUserId, displayName }` |
| `WorkspaceProvisioned` | After TenantCreated | `{ tenantId, workspacePath, quotaBytes }` |
| `SessionStarted` | New conversation or expired session | `{ tenantId, sessionId, claudeCodeSessionId }` |
| `SessionResumed` | Message in existing conversation | `{ tenantId, sessionId, messageCount }` |
| `SessionSuspended` | Idle timeout (30 min) | `{ tenantId, sessionId, lastMessageAt }` |
| `ConfigUpdated` | User modifies their CLAUDE.md or preferences | `{ tenantId, field, oldHash, newHash }` |
| `ToolAccessChanged` | Admin changes user tier | `{ tenantId, oldTier, newTier, changedBy }` |
| `TenantDeactivated` | User banned or self-deleted | `{ tenantId, reason, retainDataUntil }` |
| `WorkspaceCleanedUp` | Scheduled cleanup after deactivation | `{ tenantId, bytesFreed }` |

## Decision

### 1. Tenant Architecture

```typescript
interface UserTenant {
  /** Deterministic tenant ID derived from platform + user ID. */
  tenantId: TenantId;

  /** Source messenger platform. */
  platform: MessengerPlatform;

  /** Platform-specific user identifier (telegram user_id or MAX user_id). */
  platformUserId: string;

  /** Human-readable display name from the messenger profile. */
  displayName: string;

  /** Controls which Claude Code tools this user may invoke. */
  accessTier: ToolAccessTier;

  /** Workspace isolation configuration. */
  workspace: WorkspaceConfig;

  /** Active session configuration. */
  session: SessionConfig;

  /** Per-user CLAUDE.md content. Injected into Claude Code via --append-system-prompt. */
  claudeMd: string;

  /** AgentDB memory namespace. Isolated per tenant. */
  memoryNamespace: string;

  /** Tenant creation timestamp. */
  createdAt: Date;

  /** Last user activity timestamp. Updated on every message. */
  lastActiveAt: Date;

  /** Soft quota for workspace disk usage in bytes. */
  diskQuotaBytes: number;

  /** Current disk usage in bytes. Updated periodically. */
  diskUsageBytes: number;
}

interface WorkspaceConfig {
  /** Absolute path to the tenant's sandboxed workspace root. */
  rootPath: WorkspacePath;

  /** Whether the workspace has been provisioned on disk. */
  provisioned: boolean;

  /** Tmpfs mount size limit for ephemeral workloads. */
  tmpfsSizeMb: number;

  /** Allowed subdirectories within the workspace. */
  allowedPaths: string[];

  /** Paths explicitly denied (e.g., /etc, /var, parent traversal). */
  deniedPatterns: string[];
}

interface SessionConfig {
  /** Current active session ID (null if no active session). */
  activeSessionId: SessionId | null;

  /** Claude Code --session-id value for subprocess. */
  claudeCodeSessionId: string | null;

  /** Maximum idle time before session suspension (ms). */
  idleTimeoutMs: number;

  /** Maximum session duration regardless of activity (ms). */
  maxDurationMs: number;

  /** Maximum messages per session before forced rotation. */
  maxMessagesPerSession: number;

  /** Whether to persist session to cold storage on suspension. */
  persistOnSuspend: boolean;
}
```

### 2. Tool Access Tiers

```typescript
interface ToolAccessPolicy {
  tier: ToolAccessTier;

  /** Claude Code tools allowed for this tier. */
  allowedTools: ClaudeCodeTool[];

  /** Maximum concurrent requests (queue overflow returns 429). */
  maxConcurrentRequests: number;

  /** Rate limit: requests per minute. */
  rateLimitRpm: number;

  /** Maximum tokens per request (input + output). */
  maxTokensPerRequest: number;

  /** Model tier ceiling (prevents free users from using opus). */
  maxModelTier: "haiku" | "sonnet" | "opus";

  /** Whether MCP server access is permitted. */
  mcpAccess: boolean;
}

type ClaudeCodeTool =
  | "read"        // File read
  | "edit"        // File edit
  | "write"       // File write
  | "bash"        // Shell command execution
  | "glob"        // File pattern search
  | "grep"        // Content search
  | "web_search"  // Web search
  | "web_fetch"   // URL fetch
  | "notebook";   // Jupyter notebook

const TOOL_ACCESS_POLICIES: Record<ToolAccessTier, ToolAccessPolicy> = {
  free: {
    tier: "free",
    allowedTools: [],                        // No tools -- reasoning only (ADR-003 default)
    maxConcurrentRequests: 1,
    rateLimitRpm: 10,
    maxTokensPerRequest: 4096,
    maxModelTier: "haiku",
    mcpAccess: false,
  },
  standard: {
    tier: "standard",
    allowedTools: ["read", "glob", "grep", "web_search"],
    maxConcurrentRequests: 2,
    rateLimitRpm: 30,
    maxTokensPerRequest: 16384,
    maxModelTier: "sonnet",
    mcpAccess: false,
  },
  premium: {
    tier: "premium",
    allowedTools: ["read", "edit", "write", "bash", "glob", "grep", "web_search", "web_fetch", "notebook"],
    maxConcurrentRequests: 4,
    rateLimitRpm: 60,
    maxTokensPerRequest: 65536,
    maxModelTier: "opus",
    mcpAccess: true,
  },
  admin: {
    tier: "admin",
    allowedTools: ["read", "edit", "write", "bash", "glob", "grep", "web_search", "web_fetch", "notebook"],
    maxConcurrentRequests: 8,
    rateLimitRpm: 120,
    maxTokensPerRequest: 200000,
    maxModelTier: "opus",
    mcpAccess: true,
  },
};
```

### 3. Workspace Isolation Strategy

Each tenant gets a dedicated filesystem subtree under `/var/openclaw/tenants/`.
Claude Code's `--cwd` flag (or working directory) is set to the tenant's workspace
root before subprocess spawning.

```
/var/openclaw/tenants/
  tg_123456789/
    workspace/             # Claude Code working directory (--cwd)
      CLAUDE.md            # Per-user project instructions
      src/                 # User's source code (if tools enabled)
      docs/                # User's documents
      .openclaw-session/   # Claude Code session state
    config/
      tool-policy.json     # Serialized ToolAccessPolicy
      preferences.json     # User preferences
    tmp/                   # Tmpfs mount for ephemeral files
  max_987654321/
    workspace/
      CLAUDE.md
      ...
```

#### Filesystem Boundaries

```typescript
interface WorkspaceIsolation {
  /** Set Claude Code working directory to tenant workspace. */
  setCwd(tenantId: TenantId): string;

  /** Validate that a path resolves within the tenant workspace (prevent traversal). */
  validatePath(tenantId: TenantId, requestedPath: string): boolean;

  /** Provision workspace directories for a new tenant. */
  provision(tenantId: TenantId, quotaBytes: number): Promise<WorkspacePath>;

  /** Destroy workspace and all contents (after deactivation grace period). */
  destroy(tenantId: TenantId): Promise<{ bytesFreed: number }>;

  /** Calculate current disk usage for a tenant workspace. */
  calculateUsage(tenantId: TenantId): Promise<number>;
}
```

#### Path Traversal Prevention

```typescript
function validateTenantPath(tenantId: TenantId, requestedPath: string): boolean {
  const tenantRoot = path.resolve(`/var/openclaw/tenants/${tenantId}/workspace`);
  const resolved = path.resolve(tenantRoot, requestedPath);

  // Must start with tenant root (prevents ../../etc/passwd)
  if (!resolved.startsWith(tenantRoot)) {
    return false;
  }

  // Must not contain symlinks escaping the sandbox
  const real = fs.realpathSync(resolved);
  return real.startsWith(tenantRoot);
}
```

### 4. Session Persistence

Sessions use a two-tier storage model matching the pattern established in the
integration architecture research.

| Storage | Data | TTL | Purpose |
|---------|------|-----|---------|
| Redis | Active session state, context window, rate limit counters | 30 min idle | Hot path -- fast reads during active conversation |
| PostgreSQL | Full conversation history, audit log | 90 days | Cold storage -- persistence, search, compliance |
| AgentDB | Per-tenant memory patterns, learned behaviors | Indefinite | Reasoning memory -- scoped by `memoryNamespace` |

```typescript
interface TenantSessionStore {
  /** Resolve or create a session for an incoming message. */
  resolveSession(tenantId: TenantId, conversationId: string): Promise<TenantSession>;

  /** Suspend an active session (move hot state to cold). */
  suspendSession(sessionId: SessionId): Promise<void>;

  /** Resume a suspended session (restore hot state from cold). */
  resumeSession(sessionId: SessionId): Promise<TenantSession>;

  /** List all sessions for a tenant (paginated). */
  listSessions(tenantId: TenantId, options: PaginationOptions): Promise<TenantSession[]>;

  /** Permanently delete session data (GDPR right-to-forget). */
  purgeSession(sessionId: SessionId): Promise<void>;
}

interface TenantSession {
  sessionId: SessionId;
  tenantId: TenantId;
  conversationId: string;
  claudeCodeSessionId: string;
  state: "active" | "suspended" | "expired" | "purged";
  messageCount: number;
  tokenUsage: { input: number; output: number };
  createdAt: Date;
  lastMessageAt: Date;
  expiresAt: Date;
}
```

#### Claude Code Session ID Mapping

OpenClaw's `resolveSessionIdToSend()` currently generates a session ID from the
OpenClaw conversation ID. For multi-tenant isolation, the session ID must include
the tenant ID to prevent cross-tenant session collisions:

```typescript
function resolveMultiTenantSessionId(
  tenantId: TenantId,
  conversationId: string
): string {
  // Deterministic, collision-free session ID scoped to tenant
  return `${tenantId}:${conversationId}`;
}
```

This session ID is passed to Claude Code via `--session-id` and used for
`--resume` on subsequent messages in the same conversation.

### 5. CLAUDE.md Per-User Customization

Each tenant gets an independent `CLAUDE.md` file in their workspace root. This
file is the single source of truth for Claude Code's project instructions when
processing that tenant's messages.

#### Layered Configuration Model

```
Base CLAUDE.md (system-level, read-only)
  |
  +-- Tier CLAUDE.md (per access tier, read-only)
  |     |
  |     +-- Tenant CLAUDE.md (per user, user-writable)
```

```typescript
interface ClaudeMdManager {
  /** Compose the effective CLAUDE.md for a tenant by merging layers. */
  compose(tenantId: TenantId): Promise<string>;

  /** Update only the tenant's user-writable CLAUDE.md layer. */
  updateUserLayer(tenantId: TenantId, content: string): Promise<void>;

  /** Get the tenant's current user-writable CLAUDE.md content. */
  getUserLayer(tenantId: TenantId): Promise<string>;

  /** Reset the tenant's CLAUDE.md to tier defaults. */
  resetToDefaults(tenantId: TenantId): Promise<void>;
}

/** Merge order: base -> tier -> user (user overrides take precedence). */
function composeClaudeMd(
  baseMd: string,
  tierMd: string,
  userMd: string
): string {
  return [
    "# System Instructions (read-only)",
    baseMd,
    "",
    "# Tier Instructions (read-only)",
    tierMd,
    "",
    "# User Instructions",
    userMd,
  ].join("\n");
}
```

#### Training / Personalization Flow

Users can modify their CLAUDE.md layer via messenger commands:

| Command | Action |
|---------|--------|
| `/config show` | Display current user-layer CLAUDE.md |
| `/config set <content>` | Replace user-layer CLAUDE.md |
| `/config append <content>` | Append to user-layer CLAUDE.md |
| `/config reset` | Reset to tier defaults |
| `/config export` | Download CLAUDE.md as file |

### 6. AgentDB Memory Namespace Isolation

Every tenant's memory operations are scoped to a dedicated AgentDB namespace.
This prevents cross-tenant memory leakage and enables per-tenant memory management.

```typescript
function tenantMemoryNamespace(tenantId: TenantId): string {
  return `tenant:${tenantId}`;
}

// All AgentDB operations for a tenant use this namespace:
// npx @claude-flow/cli@latest memory store --namespace "tenant:tg_123456789" ...
// npx @claude-flow/cli@latest memory search --namespace "tenant:tg_123456789" ...
```

### 7. Tenant Resolution Flow

Every incoming message must be resolved to a `UserTenant` before processing.
This is the critical path that enforces isolation.

```
Incoming Message (Telegram/MAX)
  |
  v
1. Extract platformUserId from message metadata
  |
  v
2. Derive tenantId: "{platform}_{platformUserId}"
  |
  v
3. TenantStore.getOrCreate(tenantId)
   |-- EXISTS: Load tenant config, update lastActiveAt
   |-- NEW:    Emit TenantCreated, provision workspace, emit WorkspaceProvisioned
  |
  v
4. RateLimiter.check(tenantId, tenant.accessTier)
   |-- ALLOWED: Continue
   |-- DENIED:  Return 429 to user
  |
  v
5. SessionStore.resolveSession(tenantId, conversationId)
   |-- ACTIVE:    Resume session (--resume --session-id)
   |-- SUSPENDED: Resume from cold storage, emit SessionResumed
   |-- NONE:      Create new session, emit SessionStarted
  |
  v
6. Compose effective CLAUDE.md (base + tier + user layers)
  |
  v
7. Resolve ToolAccessPolicy for tenant.accessTier
  |
  v
8. Spawn Claude Code subprocess:
   claude -p --output-format json \
     --session-id "{tenantId}:{conversationId}" \
     --append-system-prompt "{composedClaudeMd}" \
     --cwd "/var/openclaw/tenants/{tenantId}/workspace" \
     --model {tier-appropriate-model} \
     "{userMessage}"
   env: {
     ANTHROPIC_BASE_URL: "http://localhost:8082",
     ANTHROPIC_API_KEY: "cloudru-proxy-key",
     HOME: "/var/openclaw/tenants/{tenantId}",  // Isolate ~/.claude
   }
```

### 8. Tenant Data Store

```typescript
interface TenantStore {
  /** Get or create a tenant from a messenger message. */
  getOrCreate(
    platform: MessengerPlatform,
    platformUserId: string,
    displayName: string
  ): Promise<UserTenant>;

  /** Get tenant by ID. Returns null if not found. */
  getById(tenantId: TenantId): Promise<UserTenant | null>;

  /** Update tenant fields (partial update). */
  update(tenantId: TenantId, fields: Partial<UserTenant>): Promise<void>;

  /** Deactivate a tenant (soft delete). */
  deactivate(tenantId: TenantId, reason: string): Promise<void>;

  /** List all tenants (admin only, paginated). */
  listAll(options: PaginationOptions): Promise<UserTenant[]>;

  /** Purge all tenant data (GDPR compliance). */
  purge(tenantId: TenantId): Promise<void>;
}
```

PostgreSQL schema for tenant persistence:

```sql
CREATE TABLE tenants (
    tenant_id       VARCHAR(128) PRIMARY KEY,
    platform        VARCHAR(16) NOT NULL CHECK (platform IN ('telegram', 'max')),
    platform_user_id VARCHAR(128) NOT NULL,
    display_name    VARCHAR(255),
    access_tier     VARCHAR(16) NOT NULL DEFAULT 'free'
                    CHECK (access_tier IN ('free', 'standard', 'premium', 'admin')),
    claude_md_user  TEXT DEFAULT '',
    memory_namespace VARCHAR(255) NOT NULL,
    workspace_path  VARCHAR(512) NOT NULL,
    disk_quota_bytes BIGINT NOT NULL DEFAULT 104857600,  -- 100 MB
    disk_usage_bytes BIGINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_active_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deactivated_at  TIMESTAMP,
    deactivation_reason TEXT,

    UNIQUE (platform, platform_user_id),
    INDEX idx_platform_user (platform, platform_user_id),
    INDEX idx_access_tier (access_tier),
    INDEX idx_last_active (last_active_at)
);

CREATE TABLE tenant_sessions (
    session_id          VARCHAR(255) PRIMARY KEY,
    tenant_id           VARCHAR(128) NOT NULL REFERENCES tenants(tenant_id),
    conversation_id     VARCHAR(255) NOT NULL,
    claude_code_session VARCHAR(255) NOT NULL,
    state               VARCHAR(16) NOT NULL DEFAULT 'active'
                        CHECK (state IN ('active', 'suspended', 'expired', 'purged')),
    message_count       INTEGER NOT NULL DEFAULT 0,
    token_usage_input   BIGINT NOT NULL DEFAULT 0,
    token_usage_output  BIGINT NOT NULL DEFAULT 0,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_message_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at          TIMESTAMP NOT NULL,

    INDEX idx_tenant_sessions (tenant_id),
    INDEX idx_state (state),
    INDEX idx_expires (expires_at)
);

CREATE TABLE tenant_audit_log (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(128) REFERENCES tenants(tenant_id),
    event_type      VARCHAR(64) NOT NULL,
    event_payload   JSONB,
    ip_address      INET,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_tenant_audit (tenant_id),
    INDEX idx_event_type (event_type),
    INDEX idx_audit_created (created_at)
) PARTITION BY RANGE (created_at);
```

## Consequences

### Positive

- **Complete isolation**: Each user operates in a fully sandboxed environment with
  no cross-tenant data leakage in sessions, files, memory, or configurations.
- **Graduated access control**: The four-tier tool access model (free/standard/premium/admin)
  allows fine-grained control over resource consumption and security exposure.
- **Per-user CLAUDE.md**: Users can train and customize their bot experience without
  affecting other users. The layered merge model ensures system policies cannot be overridden.
- **Deterministic tenant IDs**: The `{platform}_{platformUserId}` scheme is collision-free,
  requires no central ID generation, and is human-readable in logs and debugging.
- **GDPR-ready**: The `purge()` operation on `TenantStore` enables complete data deletion
  for right-to-forget compliance.
- **Backward compatible**: Single-user deployments continue to work -- the default tenant
  is created automatically on first message, with no configuration changes required.

### Negative

- **Infrastructure complexity**: Requires Redis, PostgreSQL, and per-tenant filesystem
  provisioning. The current single-process single-directory model is significantly simpler.
- **Disk management**: Per-user workspaces consume disk space that must be monitored
  and garbage-collected. Cloud.ru VM disk is a finite resource.
- **Cold start latency**: First message from a new user triggers workspace provisioning
  (directory creation, CLAUDE.md composition, policy resolution) adding ~200-500ms.
- **Session resumption overhead**: Restoring a suspended session from PostgreSQL to Redis
  adds latency compared to an always-hot single-user session.
- **Operational burden**: Tenant management (tier changes, workspace cleanup, audit log
  rotation) requires admin tooling that does not currently exist.

### Risks

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|-----------|
| Path traversal escape | Low | Critical | `validateTenantPath()` with realpath check, deny symlinks |
| Session ID collision | Very Low | High | Deterministic derivation from tenantId + conversationId |
| Disk exhaustion | Medium | High | Per-tenant quotas, periodic usage scans, cleanup cron |
| Redis memory exhaustion | Medium | Medium | TTL on all keys, eviction policy `volatile-lru` |
| Tenant store corruption | Low | High | PostgreSQL transactions, WAL, daily backups |
| Privilege escalation via CLAUDE.md | Low | Medium | User layer cannot override system/tier layers |

### Invariants (DDD)

1. **Tenant Identity Uniqueness**: For any given `(platform, platformUserId)` pair, exactly
   one `UserTenant` aggregate must exist. Enforced by the `UNIQUE` constraint on the
   `tenants` table and the deterministic `TenantId` derivation.

2. **Workspace Containment**: All file operations for a tenant must resolve to paths
   within `/var/openclaw/tenants/{tenantId}/workspace`. No path may escape this root.
   Enforced by `validateTenantPath()` with symlink resolution.

3. **Session Ownership**: A `TenantSession` belongs to exactly one `UserTenant`. The
   `tenant_id` foreign key in `tenant_sessions` enforces this at the data level. The
   `resolveMultiTenantSessionId()` function enforces this at the application level.

4. **Tool Access Monotonicity**: A tenant's effective tool permissions are the intersection
   of their `ToolAccessPolicy` and the system-level tool configuration. A user-layer
   CLAUDE.md cannot grant tools beyond what their access tier permits.

5. **Memory Namespace Isolation**: AgentDB operations for a tenant are always scoped to
   `tenant:{tenantId}`. No cross-namespace queries are permitted in normal operation.

## Module Boundary: `@openclaw/tenant-manager`

```
@openclaw/tenant-manager/
  src/
    domain/
      tenant.ts            # UserTenant aggregate, value objects, domain events
      tool-policy.ts       # ToolAccessTier, ToolAccessPolicy, TOOL_ACCESS_POLICIES
      session.ts           # TenantSession entity, SessionConfig
    application/
      tenant-store.ts      # TenantStore interface + PostgreSQL implementation
      session-store.ts     # TenantSessionStore interface + Redis/PostgreSQL impl
      claude-md-manager.ts # ClaudeMdManager interface + filesystem implementation
      workspace-manager.ts # WorkspaceIsolation interface + filesystem implementation
      rate-limiter.ts      # Per-tenant rate limiting (Redis-backed)
    infrastructure/
      migrations/          # PostgreSQL schema migrations
        001-create-tenants.sql
        002-create-sessions.sql
        003-create-audit-log.sql
      redis-keys.ts        # Redis key naming conventions
      tenant-resolver.ts   # Middleware: message -> UserTenant resolution
    api/
      tenant-commands.ts   # /config show|set|append|reset|export handlers
      admin-commands.ts    # /admin tenant list|tier|deactivate|purge handlers
```

### Integration Points with Existing OpenClaw Modules

| Existing Module | Integration | Change Type |
|----------------|-------------|-------------|
| `agent-runner.ts` | Call `tenantResolver.resolve()` before `runCliAgent()` | Modification |
| `cli-runner.ts` | Accept `tenantWorkspacePath` and `tenantClaudeMd` params | Modification |
| `cli-backends.ts` | Merge tenant-specific env (`HOME`, `--cwd`) into backend config | Modification |
| `auth-choice.apply.cloudru-fm.ts` | No change (proxy config is system-level) | None |
| `cloudru-proxy-health.ts` | No change (health check is system-level) | None |

### Dependency Direction

```
@openclaw/tenant-manager
  depends on:
    - @openclaw/core (config types, agent runner interfaces)
    - redis (ioredis)
    - pg (node-postgres)

  depended on by:
    - @openclaw/agent-runner (tenant resolution middleware)
    - @openclaw/commands (tenant management commands)

  does NOT depend on:
    - @openclaw/proxy (proxy is infrastructure, not tenant-aware)
    - @openclaw/wizard (wizard is onboarding, not runtime)
```

## References

- ADR-001: Cloud.ru FM Integration via Claude Code Proxy
- ADR-003: Claude Code as Agentic Execution Engine (session ID handling, tools disabled)
- ADR-004: Proxy Lifecycle Management (infrastructure layer, not tenant-aware)
- `src/agents/cli-runner.ts:82-83` -- Tools disabled injection (to be replaced by per-tenant policy)
- `src/auto-reply/reply/agent-runner.ts:378` -- CLI provider routing (tenant resolution insertion point)
- Integration Architecture Research: `docs/research/integration-architecture-overview.md` (SessionStore, UserSession)

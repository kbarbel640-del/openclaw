# ADR-007: Claude Code Tools & MCP Enablement

## Status: PROPOSED (supersedes ADR-003 tools restriction)

## Date: 2026-02-13

## Bounded Context: Agent Execution

## Context

ADR-003 established Claude Code as the agentic execution engine for OpenClaw's
cloud.ru FM integration. In that decision, `cli-runner.ts:82-83` injects the
directive `"Tools are disabled in this session. Do not call tools."` into every
Claude Code subprocess. This was a deliberate security measure: enabling arbitrary
tool execution (file writes, bash commands, MCP server calls) in a multi-tenant
environment without workspace isolation poses unacceptable risk.

However, the target architecture for OpenClaw + Cloud.ru AI Fabric requires:

1. **MCP Server Integration** -- Cloud.ru AI Fabric exposes MCP Registry servers
   (Managed RAG, PostgreSQL, S3, Web Search, Git) that agents must consume via
   the Model Context Protocol (stdio, SSE, or streamable-http transports).

2. **AI Fabric Agents/Multi-Agents** -- Cloud.ru supports five agent archetypes
   (reactive, model-based, goal-directed, utility-maximizing, learning) that
   orchestrate tool calls as a core capability. Disabling tools eliminates the
   entire agent layer.

3. **Full Claude Code CLI Capabilities** -- Claude Code's value proposition is
   its agentic chassis: multi-step reasoning, file operations, bash execution,
   MCP orchestration, and session persistence. ADR-003 acknowledges this
   ("task quality HIGHER than model quality alone") yet disables the mechanism
   that delivers it.

4. **User Training/Customization** -- Users need to fine-tune agent behavior,
   connect custom MCP servers, configure tool permissions, and build domain-
   specific workflows. This is impossible with tools globally disabled.

The conflict is clear: ADR-003's tools restriction blocks every strategic
capability the target architecture depends on. This ADR resolves the conflict
by introducing a tiered tool access model with per-user sandboxing.

### DDD Aggregate: ToolExecutionContext

The `ToolExecutionContext` aggregate manages the lifecycle of tool permissions,
sandbox enforcement, and execution auditing for a single user session. It is
the authoritative boundary for determining what a Claude Code subprocess is
allowed to do.

```
ToolExecutionContext
  ├── AccessTier (value object)
  ├── SandboxConfig (value object)
  ├── AllowedTools[] (value object collection)
  ├── MCPServerBinding[] (entity)
  ├── AuditLog (entity)
  └── ResourceQuota (value object)
```

**Aggregate Invariants:**
- A `ToolExecutionContext` MUST have a resolved `AccessTier` before any tool
  execution occurs.
- The `SandboxConfig` MUST be immutable once the subprocess is spawned.
- `AllowedTools` is an allowlist -- anything not listed is denied by default.

## Decision

### 1. Three-Tier Tool Access Model

Replace the global `"Tools are disabled"` injection with a per-user access tier
resolved at session creation time.

| Tier | Access Level | Users | Tools Available | System Prompt Injection |
|------|-------------|-------|-----------------|------------------------|
| **Restricted** | Read-only | Anonymous, new users, untrusted | No tools. Pure LLM reasoning only. | `"Tools are disabled in this session."` (same as ADR-003) |
| **Standard** | Sandboxed | Authenticated users with valid API key | MCP servers (approved list), RAG search, web search. No file ops, no bash. | `"You may use the following tools: [list]. Do NOT use file operations or bash."` |
| **Full** | All tools | Admin, trusted users, self-hosted instances | Full Claude Code: file ops, bash, MCP, search, edit. | No tool restriction injected. CLAUDE.md governs behavior. |

**Tier Resolution Logic:**

```typescript
interface AccessTierConfig {
  tier: 'restricted' | 'standard' | 'full';
  resolvedBy: 'config' | 'user-role' | 'api-key-scope' | 'default';
}

function resolveAccessTier(
  userContext: UserContext,
  instanceConfig: InstanceConfig
): AccessTierConfig {
  // Self-hosted instances default to 'full' -- operator controls their own infra
  if (instanceConfig.selfHosted) {
    return { tier: 'full', resolvedBy: 'config' };
  }

  // Admin role always gets full access
  if (userContext.roles.includes('admin')) {
    return { tier: 'full', resolvedBy: 'user-role' };
  }

  // API key with tool scope gets standard access
  if (userContext.apiKeyScopes?.includes('tools')) {
    return { tier: 'standard', resolvedBy: 'api-key-scope' };
  }

  // Authenticated users get standard by default (configurable)
  if (userContext.authenticated) {
    return {
      tier: instanceConfig.defaultAuthenticatedTier ?? 'standard',
      resolvedBy: 'config',
    };
  }

  // Anonymous users are always restricted
  return { tier: 'restricted', resolvedBy: 'default' };
}
```

### 2. CLI Runner Modification

Replace the hardcoded tools-disabled injection in `cli-runner.ts:82-83` with
tier-aware prompt construction.

**Before (ADR-003):**
```typescript
// cli-runner.ts:82-83
systemPrompt += "\nTools are disabled in this session. Do not call tools.";
```

**After (ADR-007):**
```typescript
// cli-runner.ts -- tool access injection
function buildToolAccessDirective(tier: AccessTierConfig, allowedTools: string[]): string {
  switch (tier.tier) {
    case 'restricted':
      return '\nTools are disabled in this session. Do not call tools.';

    case 'standard':
      return [
        '\nYou may use the following tools ONLY:',
        ...allowedTools.map(t => `  - ${t}`),
        'Do NOT use file operations (Read, Write, Edit) or Bash commands.',
        'Do NOT attempt to access tools not listed above.',
      ].join('\n');

    case 'full':
      return ''; // No restriction -- CLAUDE.md and --allowed-tools govern behavior
  }
}
```

### 3. MCP Server Integration

Cloud.ru AI Fabric provides MCP servers via its MCP Registry. These must be
consumable by Claude Code subprocesses through the `--mcp-config` flag or
environment-based MCP configuration.

```typescript
/**
 * Configuration for a single MCP server binding.
 * Represents a Cloud.ru MCP Registry entry or a custom user-defined server.
 */
interface MCPServerConfig {
  /** Unique identifier for this MCP server instance */
  id: string;

  /** Human-readable name displayed in tool listings */
  name: string;

  /** MCP server endpoint URL (for SSE/HTTP transports) or command (for stdio) */
  url: string;

  /** Transport protocol for MCP communication */
  transport: 'stdio' | 'sse' | 'streamable-http';

  /** Authentication configuration for the MCP server */
  auth?: {
    type: 'bearer' | 'api-key' | 'iam';
    /** Token or key value. MUST come from env/secrets, never hardcoded. */
    tokenEnvVar: string;
  };

  /** Sandbox restrictions applied to this MCP server */
  sandbox: SandboxConfig;

  /** Rate limiting configuration */
  rateLimit: RateLimitConfig;

  /** Minimum access tier required to use this MCP server */
  minimumTier: 'restricted' | 'standard' | 'full';

  /** List of tool names this MCP server provides */
  exposedTools: string[];

  /** Whether this server is from Cloud.ru MCP Registry (managed) or user-defined */
  source: 'cloudru-registry' | 'custom';
}

/**
 * Rate limiting for MCP server calls.
 */
interface RateLimitConfig {
  /** Maximum requests per minute per user */
  requestsPerMinute: number;

  /** Maximum concurrent requests per user */
  maxConcurrent: number;

  /** Maximum total tokens per hour (for LLM-backed MCP servers) */
  tokensPerHour?: number;
}

/**
 * Complete MCP configuration passed to Claude Code subprocess.
 * Maps to the JSON structure expected by `--mcp-config`.
 */
interface MCPConfigManifest {
  mcpServers: Record<string, {
    command?: string;
    args?: string[];
    url?: string;
    transport?: 'sse' | 'streamable-http';
    env?: Record<string, string>;
  }>;
}
```

**Cloud.ru MCP Registry Mapping:**

| Cloud.ru MCP Server | Transport | Min Tier | Use Case |
|---------------------|-----------|----------|----------|
| Managed RAG Server | SSE | Standard | Knowledge base search |
| PostgreSQL MCP Server | stdio | Full | Database queries |
| S3 MCP Server | stdio | Full | Object storage operations |
| Web Search MCP Server | SSE | Standard | Internet search |
| Git MCP Server | stdio | Full | Repository operations |
| Email MCP Server | SSE | Standard | Email send/receive |

**MCP Config Generation:**

```typescript
function buildMCPConfig(
  tier: AccessTierConfig,
  availableServers: MCPServerConfig[],
  userEnv: Record<string, string>
): MCPConfigManifest {
  const eligible = availableServers.filter(server => {
    const tierRank = { restricted: 0, standard: 1, full: 2 };
    return tierRank[tier.tier] >= tierRank[server.minimumTier];
  });

  const mcpServers: MCPConfigManifest['mcpServers'] = {};

  for (const server of eligible) {
    if (server.transport === 'stdio') {
      mcpServers[server.id] = {
        command: server.url,
        args: [],
        env: server.auth
          ? { [server.auth.type === 'bearer' ? 'AUTH_TOKEN' : 'API_KEY']: userEnv[server.auth.tokenEnvVar] ?? '' }
          : {},
      };
    } else {
      mcpServers[server.id] = {
        url: server.url,
        transport: server.transport,
        env: server.auth
          ? { [server.auth.type === 'bearer' ? 'AUTH_TOKEN' : 'API_KEY']: userEnv[server.auth.tokenEnvVar] ?? '' }
          : {},
      };
    }
  }

  return { mcpServers };
}
```

### 4. Sandbox Architecture

Every Claude Code subprocess executes within a sandbox that enforces filesystem,
network, and resource boundaries. The sandbox is configured per access tier and
is immutable after subprocess spawn.

```typescript
/**
 * Sandbox configuration for a Claude Code subprocess.
 * Enforced at the OS level via Docker/gVisor or filesystem restrictions.
 */
interface SandboxConfig {
  /** Isolation mechanism */
  isolation: 'none' | 'chroot' | 'docker' | 'gvisor';

  /** Filesystem restrictions */
  filesystem: {
    /** Root directory for the sandbox (per-user workspace) */
    rootDir: string;

    /** Directories writable by the subprocess */
    writablePaths: string[];

    /** Directories readable by the subprocess */
    readablePaths: string[];

    /** Maximum total disk usage in MB */
    maxDiskMB: number;

    /** File extensions that may be created (empty = all allowed) */
    allowedExtensions?: string[];
  };

  /** Network restrictions */
  network: {
    /** Whether outbound network is allowed */
    outboundAllowed: boolean;

    /** Allowed outbound domains (empty = all allowed if outboundAllowed) */
    allowedDomains: string[];

    /** Blocked outbound domains (takes precedence over allowed) */
    blockedDomains: string[];

    /** Maximum outbound requests per minute */
    requestsPerMinute: number;
  };

  /** Resource limits */
  resources: {
    /** Maximum memory in MB */
    maxMemoryMB: number;

    /** Maximum CPU time in seconds */
    maxCpuSeconds: number;

    /** Maximum subprocess execution time in seconds */
    maxWallTimeSeconds: number;

    /** Maximum number of child processes */
    maxProcesses: number;
  };
}

/**
 * Per-tier sandbox defaults.
 */
const SANDBOX_DEFAULTS: Record<string, SandboxConfig> = {
  restricted: {
    isolation: 'none',
    filesystem: {
      rootDir: '/dev/null',
      writablePaths: [],
      readablePaths: [],
      maxDiskMB: 0,
      allowedExtensions: [],
    },
    network: {
      outboundAllowed: false,
      allowedDomains: [],
      blockedDomains: ['*'],
      requestsPerMinute: 0,
    },
    resources: {
      maxMemoryMB: 256,
      maxCpuSeconds: 30,
      maxWallTimeSeconds: 60,
      maxProcesses: 1,
    },
  },

  standard: {
    isolation: 'docker',
    filesystem: {
      rootDir: '/tmp/openclaw/workspaces/${userId}',
      writablePaths: ['/tmp/openclaw/workspaces/${userId}/scratch'],
      readablePaths: ['/tmp/openclaw/workspaces/${userId}'],
      maxDiskMB: 100,
      allowedExtensions: ['.txt', '.md', '.json', '.csv'],
    },
    network: {
      outboundAllowed: true,
      allowedDomains: [
        'foundation-models.api.cloud.ru',
        '*.mcp.cloud.ru',
      ],
      blockedDomains: [],
      requestsPerMinute: 60,
    },
    resources: {
      maxMemoryMB: 512,
      maxCpuSeconds: 120,
      maxWallTimeSeconds: 300,
      maxProcesses: 5,
    },
  },

  full: {
    isolation: 'docker',
    filesystem: {
      rootDir: '/tmp/openclaw/workspaces/${userId}',
      writablePaths: ['/tmp/openclaw/workspaces/${userId}'],
      readablePaths: ['/'],
      maxDiskMB: 1024,
    },
    network: {
      outboundAllowed: true,
      allowedDomains: [],
      blockedDomains: [],
      requestsPerMinute: 300,
    },
    resources: {
      maxMemoryMB: 2048,
      maxCpuSeconds: 600,
      maxWallTimeSeconds: 900,
      maxProcesses: 20,
    },
  },
};
```

**Per-User Workspace Isolation:**

```
/tmp/openclaw/workspaces/
  ├── user-abc123/          # User A workspace
  │   ├── scratch/          # Writable area (Standard tier)
  │   ├── mcp-data/         # MCP server data cache
  │   └── .session/         # Claude Code session state
  ├── user-def456/          # User B workspace (fully isolated)
  │   ├── scratch/
  │   ├── mcp-data/
  │   └── .session/
  └── ...
```

Each workspace is created at session start and cleaned up based on TTL policy.
Cross-user access is prevented by OS-level permissions (uid mapping in Docker)
and by the sandbox `rootDir` restriction.

### 5. Claude Code CLI Configuration per Tier

The `--allowed-tools` and `--mcp-config` flags on the `claude` subprocess are
set dynamically based on the resolved access tier.

```typescript
interface ClaudeCliArgs {
  /** Base args always present */
  base: string[];
  /** Tool-related args, tier-dependent */
  toolArgs: string[];
  /** MCP config file path (temporary, per-session) */
  mcpConfigPath?: string;
}

function buildClaudeCliArgs(
  tier: AccessTierConfig,
  mcpConfig: MCPConfigManifest | null,
  sessionId: string,
  message: string
): ClaudeCliArgs {
  const base = [
    '-p',
    '--output-format', 'json',
    '--dangerously-skip-permissions',
    '--session-id', sessionId,
  ];

  let toolArgs: string[] = [];
  let mcpConfigPath: string | undefined;

  switch (tier.tier) {
    case 'restricted':
      // No tools, no MCP
      toolArgs = ['--allowed-tools', ''];
      break;

    case 'standard':
      // Allowlisted tools only + approved MCP servers
      toolArgs = [
        '--allowed-tools',
        'mcp__*,WebSearch,WebFetch',
      ];
      if (mcpConfig && Object.keys(mcpConfig.mcpServers).length > 0) {
        mcpConfigPath = `/tmp/openclaw/mcp-configs/${sessionId}.json`;
        toolArgs.push('--mcp-config', mcpConfigPath);
      }
      break;

    case 'full':
      // All tools available, MCP included
      if (mcpConfig && Object.keys(mcpConfig.mcpServers).length > 0) {
        mcpConfigPath = `/tmp/openclaw/mcp-configs/${sessionId}.json`;
        toolArgs = ['--mcp-config', mcpConfigPath];
      }
      break;
  }

  return { base, toolArgs, mcpConfigPath };
}
```

### 6. Security Model

#### 6.1 Threat Model

| Threat | Vector | Mitigation |
|--------|--------|-----------|
| Arbitrary code execution | User crafts prompt to execute malicious bash | Tier-based tool allowlisting; bash only in Full tier |
| Filesystem escape | Subprocess writes outside workspace | Docker rootDir mount; chroot; OS-level permissions |
| Cross-user data access | Subprocess reads another user's workspace | Uid-isolated Docker containers; workspace path templating |
| MCP server abuse | Excessive calls to Cloud.ru MCP servers | Per-user rate limiting (`RateLimitConfig`) |
| Secret exfiltration | Tool reads env vars or files containing secrets | `clearEnv` (from ADR-003); no secrets in workspace |
| Denial of service | Subprocess consumes excessive CPU/memory | `resources` limits in `SandboxConfig`; wall-time timeout |
| Prompt injection via MCP | MCP server returns malicious tool results | Output sanitization; MCP response size limits |
| Privilege escalation | Standard user attempts Full-tier actions | Tier resolved at session start; immutable after spawn |

#### 6.2 Audit Trail

Every tool invocation is logged to an append-only audit log per session:

```typescript
interface ToolAuditEntry {
  timestamp: string;
  sessionId: string;
  userId: string;
  tier: 'restricted' | 'standard' | 'full';
  toolName: string;
  toolInput: Record<string, unknown>;
  toolOutput?: {
    truncated: boolean;
    sizeBytes: number;
    /** First 1024 chars of output for audit review */
    preview: string;
  };
  duration_ms: number;
  success: boolean;
  error?: string;
}
```

Audit logs are stored in the OpenClaw database (existing `audit_logs` table
pattern) and are queryable by admin users for security review.

#### 6.3 Kill Switch

A global kill switch allows operators to instantly revert to ADR-003 behavior
(tools disabled for all users) in case of security incident:

```typescript
interface KillSwitchConfig {
  /** When true, all sessions fall back to 'restricted' tier regardless of user role */
  toolsKillSwitch: boolean;

  /** Reason for activation (displayed in admin panel) */
  killSwitchReason?: string;

  /** ISO timestamp of activation */
  killSwitchActivatedAt?: string;

  /** Admin user who activated the kill switch */
  killSwitchActivatedBy?: string;
}
```

**Activation:**
```bash
# Via OpenClaw admin API
curl -X POST http://localhost:3000/admin/kill-switch/tools \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": true, "reason": "Investigating CVE-2026-XXXX"}'
```

When the kill switch is active, `resolveAccessTier()` always returns
`{ tier: 'restricted', resolvedBy: 'kill-switch' }`.

### 7. Cloud.ru AI Fabric Multi-Agent Integration

Cloud.ru AI Agents are accessible via an OpenAI-compatible chat completions API.
When tools are enabled, Claude Code can orchestrate calls to Cloud.ru-hosted
agents as MCP tools, enabling multi-agent workflows.

```typescript
/**
 * Configuration for a Cloud.ru AI Fabric agent exposed as an MCP tool.
 */
interface CloudruAgentAsMCPTool {
  /** Cloud.ru agent ID */
  agentId: string;

  /** Display name for the tool */
  toolName: string;

  /** Description shown to Claude Code for tool selection */
  description: string;

  /** Cloud.ru agent endpoint */
  endpoint: string;

  /** Authentication for Cloud.ru agent API */
  auth: {
    type: 'api-key' | 'iam-token';
    tokenEnvVar: string;
  };

  /** Input schema (maps to function calling parameters) */
  inputSchema: Record<string, unknown>;

  /** Minimum tier required */
  minimumTier: 'standard' | 'full';
}
```

**Example: RAG Agent as MCP Tool:**

```json
{
  "agentId": "agent-rag-corporate-kb",
  "toolName": "search_corporate_knowledge",
  "description": "Search the corporate knowledge base using Cloud.ru Managed RAG",
  "endpoint": "https://agents.api.cloud.ru/v1/agents/agent-rag-corporate-kb/chat/completions",
  "auth": {
    "type": "api-key",
    "tokenEnvVar": "CLOUDRU_AGENT_API_KEY"
  },
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Search query" }
    },
    "required": ["query"]
  },
  "minimumTier": "standard"
}
```

### 8. Migration Path from ADR-003

The migration is backward-compatible. Existing deployments that do not configure
tool access tiers will continue to operate with `restricted` tier (ADR-003
behavior preserved).

**Phase 1 -- Restricted by default (backward-compatible):**
- Implement `resolveAccessTier()` with default returning `restricted`.
- Replace hardcoded injection with `buildToolAccessDirective()`.
- Deploy. No behavioral change for existing users.

**Phase 2 -- Standard tier for authenticated users:**
- Enable MCP server configuration in OpenClaw admin.
- Register Cloud.ru MCP Registry servers.
- Deploy workspace isolation (Docker per-user directories).
- Switch `defaultAuthenticatedTier` to `standard`.

**Phase 3 -- Full tier for trusted users:**
- Implement admin UI for tier assignment.
- Deploy gVisor/Docker sandboxing for Full tier.
- Enable audit logging and kill switch.
- Gradually grant Full tier to trusted users.

## Consequences

### Positive

- **Full agentic capabilities available** -- Claude Code can use its complete
  tool-calling architecture (file ops, bash, MCP) for users at appropriate tiers.
- **Cloud.ru MCP Registry integration** -- Managed RAG, PostgreSQL, S3, Web Search,
  and other Cloud.ru MCP servers become first-class tools in OpenClaw.
- **Multi-agent orchestration** -- Cloud.ru AI Fabric agents can be invoked as
  tools from within Claude Code sessions.
- **Backward-compatible** -- Default behavior is `restricted` (same as ADR-003),
  requiring explicit opt-in for tool enablement.
- **Self-hosted flexibility** -- Self-hosted instances default to `full` tier,
  giving operators complete control of their own infrastructure.
- **Security-auditable** -- Every tool invocation is logged with user, tier,
  input, and output metadata.

### Negative

- **Security complexity increases** -- Three tiers of access require three sets
  of security testing, sandbox validation, and ongoing monitoring.
- **Infrastructure overhead** -- Per-user workspace isolation requires Docker
  container orchestration or gVisor sandboxing at the host level.
- **MCP config management** -- Temporary JSON config files are created per session
  for `--mcp-config`, requiring cleanup on session end.
- **Tier resolution adds latency** -- Resolving user role, API key scopes, and
  instance config adds 5-15ms to session creation.

### Risks

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|-----------|
| Sandbox escape (container breakout) | Low | Critical | gVisor; regular security patches; penetration testing |
| MCP server returns malicious payload | Medium | High | Response size limits; output sanitization; audit logging |
| Resource exhaustion from tool abuse | Medium | Medium | Per-user quotas (`ResourceQuota`); wall-time limits |
| Kill switch false positive (tools disabled unnecessarily) | Low | Medium | Admin notification; time-limited activation; manual review |
| Tier misconfiguration grants excessive access | Low | High | Tier resolution unit tests; integration tests per tier |
| Cross-user workspace leakage | Low | Critical | Uid isolation in Docker; automated security scanning of workspace paths |

## Invariants (DDD)

1. **Tier Before Execution** -- Tool access tier MUST be resolved before any tool
   execution begins. A `ToolExecutionContext` without a resolved tier is invalid.

2. **Sandbox Immutability** -- The `SandboxConfig` attached to a subprocess MUST
   NOT change after the subprocess is spawned. Tier escalation requires a new
   session.

3. **Sandbox Violation Terminates** -- Any sandbox violation (filesystem escape,
   network violation, resource limit exceeded) MUST immediately terminate the
   Claude Code subprocess and log a security event.

4. **MCP Fault Isolation** -- MCP server failures (timeout, error, crash) MUST
   NOT propagate to other users' sessions. Each MCP binding is scoped to a
   single `ToolExecutionContext`.

5. **Allowlist Enforcement** -- Tool access is deny-by-default. Only tools
   explicitly listed in `AllowedTools` for the resolved tier may execute.
   Unknown tool names MUST be rejected.

6. **Audit Completeness** -- Every tool invocation (success or failure) MUST
   produce an `ToolAuditEntry`. Missing audit entries indicate a system fault
   that must trigger an alert.

7. **Kill Switch Supremacy** -- When `toolsKillSwitch` is `true`, ALL sessions
   MUST resolve to `restricted` tier regardless of user role, API key, or
   instance configuration. No exceptions.

## Module Boundary

This decision defines a reusable module boundary:

```
@openclaw/tool-sandbox
  ├── src/
  │   ├── access-tier.ts        # resolveAccessTier(), AccessTierConfig
  │   ├── sandbox-config.ts     # SandboxConfig, SANDBOX_DEFAULTS
  │   ├── mcp-config.ts         # MCPServerConfig, MCPConfigManifest, buildMCPConfig()
  │   ├── tool-directive.ts     # buildToolAccessDirective()
  │   ├── cli-args.ts           # buildClaudeCliArgs()
  │   ├── audit.ts              # ToolAuditEntry, audit logging
  │   ├── kill-switch.ts        # KillSwitchConfig, kill switch logic
  │   ├── rate-limit.ts         # RateLimitConfig, per-user rate limiting
  │   └── workspace.ts          # Per-user workspace creation and cleanup
  ├── tests/
  │   ├── access-tier.test.ts
  │   ├── sandbox-config.test.ts
  │   ├── mcp-config.test.ts
  │   ├── tool-directive.test.ts
  │   ├── cli-args.test.ts
  │   └── kill-switch.test.ts
  └── package.json
```

**Exports:** `resolveAccessTier`, `buildToolAccessDirective`, `buildMCPConfig`,
`buildClaudeCliArgs`, `SandboxConfig`, `MCPServerConfig`, `ToolAuditEntry`,
`KillSwitchConfig`.

**Dependencies:** None (pure TypeScript module). Sandbox enforcement (Docker,
gVisor) is handled by the host infrastructure layer, not by this module.

## References

- `cli-runner.ts:82-83` -- Current tools-disabled injection (ADR-003)
- ADR-001 -- Cloud.ru FM proxy integration architecture
- ADR-003 -- Claude Code as Agentic Execution Engine (superseded tools restriction)
- ADR-004 -- Proxy Lifecycle Management
- ADR-005 -- Model Mapping and Fallback Strategy
- [Cloud.ru AI Agents](https://cloud.ru/docs/evolution-ai-factory/ai-agents) -- Agent creation and configuration
- [Cloud.ru MCP Registry](https://cloud.ru/docs/evolution-ai-factory/mcp-servers) -- Managed MCP servers
- [Model Context Protocol](https://modelcontextprotocol.io/) -- MCP specification
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) -- `--allowed-tools`, `--mcp-config` flags

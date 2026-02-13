# ADR-013: Cloud.ru AI Fabric Agent Integration

## Status: PROPOSED

## Date: 2026-02-13

## Bounded Context: External Agent Integration

## Context

Cloud.ru Evolution AI Factory provides a comprehensive managed AI platform with four
services relevant to OpenClaw:

1. **AI Agents** -- managed agents with auto-scaling (0 to N instances), serverless
   billing, and configurable LLM backends from the Foundation Models catalog.
2. **Agent Systems** -- multi-agent orchestration using A2A (Agent-to-Agent) protocol,
   supporting up to 5 agents per system with planner/worker topology.
3. **Managed MCP Servers** -- platform-hosted MCP servers (web-search, code-exec,
   managed RAG, database connectors) exposed via SSE transport with standard MCP
   JSON-RPC protocol.
4. **Managed RAG** -- document ingestion, chunking, vector + full-text search, and
   knowledge base management accessible through MCP or direct API.

Currently, OpenClaw uses Claude Code CLI as its sole agentic backend (ADR-003). The
CLI connects to Cloud.ru Foundation Models through claude-code-proxy (ADR-001). This
architecture limits OpenClaw to a single execution path: local subprocess spawning.

Integrating Cloud.ru AI Fabric as a first-class agent provider enables:
- Remote managed agents that scale independently of the host machine
- Access to platform-managed MCP servers without local deployment
- Multi-agent workflows that distribute work across Cloud.ru Agent Systems
- Knowledge bases via Managed RAG without operating vector databases

### DDD Aggregate: ExternalAgentRegistry

The `ExternalAgentRegistry` aggregate manages the lifecycle of external agent provider
registrations. Each registration binds a Cloud.ru project + agent to an OpenClaw
agent slot. The aggregate enforces that every registered external agent has valid
credentials, a reachable endpoint, and a declared capability set.

```
ExternalAgentRegistry (Aggregate Root)
  ├── AgentProviderRegistration (Entity)
  │   ├── providerId: string
  │   ├── type: 'local' | 'cloudru-agent' | 'cloudru-system'
  │   ├── credentials: EncryptedCredentials (Value Object)
  │   ├── capabilities: AgentCapability[] (Value Object)
  │   └── healthStatus: HealthStatus (Value Object)
  │
  ├── McpServerRegistration (Entity)
  │   ├── serverId: string
  │   ├── source: 'cloudru-managed' | 'cloudru-marketplace' | 'custom'
  │   ├── transport: 'sse' | 'stdio'
  │   └── tools: ToolDescriptor[] (Value Object)
  │
  └── RagKnowledgeBase (Entity)
      ├── knowledgeBaseId: string
      ├── projectId: string
      └── indexStatus: 'indexing' | 'ready' | 'error'
```

## Decision

### 1. Agent Provider Interface

Define a polymorphic `IAgentProvider` interface that abstracts over execution backends.
Claude Code CLI, Cloud.ru AI Agents, and Cloud.ru Agent Systems all implement this
interface. OpenClaw's agent-runner dispatches to the appropriate provider based on
configuration.

```typescript
// @openclaw/agent-fabric/src/interfaces/agent-provider.ts

/**
 * Identifies the runtime location and management model of an agent.
 * - local: subprocess on the OpenClaw host (e.g., Claude Code CLI)
 * - remote: fully managed on Cloud.ru AI Factory
 * - hybrid: local orchestrator delegating sub-tasks to remote agents
 */
type AgentLocality = 'local' | 'remote' | 'hybrid';

/**
 * Granular capability declaration. Providers advertise what they can do
 * so the orchestrator can route tasks to capable agents.
 */
interface AgentCapability {
  readonly name: string;             // e.g., "code-generation", "rag-search"
  readonly version: string;          // semver
  readonly inputSchema?: JsonSchema; // JSON Schema for accepted input
  readonly outputSchema?: JsonSchema;
  readonly mcpTools?: string[];      // MCP tool names this capability exposes
}

/**
 * Immutable request envelope sent to any agent provider.
 */
interface AgentRequest {
  readonly requestId: string;
  readonly sessionId: string;
  readonly message: string;
  readonly systemPrompt?: string;
  readonly tools?: ToolDefinition[];
  readonly context?: ConversationContext;
  readonly constraints?: AgentConstraints;
}

/**
 * Constraints the orchestrator places on execution.
 */
interface AgentConstraints {
  readonly maxTokens?: number;
  readonly timeoutMs?: number;
  readonly maxToolCalls?: number;
  readonly allowedTools?: string[];
  readonly temperature?: number;
}

/**
 * Structured response from any agent provider.
 */
interface AgentResponse {
  readonly requestId: string;
  readonly providerId: string;
  readonly content: string;
  readonly toolCalls?: ToolCallResult[];
  readonly usage?: TokenUsage;
  readonly metadata?: Record<string, unknown>;
  readonly finishReason: 'stop' | 'tool_use' | 'max_tokens' | 'timeout' | 'error';
}

/**
 * Streaming event emitted by providers that support incremental output.
 */
type AgentEvent =
  | { type: 'content_delta'; delta: string }
  | { type: 'tool_call_start'; toolName: string; callId: string }
  | { type: 'tool_call_result'; callId: string; result: unknown }
  | { type: 'usage'; usage: TokenUsage }
  | { type: 'done'; response: AgentResponse }
  | { type: 'error'; error: AgentError };

/**
 * Core provider contract. Every agent backend implements this interface.
 */
interface IAgentProvider {
  readonly providerId: string;
  readonly type: AgentLocality;

  /** Execute a request and return the full response. */
  execute(request: AgentRequest): Promise<AgentResponse>;

  /** Stream incremental events. Falls back to execute() + single 'done' event. */
  stream(request: AgentRequest): AsyncIterable<AgentEvent>;

  /** Declared capabilities for routing decisions. */
  listCapabilities(): AgentCapability[];

  /** Health check. Returns true if the provider is ready to accept requests. */
  healthCheck(): Promise<boolean>;

  /** Graceful shutdown. Drains in-flight requests. */
  dispose(): Promise<void>;
}
```

### 2. Claude Code CLI as Agent Provider

The existing `runCliAgent()` path (ADR-003) is wrapped in a `ClaudeCodeCliProvider`
that implements `IAgentProvider`. This is a backward-compatible refactor -- existing
behavior is preserved, but the interface becomes polymorphic.

```typescript
// @openclaw/agent-fabric/src/providers/claude-code-cli-provider.ts

class ClaudeCodeCliProvider implements IAgentProvider {
  readonly providerId = 'claude-cli';
  readonly type: AgentLocality = 'local';

  constructor(
    private readonly backendConfig: CliBackendConfig,
    private readonly sessionManager: SessionManager
  ) {}

  async execute(request: AgentRequest): Promise<AgentResponse> {
    // Delegates to existing runCliAgent() in cli-runner.ts
    // Passes ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY from backendConfig.env
    // Uses --session-id for session continuity
    // Returns parsed JSON output as AgentResponse
  }

  async *stream(request: AgentRequest): AsyncIterable<AgentEvent> {
    // Claude Code CLI does not support streaming to the caller (ADR-003).
    // Emit a single 'done' event wrapping the execute() result.
    const response = await this.execute(request);
    yield { type: 'done', response };
  }

  listCapabilities(): AgentCapability[] {
    return [
      {
        name: 'general-reasoning',
        version: '1.0.0',
        mcpTools: [] // Tools disabled per ADR-003
      },
      {
        name: 'code-generation',
        version: '1.0.0'
      }
    ];
  }

  async healthCheck(): Promise<boolean> {
    // Verify proxy is reachable (ADR-004 health check)
    // Verify claude binary exists on PATH
  }

  async dispose(): Promise<void> {
    // Kill any lingering subprocess
  }
}
```

### 3. Cloud.ru AI Agents as Agent Provider

Cloud.ru AI Agents expose an OpenAI-compatible completions API per agent. Each agent
is identified by `{projectId}` and `{agentId}`. OpenClaw wraps this in a
`CloudRuAgentProvider`.

```typescript
// @openclaw/agent-fabric/src/providers/cloudru-agent-provider.ts

interface CloudRuAgentConfig {
  readonly projectId: string;
  readonly agentId: string;
  readonly baseUrl: string;          // https://ai-agents.api.cloud.ru/api/v1
  readonly apiKey: string;           // X-API-Key or Bearer token
  readonly authType: 'api_key' | 'access_key';
  readonly timeoutMs?: number;       // default 120_000
  readonly retryPolicy?: RetryPolicy;
}

/**
 * Agent status values from Cloud.ru API (section 6.8 of research).
 */
type CloudRuAgentStatus =
  | 'UNKNOWN'
  | 'RESOURCE_ALLOCATION'
  | 'PULLING'
  | 'RUNNING'
  | 'ON_SUSPENSION'
  | 'SUSPENDED'
  | 'ON_DELETION'
  | 'DELETED'
  | 'FAILED'
  | 'COOLED'
  | 'LLM_UNAVAILABLE'
  | 'TOOL_UNAVAILABLE'
  | 'IMAGE_UNAVAILABLE';

class CloudRuAgentProvider implements IAgentProvider {
  readonly providerId: string;
  readonly type: AgentLocality = 'remote';
  private httpClient: HttpClient;

  constructor(private readonly config: CloudRuAgentConfig) {
    this.providerId = `cloudru:${config.projectId}:${config.agentId}`;
    this.httpClient = new HttpClient({
      baseUrl: config.baseUrl,
      headers: this.buildAuthHeaders(),
      timeoutMs: config.timeoutMs ?? 120_000
    });
  }

  async execute(request: AgentRequest): Promise<AgentResponse> {
    // POST /{projectId}/agents/{agentId}/completions
    // Body follows OpenAI chat/completions format
    const body = {
      messages: this.buildMessages(request),
      tools: request.tools,
      temperature: request.constraints?.temperature ?? 0.3,
      max_tokens: request.constraints?.maxTokens ?? 4096,
      stream: false
    };

    const raw = await this.httpClient.post<OpenAICompletionResponse>(
      `/${this.config.projectId}/agents/${this.config.agentId}/completions`,
      body
    );

    return this.mapToAgentResponse(request.requestId, raw);
  }

  async *stream(request: AgentRequest): AsyncIterable<AgentEvent> {
    // Same endpoint with stream: true
    // Parse SSE chunks into AgentEvent sequence
    const body = {
      messages: this.buildMessages(request),
      tools: request.tools,
      temperature: request.constraints?.temperature ?? 0.3,
      max_tokens: request.constraints?.maxTokens ?? 4096,
      stream: true
    };

    const sseStream = this.httpClient.postStream(
      `/${this.config.projectId}/agents/${this.config.agentId}/completions`,
      body
    );

    for await (const chunk of sseStream) {
      yield this.mapChunkToEvent(chunk);
    }
  }

  listCapabilities(): AgentCapability[] {
    // Fetched from agent metadata during registration and cached
    return this.cachedCapabilities;
  }

  async healthCheck(): Promise<boolean> {
    // GET /{projectId}/agents/{agentId}
    // Check status === 'RUNNING' || status === 'COOLED'
    // COOLED is healthy -- next request triggers cold start
    const agent = await this.httpClient.get<{ status: CloudRuAgentStatus }>(
      `/${this.config.projectId}/agents/${this.config.agentId}`
    );
    return agent.status === 'RUNNING' || agent.status === 'COOLED';
  }

  async dispose(): Promise<void> {
    // No-op for remote agents; they manage their own lifecycle
  }

  private buildAuthHeaders(): Record<string, string> {
    if (this.config.authType === 'api_key') {
      return { 'X-API-Key': this.config.apiKey };
    }
    return { 'Authorization': `Bearer ${this.config.apiKey}` };
  }
}
```

### 4. Hybrid Orchestration (Claude Code + Cloud.ru Agents)

The `HybridOrchestrator` composes multiple `IAgentProvider` instances. It routes
sub-tasks to the provider best suited by capability, locality, and cost constraints.

```typescript
// @openclaw/agent-fabric/src/orchestration/hybrid-orchestrator.ts

interface RoutingRule {
  readonly capabilityPattern: string;  // glob, e.g. "code-*"
  readonly preferredProvider: string;  // providerId
  readonly fallbackProviders: string[];
  readonly maxConcurrency?: number;
}

interface OrchestratorConfig {
  readonly providers: IAgentProvider[];
  readonly routingRules: RoutingRule[];
  readonly defaultProvider: string;
  readonly circuitBreaker: CircuitBreakerConfig;
}

class HybridOrchestrator {
  private providers: Map<string, IAgentProvider>;
  private circuitBreakers: Map<string, CircuitBreaker>;

  constructor(private readonly config: OrchestratorConfig) {
    this.providers = new Map(
      config.providers.map(p => [p.providerId, p])
    );
    this.circuitBreakers = new Map(
      config.providers.map(p => [
        p.providerId,
        new CircuitBreaker(config.circuitBreaker)
      ])
    );
  }

  /**
   * Route a request to the best available provider.
   * Selection criteria (in priority order):
   * 1. Explicit routing rule matching required capability
   * 2. Provider health (circuit breaker open = skip)
   * 3. Locality preference (local for file ops, remote for heavy compute)
   * 4. Default provider
   */
  async execute(request: AgentRequest): Promise<AgentResponse> {
    const provider = this.selectProvider(request);
    const breaker = this.circuitBreakers.get(provider.providerId)!;

    return breaker.execute(async () => {
      return provider.execute(request);
    });
  }

  /**
   * Fan-out a compound task to multiple providers in parallel.
   * Used by Cloud.ru Agent Systems integration where planner
   * decomposes and distributes work.
   */
  async fanOut(
    subtasks: AgentRequest[]
  ): Promise<Map<string, AgentResponse>> {
    const results = new Map<string, AgentResponse>();

    const settled = await Promise.allSettled(
      subtasks.map(async (subtask) => {
        const provider = this.selectProvider(subtask);
        const response = await provider.execute(subtask);
        return { requestId: subtask.requestId, response };
      })
    );

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.set(result.value.requestId, result.value.response);
      }
    }

    return results;
  }
}
```

### 5. Cloud.ru Agent Systems Integration

Cloud.ru Agent Systems provide managed multi-agent orchestration with up to 5 agents
per system. OpenClaw can either:
(a) Create and manage Agent Systems via API, or
(b) Register an existing Agent System as an `IAgentProvider`.

```typescript
// @openclaw/agent-fabric/src/providers/cloudru-agent-system-provider.ts

interface AgentSystemConfig {
  readonly projectId: string;
  readonly agentSystemId: string;
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly authType: 'api_key' | 'access_key';
}

interface AgentSystemMember {
  readonly agentId: string;
  readonly role: string;
  readonly weight: number;
}

/**
 * Status values for Agent Systems (section 6.9 of research).
 */
type CloudRuAgentSystemStatus =
  | 'UNKNOWN'
  | 'RESOURCE_ALLOCATION'
  | 'PULLING'
  | 'RUNNING'
  | 'ON_SUSPENSION'
  | 'SUSPENDED'
  | 'ON_DELETION'
  | 'DELETED'
  | 'FAILED'
  | 'COOLED'
  | 'AGENT_UNAVAILABLE';

class CloudRuAgentSystemProvider implements IAgentProvider {
  readonly type: AgentLocality = 'remote';
  readonly providerId: string;

  constructor(private readonly config: AgentSystemConfig) {
    this.providerId = `cloudru-system:${config.projectId}:${config.agentSystemId}`;
  }

  async execute(request: AgentRequest): Promise<AgentResponse> {
    // POST /{projectId}/agentSystems/{agentSystemId}/completions
    // The Agent System internally routes to its member agents
    // via its configured orchestrator (router, planner, etc.)
  }

  async *stream(request: AgentRequest): AsyncIterable<AgentEvent> {
    // SSE streaming from Agent System endpoint
  }

  listCapabilities(): AgentCapability[] {
    // Union of all member agent capabilities
  }

  async healthCheck(): Promise<boolean> {
    // GET /{projectId}/agentSystems/{agentSystemId}
    // status === 'RUNNING' || status === 'COOLED'
  }

  async dispose(): Promise<void> {}
}
```

### 6. MCP Server Federation

OpenClaw federates MCP servers from three sources into a single tool registry:

1. **Cloud.ru Managed MCP Servers** -- platform-hosted, accessed via SSE transport
2. **Cloud.ru Marketplace MCP Servers** -- community/vendor servers from catalog
3. **Custom MCP Servers** -- user-registered, any transport (SSE, stdio)

All federated tools are available to any `IAgentProvider` that supports tool calling.

```typescript
// @openclaw/agent-fabric/src/mcp/mcp-federation.ts

/**
 * Source classification for MCP servers.
 */
type McpServerSource = 'cloudru-managed' | 'cloudru-marketplace' | 'custom';

/**
 * Transport configuration for connecting to an MCP server.
 */
type McpTransportConfig =
  | { type: 'sse'; url: string; headers?: Record<string, string> }
  | { type: 'stdio'; command: string; args?: string[]; env?: Record<string, string> };

/**
 * Registration entry for a federated MCP server.
 */
interface McpServerRegistration {
  readonly serverId: string;
  readonly name: string;
  readonly source: McpServerSource;
  readonly transport: McpTransportConfig;
  readonly tools: McpToolDescriptor[];
  readonly status: 'connected' | 'disconnected' | 'error';
}

/**
 * Tool descriptor as reported by the MCP server's tools/list response.
 */
interface McpToolDescriptor {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
}

/**
 * Federates MCP servers from multiple sources into a unified tool registry.
 * Handles tool name collisions by prefixing with server name.
 */
class McpFederation {
  private servers: Map<string, McpServerRegistration> = new Map();
  private toolIndex: Map<string, { serverId: string; tool: McpToolDescriptor }> = new Map();

  /**
   * Register Cloud.ru managed MCP servers discovered via API.
   * GET /{projectId}/mcpServers returns the list.
   */
  async registerCloudRuServers(
    projectId: string,
    apiClient: CloudRuApiClient
  ): Promise<void> {
    const response = await apiClient.get<{ mcpServers: CloudRuMcpServer[] }>(
      `/${projectId}/mcpServers`
    );

    for (const server of response.mcpServers) {
      if (server.status !== 'RUNNING' && server.status !== 'AVAILABLE') {
        continue; // Skip servers that are not ready
      }

      const registration: McpServerRegistration = {
        serverId: server.id,
        name: server.name,
        source: 'cloudru-managed',
        transport: {
          type: 'sse',
          url: `https://ai-agents.api.cloud.ru/mcp/${server.id}`,
          headers: { 'Authorization': `Bearer ${apiClient.token}` }
        },
        tools: server.tools.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema ?? { type: 'object' }
        })),
        status: 'connected'
      };

      this.servers.set(server.id, registration);
      this.indexTools(registration);
    }
  }

  /**
   * Register a custom MCP server from user configuration.
   * Used for claude-code CLAUDE.md mcpServers entries.
   */
  registerCustomServer(
    serverId: string,
    name: string,
    transport: McpTransportConfig,
    tools: McpToolDescriptor[]
  ): void {
    const registration: McpServerRegistration = {
      serverId,
      name,
      source: 'custom',
      transport,
      tools,
      status: 'connected'
    };
    this.servers.set(serverId, registration);
    this.indexTools(registration);
  }

  /**
   * Resolve a tool name to its MCP server and execute the call.
   * Handles namespaced tool names (e.g., "cloudru-rag:search_documents").
   */
  async callTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const entry = this.toolIndex.get(toolName);
    if (!entry) {
      throw new ToolNotFoundError(toolName, Array.from(this.toolIndex.keys()));
    }

    const server = this.servers.get(entry.serverId)!;
    // Dispatch via MCP JSON-RPC: tools/call
    return this.dispatchToolCall(server, entry.tool.name, args);
  }

  /**
   * Return all available tools across all federated servers.
   * Used by agent providers to populate their tool definitions.
   */
  listAllTools(): McpToolDescriptor[] {
    return Array.from(this.toolIndex.values()).map(e => e.tool);
  }

  private indexTools(registration: McpServerRegistration): void {
    for (const tool of registration.tools) {
      const namespacedName = `${registration.name}:${tool.name}`;
      // Prefer unnamespaced if no collision
      if (!this.toolIndex.has(tool.name)) {
        this.toolIndex.set(tool.name, {
          serverId: registration.serverId,
          tool
        });
      }
      // Always register namespaced variant
      this.toolIndex.set(namespacedName, {
        serverId: registration.serverId,
        tool
      });
    }
  }
}
```

### 7. Cloud.ru Managed RAG Integration

Managed RAG knowledge bases are exposed through MCP servers on Cloud.ru. OpenClaw
treats them as a specialized MCP tool source, but also provides a direct API client
for knowledge base management (CRUD on documents, indexing status).

```typescript
// @openclaw/agent-fabric/src/rag/cloudru-rag-client.ts

interface KnowledgeBase {
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly documentCount: number;
  readonly indexStatus: 'indexing' | 'ready' | 'error';
  readonly createdAt: string;
}

interface RagSearchRequest {
  readonly query: string;
  readonly knowledgeBaseId: string;
  readonly topK?: number;            // default 5
  readonly scoreThreshold?: number;  // default 0.7
  readonly filters?: Record<string, unknown>;
}

interface RagSearchResult {
  readonly documentId: string;
  readonly chunk: string;
  readonly score: number;
  readonly metadata: Record<string, unknown>;
}

interface ICloudRuRagClient {
  listKnowledgeBases(projectId: string): Promise<KnowledgeBase[]>;
  searchKnowledgeBase(request: RagSearchRequest): Promise<RagSearchResult[]>;
  getIndexStatus(knowledgeBaseId: string): Promise<KnowledgeBase>;
}
```

### 8. Configuration Schema

OpenClaw config (`openclaw.json`) is extended with an `agentFabric` section.

```typescript
// @openclaw/agent-fabric/src/config/agent-fabric-config.ts

interface AgentFabricConfig {
  /** Cloud.ru project credentials and endpoints. */
  cloudru?: {
    projectId: string;
    baseUrl: string;                // https://ai-agents.api.cloud.ru/api/v1
    authType: 'api_key' | 'access_key';
    // API key is read from env: CLOUDRU_AGENTS_API_KEY (never in config file)
  };

  /** Registered agent providers beyond the default claude-cli. */
  providers?: {
    [providerId: string]: {
      type: 'cloudru-agent' | 'cloudru-system';
      agentId?: string;             // for cloudru-agent
      agentSystemId?: string;       // for cloudru-system
      capabilities?: string[];      // capability names for routing
    };
  };

  /** MCP server federation configuration. */
  mcpFederation?: {
    /** Auto-discover Cloud.ru managed MCP servers on startup. */
    autoDiscoverCloudRu: boolean;   // default true when cloudru configured
    /** Additional custom MCP servers. */
    customServers?: {
      [serverId: string]: {
        url?: string;
        command?: string;
        args?: string[];
        transport: 'sse' | 'stdio';
        headers?: Record<string, string>;
      };
    };
  };

  /** Routing rules for hybrid orchestration. */
  routing?: {
    rules: Array<{
      capability: string;           // glob pattern
      provider: string;             // providerId
      fallback?: string[];          // fallback providerIds
    }>;
    defaultProvider: string;        // default 'claude-cli'
  };

  /** RAG knowledge base bindings. */
  rag?: {
    knowledgeBases?: Array<{
      id: string;
      name: string;
      useAsMcpTool: boolean;        // expose as MCP tool for agents
    }>;
  };
}
```

Example `openclaw.json` addition:

```json
{
  "agentFabric": {
    "cloudru": {
      "projectId": "proj-abc-123",
      "baseUrl": "https://ai-agents.api.cloud.ru/api/v1",
      "authType": "api_key"
    },
    "providers": {
      "cloudru-coder": {
        "type": "cloudru-agent",
        "agentId": "agent-coder-001",
        "capabilities": ["code-generation", "code-review"]
      },
      "cloudru-research-team": {
        "type": "cloudru-system",
        "agentSystemId": "system-research-001",
        "capabilities": ["research", "rag-search", "summarization"]
      }
    },
    "mcpFederation": {
      "autoDiscoverCloudRu": true,
      "customServers": {
        "local-git": {
          "command": "mcp-server-git",
          "args": ["--repo", "."],
          "transport": "stdio"
        }
      }
    },
    "routing": {
      "rules": [
        {
          "capability": "code-*",
          "provider": "cloudru-coder",
          "fallback": ["claude-cli"]
        },
        {
          "capability": "research",
          "provider": "cloudru-research-team"
        }
      ],
      "defaultProvider": "claude-cli"
    },
    "rag": {
      "knowledgeBases": [
        {
          "id": "kb-docs-001",
          "name": "Product Documentation",
          "useAsMcpTool": true
        }
      ]
    }
  }
}
```

### 9. Startup Sequence

```
OpenClaw boot
  │
  ├── 1. Load agentFabric config from openclaw.json
  │
  ├── 2. Initialize ClaudeCodeCliProvider (always, per ADR-003)
  │      └── Verify proxy health (ADR-004)
  │
  ├── 3. If cloudru configured:
  │      ├── Authenticate with Cloud.ru API
  │      ├── For each provider in config:
  │      │   ├── Fetch agent/system metadata
  │      │   ├── Validate status === RUNNING | COOLED
  │      │   ├── Cache capabilities
  │      │   └── Register as IAgentProvider
  │      │
  │      ├── If mcpFederation.autoDiscoverCloudRu:
  │      │   ├── GET /{projectId}/mcpServers
  │      │   ├── Filter by status RUNNING | AVAILABLE
  │      │   └── Register tools in McpFederation
  │      │
  │      └── If rag.knowledgeBases defined:
  │          ├── Verify each KB index status
  │          └── If useAsMcpTool, register as MCP tool
  │
  ├── 4. Register custom MCP servers from mcpFederation.customServers
  │
  ├── 5. Build HybridOrchestrator with all providers + routing rules
  │
  └── 6. Ready to accept requests
```

## Consequences

### Positive

- **Multi-backend support**: OpenClaw can route to Cloud.ru managed agents without
  abandoning the Claude Code CLI path. Existing behavior is preserved.
- **Elastic scaling**: Cloud.ru AI Agents auto-scale from 0 to N instances. OpenClaw
  does not need to manage compute resources for remote agents.
- **Tool enrichment**: Cloud.ru managed MCP servers (RAG, web-search, code-exec)
  expand the tool set available to all agent providers without local deployment.
- **Cost optimization**: Serverless Cloud.ru agents (minInstances=0) incur zero cost
  when idle. Combined with GLM-4.7-Flash free tier (ADR-005), the base cost is zero.
- **Russian sovereignty**: All Cloud.ru services store and process data within the
  Russian Federation, satisfying FZ-152 and FSTEC requirements.
- **Gradual adoption**: Teams can start with Claude Code CLI only and progressively
  add Cloud.ru providers as needed. The routing config is additive.

### Negative

- **Network dependency**: Remote providers require network connectivity to Cloud.ru
  API. Outages degrade to local-only execution.
- **Cold start latency**: Serverless Cloud.ru agents (minInstances=0) incur 10-30s
  cold start on the first request after idle timeout.
- **API maturity**: Cloud.ru AI Agents API and A2A implementation are platform-specific
  and lack detailed public documentation for some endpoints (MCP server configuration,
  Agent System completions). Integration may require iterative discovery.
- **Complexity**: The provider abstraction, routing rules, and MCP federation add
  architectural surface area. Teams must understand routing config to debug issues.
- **Rate limits**: Cloud.ru Foundation Models enforce 15 req/s per API key. Agent
  Systems with multiple concurrent sub-tasks may hit this limit.

### Risks

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|------------|
| Cloud.ru API breaking changes | Low | High | Pin API version, adapter layer isolates changes |
| MCP server unavailability | Medium | Medium | McpFederation marks servers disconnected, tools degrade gracefully |
| Cold start exceeds user timeout | Medium | Medium | Keep minInstances=1 for latency-sensitive agents |
| API key leak in config | Low | Critical | Keys read from env vars only, never stored in openclaw.json |
| Tool name collisions across MCP servers | Medium | Low | Namespaced tool names (`server:tool`) as fallback |
| Cloud.ru A2A protocol incompatible with standard A2A | High | Low | Wrap in adapter; do not depend on protocol interop |

### Invariants (DDD)

1. **Provider Identity Uniqueness**: Every registered `IAgentProvider` must have a
   globally unique `providerId`. Enforced by `ExternalAgentRegistry.register()`.
2. **Credential Isolation**: API keys for Cloud.ru are never stored in `openclaw.json`.
   They are always read from environment variables (`CLOUDRU_AGENTS_API_KEY`). This
   invariant is enforced at config load time with a validation check.
3. **Default Provider Required**: The `routing.defaultProvider` must reference a
   registered provider. If it is absent, OpenClaw falls back to `claude-cli`.
4. **Health Before Route**: The orchestrator never routes to a provider whose circuit
   breaker is open. A provider transitions to open after 3 consecutive failures.
5. **MCP Tool Resolution**: A tool call must resolve to exactly one MCP server. If
   ambiguous (collision), the namespaced variant is required.

### Domain Events

| Event | Trigger | Side Effect |
|-------|---------|-------------|
| `AgentProviderRegistered` | Provider passes health check on startup | Added to routing table |
| `AgentProviderHealthDegraded` | 3 consecutive health check failures | Circuit breaker opens, routed to fallback |
| `AgentProviderRecovered` | Health check succeeds after degradation | Circuit breaker closes, re-added to routing |
| `McpServerDiscovered` | Auto-discovery finds new Cloud.ru MCP server | Tools indexed in McpFederation |
| `McpServerDisconnected` | MCP server becomes unreachable | Tools removed from index, log warning |
| `KnowledgeBaseReady` | RAG KB status transitions to 'ready' | MCP tool registered if useAsMcpTool=true |
| `RoutingRuleMatched` | Orchestrator selects provider for request | Logged for observability (provider, capability, latency) |

## Module Boundary: `@openclaw/agent-fabric`

```
@openclaw/agent-fabric/
  ├── src/
  │   ├── interfaces/
  │   │   ├── agent-provider.ts      # IAgentProvider, AgentRequest, AgentResponse, AgentEvent
  │   │   ├── agent-capability.ts    # AgentCapability, AgentConstraints
  │   │   └── types.ts               # Shared value objects (TokenUsage, ToolCallResult, etc.)
  │   │
  │   ├── providers/
  │   │   ├── claude-code-cli-provider.ts    # ClaudeCodeCliProvider (wraps existing cli-runner.ts)
  │   │   ├── cloudru-agent-provider.ts      # CloudRuAgentProvider (single Cloud.ru agent)
  │   │   └── cloudru-agent-system-provider.ts  # CloudRuAgentSystemProvider (multi-agent system)
  │   │
  │   ├── orchestration/
  │   │   ├── hybrid-orchestrator.ts         # HybridOrchestrator (routing + fan-out)
  │   │   ├── circuit-breaker.ts             # CircuitBreaker per provider
  │   │   └── routing-rules.ts               # RoutingRule matching logic
  │   │
  │   ├── mcp/
  │   │   ├── mcp-federation.ts              # McpFederation (tool registry + dispatch)
  │   │   ├── cloudru-mcp-discovery.ts       # Auto-discovery of Cloud.ru managed MCP servers
  │   │   └── mcp-transport-adapter.ts       # SSE and stdio transport adapters
  │   │
  │   ├── rag/
  │   │   └── cloudru-rag-client.ts          # ICloudRuRagClient (KB management + search)
  │   │
  │   ├── config/
  │   │   ├── agent-fabric-config.ts         # AgentFabricConfig type definition
  │   │   └── config-validator.ts            # Validates config at load time (credential isolation, etc.)
  │   │
  │   ├── registry/
  │   │   └── external-agent-registry.ts     # ExternalAgentRegistry aggregate root
  │   │
  │   └── index.ts                           # Public API barrel export
  │
  └── tests/
      ├── providers/
      │   ├── claude-code-cli-provider.test.ts
      │   ├── cloudru-agent-provider.test.ts
      │   └── cloudru-agent-system-provider.test.ts
      ├── orchestration/
      │   ├── hybrid-orchestrator.test.ts
      │   └── circuit-breaker.test.ts
      ├── mcp/
      │   ├── mcp-federation.test.ts
      │   └── cloudru-mcp-discovery.test.ts
      └── config/
          └── config-validator.test.ts
```

### Integration Points with Existing OpenClaw Code

| OpenClaw Module | Integration | Direction |
|----------------|-------------|-----------|
| `agent-runner.ts` | Calls `HybridOrchestrator.execute()` instead of direct `runCliAgent()` | Inbound |
| `cli-backends.ts` | Config consumed by `ClaudeCodeCliProvider` constructor | Read |
| `cli-runner.ts` | Delegated to by `ClaudeCodeCliProvider.execute()` | Outbound |
| `configure.gateway-auth.ts` | Extended with `agentFabric` config wizard step | Write |
| `openclaw.json` | Extended with `agentFabric` section per Configuration Schema above | Read/Write |

## Alternatives Considered

1. **Cloud.ru AI Agents as sole backend (replace Claude Code CLI)**: Rejected because
   Claude Code CLI provides unique capabilities (session persistence, CLAUDE.md
   injection, multi-step reasoning pipeline) that Cloud.ru agents do not replicate.
   The hybrid approach preserves both.

2. **Standard A2A protocol for Cloud.ru Agent Systems**: Rejected because Cloud.ru's
   A2A implementation is platform-specific and not compatible with the Google/Linux
   Foundation A2A specification. Wrapping in an adapter is simpler than forcing
   protocol alignment.

3. **Direct Foundation Models API calls (bypass AI Agents service)**: Already
   implemented via claude-code-proxy (ADR-001). AI Agents add managed tool calling,
   MCP integration, and auto-scaling that direct API calls do not provide.

## References

- ADR-001: Cloud.ru FM Integration via Claude Code Proxy
- ADR-003: Claude Code as Agentic Execution Engine
- ADR-004: Proxy Lifecycle Management
- ADR-005: Model Mapping and Fallback Strategy
- `docs/research/cloudru-ai-agents-integration.md` -- Cloud.ru AI Agents research
- `docs/research/integration-architecture-overview.md` -- Integration architecture
- `docs/cloud-ru-ai-fabric-research.md` -- Cloud.ru AI Fabric research
- [Cloud.ru AI Agents](https://cloud.ru/products/evolution-ai-agents)
- [Cloud.ru Foundation Models](https://cloud.ru/products/evolution-foundation-models)
- [Cloud.ru Evolution AI Factory](https://cloud.ru/products/evolution-ai-factory)
- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/)

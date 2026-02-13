# ADR-012: Modular Plugin Architecture

## Status: PROPOSED

## Date: 2026-02-13

## Bounded Context: System Composition

## Context

OpenClaw is evolving from a monolithic Telegram bot into a platform for AI-agent
orchestration across multiple messengers, LLM providers, and deployment targets.
The integration research (MAX Messenger, Cloud.ru AI Fabric, Foundation Models)
has identified eight distinct functional areas that must be independently
deployable, testable, and reusable in other IT applications beyond OpenClaw itself.

Each bounded context identified in ADRs 001-005 (Proxy Management, Wizard
Configuration, Agent Execution, Model Routing) and the three new integration
domains (Messenger Adapters, AI Fabric Agents, Training Engine) must become
an independent npm package that can be:

1. Used standalone in a third-party Node.js application
2. Composed together into the full OpenClaw system
3. Replaced or extended without modifying other modules
4. Versioned and released independently

### Forces

- The system currently has tight coupling between messenger handling, LLM routing,
  and agent execution, making it difficult to reuse parts independently
- Cloud.ru AI Fabric integration (ADR pending) requires a cleanly abstracted
  agent interface that does not leak OpenClaw-specific assumptions
- MAX Messenger integration requires an adapter layer that can be used by any
  Node.js bot, not just OpenClaw
- Multi-tenant SaaS deployment requires strict isolation boundaries that map
  naturally to module boundaries
- Third-party developers need stable, documented interfaces to build on
- The worker pool (Claude Code CLI subprocess management) is useful beyond
  OpenClaw for any application that needs concurrent CLI agent execution

### DDD Bounded Context Map

```
+---------------------+          +---------------------+
|  Messenger Adapters |          |  Stream Pipeline    |
|  @openclaw/         |          |  @openclaw/         |
|  messenger-adapters |          |  stream-pipeline    |
|                     |          |                     |
|  Telegram, MAX, Web |          |  SSE, WebSocket,    |
|                     |          |  chunked transfer   |
+--------+------------+          +----------+----------+
         |                                  |
         | Conformist                       | Shared Kernel
         | (adapts to each                  | (streaming protocol)
         |  messenger API)                  |
         v                                  v
+--------+------------------------------------------+----------+
|                    OpenClaw Core                              |
|              (Composition Root / Anti-Corruption Layer)       |
+---+----------+----------+----------+----------+---------+----+
    |          |          |          |          |         |
    v          v          v          v          v         v
+-------+ +-------+ +--------+ +--------+ +-------+ +--------+
| LLM   | | Tool  | | Tenant | | Worker | |Training| | Agent |
| Router| | Sand- | | Manager| | Pool   | | Engine | | Fabric|
|       | | box   | |        | |        | |        | |       |
+-------+ +-------+ +--------+ +--------+ +-------+ +--------+

Relationship Types:
  Messenger Adapters -> Core:     Conformist (adapts to external APIs)
  LLM Router        -> Core:     Customer-Supplier (core requests, router supplies)
  Tool Sandbox      -> Core:     Published Language (permission protocol)
  Tenant Manager    -> Core:     Shared Kernel (tenant context propagated everywhere)
  Worker Pool       -> Core:     Open Host Service (generic subprocess management)
  Stream Pipeline   -> Core:     Shared Kernel (streaming protocol)
  Training Engine   -> Core:     Customer-Supplier (core requests training data)
  Agent Fabric      -> Core:     Anti-Corruption Layer (wraps Cloud.ru A2A protocol)
```

## Decision

Decompose the system into eight independent npm packages under the `@openclaw`
scope. Each package exposes a typed interface, declares its dependencies
explicitly, and can be instantiated standalone or wired together through a
dependency injection container at the composition root.

### Module Registry

The central registry enables dynamic plugin discovery and lifecycle management.
All modules register themselves on application startup; third-party plugins
can register at runtime.

```typescript
// @openclaw/core/registry.ts

interface PluginRegistry {
  /** Register a plugin with the registry. Throws if id already registered. */
  register<T>(id: string, plugin: Plugin<T>): void;

  /** Resolve a registered plugin by id. Throws if not found. */
  resolve<T>(id: string): T;

  /** Check if a plugin is registered. */
  has(id: string): boolean;

  /** List all registered plugin descriptors. */
  list(): PluginDescriptor[];

  /** Unregister a plugin. Returns true if it existed. */
  unregister(id: string): boolean;

  /** Run health checks on all registered plugins. */
  healthCheck(): Promise<Map<string, HealthStatus>>;
}

interface Plugin<T> {
  /** Unique identifier, e.g. "@openclaw/llm-router" */
  id: string;

  /** SemVer version string */
  version: string;

  /** List of plugin ids this plugin depends on */
  dependencies: string[];

  /** Factory function that receives resolved dependencies and returns the module instance */
  factory: (deps: DependencyContainer) => T;

  /** Optional async health check */
  healthCheck?: () => Promise<HealthStatus>;

  /** Optional cleanup on shutdown */
  dispose?: () => Promise<void>;

  /** Optional metadata for discovery */
  metadata?: PluginMetadata;
}

interface PluginDescriptor {
  id: string;
  version: string;
  dependencies: string[];
  healthy: boolean;
  metadata?: PluginMetadata;
}

interface PluginMetadata {
  name: string;
  description: string;
  author: string;
  license: string;
  tags: string[];
}

type HealthStatus =
  | { status: "healthy" }
  | { status: "degraded"; reason: string }
  | { status: "unhealthy"; reason: string };
```

### Dependency Injection Container

Each module declares what it needs; the container resolves dependencies
topologically at startup. Circular dependencies are detected and rejected.

```typescript
// @openclaw/core/container.ts

interface DependencyContainer {
  /** Get a registered service by token. */
  get<T>(token: string): T;

  /** Check if a service is registered. */
  has(token: string): boolean;

  /** Register a value directly. */
  set<T>(token: string, value: T): void;

  /** Create a child scope (for per-request or per-tenant isolation). */
  createScope(scopeId: string): DependencyContainer;

  /** Dispose the scope and all its scoped services. */
  dispose(): Promise<void>;
}

/** Lifecycle management for DI registrations */
enum ServiceLifetime {
  /** One instance for the entire application */
  Singleton = "singleton",

  /** One instance per scope (e.g., per tenant, per request) */
  Scoped = "scoped",

  /** New instance on every resolve */
  Transient = "transient",
}

interface ServiceRegistration<T> {
  token: string;
  factory: (container: DependencyContainer) => T;
  lifetime: ServiceLifetime;
  dispose?: (instance: T) => Promise<void>;
}

class OpenClawContainer implements DependencyContainer {
  private registrations: Map<string, ServiceRegistration<unknown>>;
  private singletons: Map<string, unknown>;
  private scopeId: string;
  private parent?: OpenClawContainer;

  constructor(scopeId?: string, parent?: OpenClawContainer);

  get<T>(token: string): T;
  has(token: string): boolean;
  set<T>(token: string, value: T): void;
  createScope(scopeId: string): DependencyContainer;
  dispose(): Promise<void>;

  /** Register a service with lifecycle management. */
  register<T>(registration: ServiceRegistration<T>): void;

  /** Build: validate all dependencies and freeze the container. */
  build(): void;
}
```

### Module Interface Contracts

Each of the eight modules exposes a primary interface. These interfaces are the
contracts between modules -- they are versioned and must follow semantic
versioning. Breaking changes require a major version bump.

#### 1. Messenger Adapters Interface

```typescript
// @openclaw/messenger-adapters/types.ts

/** Normalized message from any messenger */
interface IncomingMessage {
  id: string;
  source: MessengerSource;
  chatId: string;
  userId: string;
  text: string;
  attachments: Attachment[];
  replyTo?: string;
  timestamp: Date;
  raw: unknown; // Original messenger payload
}

/** Normalized outgoing message */
interface OutgoingMessage {
  chatId: string;
  text: string;
  format?: "text" | "markdown" | "html";
  attachments?: Attachment[];
  replyTo?: string;
  keyboard?: InlineKeyboard;
}

interface Attachment {
  type: "image" | "file" | "audio" | "video" | "sticker";
  url?: string;
  buffer?: Buffer;
  mimeType: string;
  filename?: string;
}

type MessengerSource = "telegram" | "max" | "web" | "api";

interface MessengerAdapter {
  readonly source: MessengerSource;

  /** Start receiving messages (webhook or polling) */
  start(config: AdapterConfig): Promise<void>;

  /** Stop receiving messages */
  stop(): Promise<void>;

  /** Send a message to a chat */
  send(message: OutgoingMessage): Promise<string>; // returns message id

  /** Edit a previously sent message */
  edit(messageId: string, message: OutgoingMessage): Promise<void>;

  /** Delete a message */
  delete(chatId: string, messageId: string): Promise<void>;

  /** Subscribe to incoming messages */
  onMessage(handler: (msg: IncomingMessage) => Promise<void>): void;

  /** Subscribe to callback queries (button presses) */
  onCallback?(handler: (query: CallbackQuery) => Promise<void>): void;

  /** Health check */
  healthCheck(): Promise<HealthStatus>;
}

interface AdapterConfig {
  token: string;
  webhookUrl?: string;
  pollingInterval?: number;
  maxConnections?: number;
}

interface CallbackQuery {
  id: string;
  chatId: string;
  userId: string;
  data: string;
  messageId?: string;
}

interface InlineKeyboard {
  rows: InlineKeyboardButton[][];
}

interface InlineKeyboardButton {
  text: string;
  callbackData?: string;
  url?: string;
}
```

#### 2. LLM Router Interface

```typescript
// @openclaw/llm-router/types.ts

/** Unified chat completion request across all providers */
interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  tools?: ToolDefinition[];
  stream?: boolean;
  metadata?: Record<string, unknown>;
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentBlock[];
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

interface ContentBlock {
  type: "text" | "image";
  text?: string;
  imageUrl?: string;
}

interface ChatCompletionResponse {
  id: string;
  model: string;
  provider: string;
  choices: CompletionChoice[];
  usage: TokenUsage;
  latencyMs: number;
}

interface CompletionChoice {
  index: number;
  message: ChatMessage;
  finishReason: "stop" | "tool_calls" | "length" | "content_filter";
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
  };
}

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

type LLMProvider = "cloudru-fm" | "anthropic" | "openai" | "ollama";

interface LLMProviderAdapter {
  readonly provider: LLMProvider;

  /** Send a chat completion request */
  complete(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;

  /** Send a streaming chat completion request */
  stream(request: ChatCompletionRequest): AsyncIterable<StreamChunk>;

  /** List available models for this provider */
  listModels(): Promise<ModelInfo[]>;

  /** Health check */
  healthCheck(): Promise<HealthStatus>;
}

interface StreamChunk {
  id: string;
  delta: Partial<ChatMessage>;
  finishReason?: string;
  usage?: Partial<TokenUsage>;
}

interface ModelInfo {
  id: string;
  name: string;
  provider: LLMProvider;
  contextWindow: number;
  maxOutputTokens: number;
  supportsTool: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  costPer1kInput?: number;
  costPer1kOutput?: number;
  free: boolean;
}

interface LLMRouter {
  /** Register a provider adapter */
  registerProvider(adapter: LLMProviderAdapter): void;

  /** Route a request to the appropriate provider */
  complete(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;

  /** Route a streaming request */
  stream(request: ChatCompletionRequest): AsyncIterable<StreamChunk>;

  /** Resolve model string to provider + model id */
  resolveModel(model: string): { provider: LLMProvider; modelId: string };

  /** Get fallback chain for a model */
  getFallbackChain(model: string): string[];

  /** List all available models across all providers */
  listModels(): Promise<ModelInfo[]>;
}

/** Routing configuration per ADR-005 */
interface RoutingConfig {
  /** Default provider when model string has no prefix */
  defaultProvider: LLMProvider;

  /** Model alias mapping (e.g., "fast" -> "cloudru-fm/GLM-4.7-Flash") */
  aliases: Record<string, string>;

  /** Fallback chains per model */
  fallbacks: Record<string, string[]>;

  /** Rate limits per provider */
  rateLimits: Record<LLMProvider, { maxRps: number; maxConcurrent: number }>;
}
```

#### 3. Tool Sandbox Interface

```typescript
// @openclaw/tool-sandbox/types.ts

interface ToolPermission {
  toolName: string;
  allowed: boolean;
  constraints?: ToolConstraint[];
  reason?: string;
}

interface ToolConstraint {
  type: "path_prefix" | "command_whitelist" | "timeout" | "memory_limit" | "network";
  value: string | number | boolean;
}

interface ToolExecutionContext {
  tenantId: string;
  userId: string;
  sessionId: string;
  permissions: ToolPermission[];
  workspaceRoot: string;
  timeout: number;
}

interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
  resourceUsage: ResourceUsage;
}

interface ResourceUsage {
  cpuMs: number;
  memoryPeakMb: number;
  networkBytes: number;
  filesWritten: string[];
  filesRead: string[];
}

interface ToolSandbox {
  /** Validate whether a tool call is permitted */
  validatePermission(
    tool: ToolDefinition,
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolPermission>;

  /** Execute a tool within the sandbox */
  execute(
    tool: ToolDefinition,
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult>;

  /** Register a custom tool */
  registerTool(tool: SandboxedTool): void;

  /** List all registered tools with their permission defaults */
  listTools(): SandboxedToolDescriptor[];
}

interface SandboxedTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
  defaultPermissions: ToolConstraint[];
  execute: (
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ) => Promise<ToolExecutionResult>;
}

interface SandboxedToolDescriptor {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  defaultPermissions: ToolConstraint[];
}
```

#### 4. Tenant Manager Interface

```typescript
// @openclaw/tenant-manager/types.ts

interface Tenant {
  id: string;
  name: string;
  plan: TenantPlan;
  config: TenantConfig;
  quotas: TenantQuotas;
  status: "active" | "suspended" | "provisioning";
  createdAt: Date;
  updatedAt: Date;
}

type TenantPlan = "free" | "pro" | "enterprise";

interface TenantConfig {
  /** LLM provider configuration */
  llmProvider: LLMProvider;
  llmModel: string;
  llmApiKey?: string; // encrypted at rest

  /** Messenger configuration */
  enabledMessengers: MessengerSource[];

  /** Tool permissions */
  toolPermissions: ToolPermission[];

  /** System prompt override */
  systemPrompt?: string;

  /** Custom CLAUDE.md content */
  claudeMd?: string;

  /** Allowed domains for web search */
  allowedDomains?: string[];
}

interface TenantQuotas {
  maxMessagesPerDay: number;
  maxTokensPerDay: number;
  maxConcurrentSessions: number;
  maxStorageMb: number;
  maxToolExecutionsPerDay: number;
}

interface TenantContext {
  tenantId: string;
  userId: string;
  sessionId: string;
  plan: TenantPlan;
}

interface TenantManager {
  /** Create a new tenant */
  create(tenant: Omit<Tenant, "id" | "createdAt" | "updatedAt">): Promise<Tenant>;

  /** Get tenant by id */
  get(tenantId: string): Promise<Tenant | null>;

  /** Update tenant configuration */
  update(tenantId: string, patch: Partial<TenantConfig>): Promise<Tenant>;

  /** Suspend a tenant */
  suspend(tenantId: string, reason: string): Promise<void>;

  /** Reactivate a suspended tenant */
  reactivate(tenantId: string): Promise<void>;

  /** Delete tenant and all associated data */
  delete(tenantId: string): Promise<void>;

  /** Check quota consumption */
  checkQuota(
    tenantId: string,
    resource: keyof TenantQuotas,
    requested: number
  ): Promise<{ allowed: boolean; remaining: number }>;

  /** Record resource consumption */
  consumeQuota(
    tenantId: string,
    resource: keyof TenantQuotas,
    amount: number
  ): Promise<void>;

  /** Resolve tenant context from an incoming message */
  resolveContext(chatId: string, source: MessengerSource): Promise<TenantContext>;

  /** List all tenants with optional filtering */
  list(filter?: TenantFilter): Promise<Tenant[]>;
}

interface TenantFilter {
  plan?: TenantPlan;
  status?: Tenant["status"];
  search?: string;
  limit?: number;
  offset?: number;
}
```

#### 5. Worker Pool Interface

```typescript
// @openclaw/worker-pool/types.ts

interface WorkerPoolConfig {
  /** Maximum number of concurrent CLI workers */
  maxWorkers: number;

  /** Timeout per worker execution in ms */
  workerTimeout: number;

  /** Command template (e.g., "claude -p --output-format json") */
  command: string;

  /** Default environment variables for all workers */
  env: Record<string, string>;

  /** Working directory for worker processes */
  cwd: string;

  /** Queue strategy when all workers are busy */
  queueStrategy: "fifo" | "priority" | "reject";

  /** Maximum queue depth (0 = unlimited) */
  maxQueueDepth: number;

  /** Graceful shutdown timeout in ms */
  shutdownTimeout: number;
}

interface WorkerTask {
  id: string;
  prompt: string;
  sessionId?: string;
  systemPrompt?: string;
  env?: Record<string, string>;
  timeout?: number;
  priority?: number;
  metadata?: Record<string, unknown>;
}

interface WorkerResult {
  taskId: string;
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  durationMs: number;
  tokensUsed?: TokenUsage;
  workerId: string;
}

interface WorkerStatus {
  id: string;
  state: "idle" | "busy" | "starting" | "stopping" | "error";
  currentTaskId?: string;
  startedAt: Date;
  tasksCompleted: number;
  totalDurationMs: number;
  lastError?: string;
}

interface WorkerPool {
  /** Start the pool and initialize min workers */
  start(): Promise<void>;

  /** Submit a task to the pool. Returns when a worker picks it up or immediately if queue. */
  submit(task: WorkerTask): Promise<WorkerResult>;

  /** Submit and stream the result back in chunks */
  submitStreaming(task: WorkerTask): AsyncIterable<string>;

  /** Get current pool status */
  status(): WorkerPoolStatus;

  /** Gracefully shut down all workers */
  shutdown(): Promise<void>;

  /** Force kill all workers */
  kill(): void;

  /** Scale the pool to a new max workers count */
  scale(maxWorkers: number): void;
}

interface WorkerPoolStatus {
  totalWorkers: number;
  busyWorkers: number;
  idleWorkers: number;
  queueDepth: number;
  tasksCompleted: number;
  tasksFailed: number;
  avgDurationMs: number;
  uptime: number;
}
```

#### 6. Stream Pipeline Interface

```typescript
// @openclaw/stream-pipeline/types.ts

interface StreamPipelineConfig {
  /** Chunk size for buffered delivery (0 = character-by-character) */
  chunkSize: number;

  /** Heartbeat interval in ms to keep connections alive */
  heartbeatInterval: number;

  /** Maximum stream duration in ms */
  maxDuration: number;

  /** Enable gzip compression for HTTP transports */
  compress: boolean;
}

/** A stream source produces chunks */
interface StreamSource {
  /** Unique source identifier */
  id: string;

  /** Read chunks from the source */
  read(): AsyncIterable<StreamEvent>;

  /** Cancel the source */
  cancel(): Promise<void>;
}

/** Events flowing through the pipeline */
type StreamEvent =
  | { type: "text_delta"; content: string }
  | { type: "tool_use_start"; toolName: string; toolId: string }
  | { type: "tool_use_delta"; toolId: string; content: string }
  | { type: "tool_use_end"; toolId: string }
  | { type: "thinking_start" }
  | { type: "thinking_delta"; content: string }
  | { type: "thinking_end" }
  | { type: "metadata"; data: Record<string, unknown> }
  | { type: "error"; code: string; message: string }
  | { type: "done"; usage?: TokenUsage };

/** A stream sink consumes chunks and delivers to the client */
interface StreamSink {
  /** Write a stream event to the sink */
  write(event: StreamEvent): Promise<void>;

  /** Signal end of stream */
  end(): Promise<void>;

  /** Signal an error */
  error(err: Error): Promise<void>;
}

/** Transform applied to events as they flow through */
interface StreamTransform {
  name: string;
  transform(event: StreamEvent): StreamEvent | StreamEvent[] | null;
}

interface StreamPipeline {
  /** Connect a source to a sink through optional transforms */
  pipe(
    source: StreamSource,
    sink: StreamSink,
    transforms?: StreamTransform[]
  ): Promise<void>;

  /** Create an SSE sink for HTTP responses */
  createSSESink(response: ServerResponse): StreamSink;

  /** Create a WebSocket sink */
  createWebSocketSink(ws: WebSocket): StreamSink;

  /** Create a messenger-specific sink (batches text for messenger APIs) */
  createMessengerSink(
    adapter: MessengerAdapter,
    chatId: string,
    options?: MessengerSinkOptions
  ): StreamSink;
}

interface MessengerSinkOptions {
  /** Minimum interval between message edits in ms (to avoid rate limits) */
  editThrottle: number;

  /** Show typing indicator while streaming */
  showTyping: boolean;

  /** Maximum message length before splitting */
  maxMessageLength: number;
}
```

#### 7. Training Engine Interface

```typescript
// @openclaw/training-engine/types.ts

interface TrainingProfile {
  tenantId: string;
  userId: string;
  systemPrompt: string;
  examples: TrainingExample[];
  preferences: UserPreferences;
  domainKnowledge: DomainEntry[];
  createdAt: Date;
  updatedAt: Date;
}

interface TrainingExample {
  id: string;
  userMessage: string;
  idealResponse: string;
  tags: string[];
  quality: number; // 0-1 rating
}

interface UserPreferences {
  responseStyle: "concise" | "detailed" | "conversational";
  language: string;
  expertise: "beginner" | "intermediate" | "expert";
  topics: string[];
  avoidTopics: string[];
  formatting: "plain" | "markdown" | "structured";
}

interface DomainEntry {
  id: string;
  topic: string;
  content: string;
  source: string;
  embeddings?: number[];
}

interface TrainingEngine {
  /** Create or update a training profile */
  upsertProfile(profile: Partial<TrainingProfile> & {
    tenantId: string;
    userId: string;
  }): Promise<TrainingProfile>;

  /** Get profile for a user */
  getProfile(tenantId: string, userId: string): Promise<TrainingProfile | null>;

  /** Add training examples */
  addExamples(
    tenantId: string,
    userId: string,
    examples: Omit<TrainingExample, "id">[]
  ): Promise<TrainingExample[]>;

  /** Build a system prompt from the training profile */
  buildSystemPrompt(
    tenantId: string,
    userId: string,
    context?: PromptContext
  ): Promise<string>;

  /** Search domain knowledge using semantic similarity */
  searchKnowledge(
    tenantId: string,
    query: string,
    limit?: number
  ): Promise<DomainEntry[]>;

  /** Import domain knowledge from documents */
  importKnowledge(
    tenantId: string,
    documents: DocumentImport[]
  ): Promise<DomainEntry[]>;

  /** Delete a training profile and all associated data */
  deleteProfile(tenantId: string, userId: string): Promise<void>;
}

interface PromptContext {
  currentTopic?: string;
  recentMessages?: ChatMessage[];
  activeTools?: string[];
}

interface DocumentImport {
  content: string;
  source: string;
  mimeType: string;
  chunkSize?: number;
  chunkOverlap?: number;
}
```

#### 8. Agent Fabric Interface

```typescript
// @openclaw/agent-fabric/types.ts

/**
 * Integration with Cloud.ru AI Agents (Evolution AI Factory).
 * Wraps Cloud.ru's A2A protocol behind an anti-corruption layer
 * so OpenClaw's agent model is not contaminated by Cloud.ru specifics.
 */

interface FabricAgent {
  id: string;
  name: string;
  description: string;
  model: string;
  instructions: string;
  tools: FabricToolConfig[];
  ragSources: string[];
  status: "draft" | "active" | "stopped";
}

interface FabricToolConfig {
  type: "mcp_server" | "function" | "rag_query" | "web_search";
  name: string;
  config: Record<string, unknown>;
}

interface FabricConversation {
  agentId: string;
  threadId: string;
  messages: ChatMessage[];
}

interface FabricAgentResponse {
  threadId: string;
  message: ChatMessage;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  latencyMs: number;
}

interface AgentFabric {
  /** List available agents from Cloud.ru AI Fabric */
  listAgents(): Promise<FabricAgent[]>;

  /** Get agent details */
  getAgent(agentId: string): Promise<FabricAgent | null>;

  /** Create a new agent on Cloud.ru AI Fabric */
  createAgent(spec: Omit<FabricAgent, "id" | "status">): Promise<FabricAgent>;

  /** Update an existing agent */
  updateAgent(agentId: string, patch: Partial<FabricAgent>): Promise<FabricAgent>;

  /** Delete an agent */
  deleteAgent(agentId: string): Promise<void>;

  /** Send a message to a Cloud.ru AI Agent */
  chat(
    agentId: string,
    message: string,
    threadId?: string
  ): Promise<FabricAgentResponse>;

  /** Stream a response from a Cloud.ru AI Agent */
  chatStream(
    agentId: string,
    message: string,
    threadId?: string
  ): AsyncIterable<StreamChunk>;

  /** Delegate a sub-task to a Cloud.ru agent (A2A protocol) */
  delegate(
    fromAgentId: string,
    toAgentId: string,
    task: string,
    context?: Record<string, unknown>
  ): Promise<FabricAgentResponse>;

  /** Health check for Cloud.ru AI Fabric connectivity */
  healthCheck(): Promise<HealthStatus>;
}

interface AgentFabricConfig {
  /** Cloud.ru AI Agents API base URL */
  baseUrl: string;

  /** API key for Cloud.ru */
  apiKey: string;

  /** Project/workspace ID on Cloud.ru */
  projectId: string;

  /** Timeout for API calls in ms */
  timeout: number;

  /** Retry configuration */
  retries: { maxAttempts: number; backoffMs: number };
}
```

### Composition Root

The composition root is where all modules are wired together. This is the only
place that knows about all concrete implementations. Application code depends
only on interfaces.

```typescript
// @openclaw/core/composition-root.ts

import { OpenClawContainer, ServiceLifetime } from "./container";
import type { PluginRegistry } from "./registry";

// Import concrete implementations
import { TelegramAdapter, MaxAdapter, WebAdapter } from "@openclaw/messenger-adapters";
import { DefaultLLMRouter, CloudruFmProvider, AnthropicProvider } from "@openclaw/llm-router";
import { DefaultToolSandbox } from "@openclaw/tool-sandbox";
import { PostgresTenantManager } from "@openclaw/tenant-manager";
import { ClaudeCliWorkerPool } from "@openclaw/worker-pool";
import { DefaultStreamPipeline } from "@openclaw/stream-pipeline";
import { DefaultTrainingEngine } from "@openclaw/training-engine";
import { CloudruAgentFabric } from "@openclaw/agent-fabric";

export function composeApplication(config: AppConfig): DependencyContainer {
  const container = new OpenClawContainer("root");

  // -- Tier 1: Infrastructure (no internal dependencies) --

  container.register({
    token: "TenantManager",
    factory: () => new PostgresTenantManager(config.database),
    lifetime: ServiceLifetime.Singleton,
    dispose: (tm) => tm.disconnect(),
  });

  container.register({
    token: "WorkerPool",
    factory: () => new ClaudeCliWorkerPool(config.workerPool),
    lifetime: ServiceLifetime.Singleton,
    dispose: (wp) => wp.shutdown(),
  });

  // -- Tier 2: Core Services (depend on infrastructure) --

  container.register({
    token: "LLMRouter",
    factory: (c) => {
      const router = new DefaultLLMRouter(config.routing);
      if (config.providers.cloudruFm) {
        router.registerProvider(new CloudruFmProvider(config.providers.cloudruFm));
      }
      if (config.providers.anthropic) {
        router.registerProvider(new AnthropicProvider(config.providers.anthropic));
      }
      return router;
    },
    lifetime: ServiceLifetime.Singleton,
  });

  container.register({
    token: "ToolSandbox",
    factory: (c) => new DefaultToolSandbox(c.get("TenantManager")),
    lifetime: ServiceLifetime.Singleton,
  });

  container.register({
    token: "StreamPipeline",
    factory: () => new DefaultStreamPipeline(config.streaming),
    lifetime: ServiceLifetime.Singleton,
  });

  container.register({
    token: "TrainingEngine",
    factory: (c) => new DefaultTrainingEngine(
      config.training,
      c.get("TenantManager")
    ),
    lifetime: ServiceLifetime.Singleton,
  });

  container.register({
    token: "AgentFabric",
    factory: () => new CloudruAgentFabric(config.agentFabric),
    lifetime: ServiceLifetime.Singleton,
    dispose: (af) => af.disconnect?.(),
  });

  // -- Tier 3: Adapters (depend on core services) --

  container.register({
    token: "MessengerAdapters",
    factory: (c) => {
      const adapters: MessengerAdapter[] = [];
      if (config.messengers.telegram) {
        adapters.push(new TelegramAdapter(config.messengers.telegram));
      }
      if (config.messengers.max) {
        adapters.push(new MaxAdapter(config.messengers.max));
      }
      if (config.messengers.web) {
        adapters.push(new WebAdapter(config.messengers.web));
      }
      return adapters;
    },
    lifetime: ServiceLifetime.Singleton,
    dispose: (adapters) => Promise.all(adapters.map((a) => a.stop())),
  });

  container.build();
  return container;
}
```

### Standalone Usage Examples

Each module can be used independently in other projects. Below are examples
showing how a third-party developer would use each package without the full
OpenClaw system.

#### Standalone: @openclaw/messenger-adapters

```typescript
// A standalone MAX Messenger bot, no OpenClaw required
import { MaxAdapter } from "@openclaw/messenger-adapters";

const bot = new MaxAdapter({
  token: process.env.MAX_BOT_TOKEN!,
  pollingInterval: 1000,
});

bot.onMessage(async (msg) => {
  await bot.send({
    chatId: msg.chatId,
    text: `Echo: ${msg.text}`,
  });
});

await bot.start({ token: process.env.MAX_BOT_TOKEN! });
```

#### Standalone: @openclaw/llm-router

```typescript
// Route between Cloud.ru and OpenAI in a standalone Express app
import { DefaultLLMRouter, CloudruFmProvider, OpenAIProvider } from "@openclaw/llm-router";

const router = new DefaultLLMRouter({
  defaultProvider: "cloudru-fm",
  aliases: { fast: "cloudru-fm/GLM-4.7-Flash", smart: "openai/gpt-4o" },
  fallbacks: { "cloudru-fm/GLM-4.7": ["cloudru-fm/GLM-4.7-Flash"] },
  rateLimits: {
    "cloudru-fm": { maxRps: 15, maxConcurrent: 10 },
    openai: { maxRps: 60, maxConcurrent: 20 },
  },
});

router.registerProvider(new CloudruFmProvider({
  apiKey: process.env.CLOUDRU_API_KEY!,
  baseUrl: "https://foundation-models.api.cloud.ru/v1",
}));

const response = await router.complete({
  model: "fast",
  messages: [{ role: "user", content: "Hello" }],
});
```

#### Standalone: @openclaw/worker-pool

```typescript
// Use Claude Code CLI workers in a CI/CD pipeline
import { ClaudeCliWorkerPool } from "@openclaw/worker-pool";

const pool = new ClaudeCliWorkerPool({
  maxWorkers: 4,
  workerTimeout: 120_000,
  command: "claude -p --output-format json",
  env: {
    ANTHROPIC_BASE_URL: "http://localhost:8082",
    ANTHROPIC_API_KEY: "proxy-key",
  },
  cwd: "/workspace",
  queueStrategy: "fifo",
  maxQueueDepth: 100,
  shutdownTimeout: 30_000,
});

await pool.start();

const result = await pool.submit({
  id: "task-001",
  prompt: "Review the code in src/main.ts for security issues",
  sessionId: "review-session-1",
});

console.log(result.output);
await pool.shutdown();
```

#### Standalone: @openclaw/tenant-manager

```typescript
// Multi-tenant SaaS backend, standalone usage
import { PostgresTenantManager } from "@openclaw/tenant-manager";

const tm = new PostgresTenantManager({
  connectionString: process.env.DATABASE_URL!,
});

const tenant = await tm.create({
  name: "Acme Corp",
  plan: "pro",
  config: {
    llmProvider: "cloudru-fm",
    llmModel: "GLM-4.7-Flash",
    enabledMessengers: ["telegram", "max"],
    toolPermissions: [],
  },
  quotas: {
    maxMessagesPerDay: 10_000,
    maxTokensPerDay: 1_000_000,
    maxConcurrentSessions: 50,
    maxStorageMb: 1024,
    maxToolExecutionsPerDay: 500,
  },
  status: "active",
});

const quota = await tm.checkQuota(tenant.id, "maxMessagesPerDay", 1);
if (quota.allowed) {
  await tm.consumeQuota(tenant.id, "maxMessagesPerDay", 1);
}
```

## Module Catalog

| # | Package | Bounded Context | Responsibility | Primary Interface | Internal Dependencies | External Dependencies | Standalone Use Case |
|---|---------|----------------|----------------|-------------------|----------------------|----------------------|-------------------|
| 1 | `@openclaw/messenger-adapters` | Messenger Integration | Normalize messaging across Telegram, MAX, Web; provide unified IncomingMessage / OutgoingMessage protocol | `MessengerAdapter` | None | `node-telegram-bot-api`, MAX Bot SDK, `ws` | Any Node.js bot needing multi-messenger support |
| 2 | `@openclaw/llm-router` | Model Routing | Abstract LLM providers behind a single interface; handle model resolution, fallback chains, rate limiting per ADR-005 | `LLMRouter`, `LLMProviderAdapter` | None | `node-fetch` or `undici` | Any app needing multi-provider LLM routing |
| 3 | `@openclaw/tool-sandbox` | Tool Execution | Validate tool permissions, enforce constraints (path, timeout, memory), execute tools in isolated contexts | `ToolSandbox` | `@openclaw/tenant-manager` (optional) | `vm2` or `isolated-vm` | Any AI app needing safe tool execution |
| 4 | `@openclaw/tenant-manager` | Multi-Tenancy | Manage tenant lifecycle, configuration, quota enforcement, and context resolution from chat identifiers | `TenantManager` | None | `pg` (PostgreSQL driver), `ioredis` | Any multi-tenant SaaS backend |
| 5 | `@openclaw/worker-pool` | Agent Execution | Manage a pool of Claude Code CLI subprocesses; queue tasks, enforce timeouts, collect structured results per ADR-003 | `WorkerPool` | None | `child_process` (Node.js built-in) | CI/CD pipelines, batch AI processing |
| 6 | `@openclaw/stream-pipeline` | Response Delivery | Connect streaming LLM sources to delivery sinks (SSE, WebSocket, messenger edit) with transforms and backpressure | `StreamPipeline`, `StreamSource`, `StreamSink` | `@openclaw/messenger-adapters` (optional, for messenger sinks) | `ws`, Node.js `http` | Any app needing LLM streaming to multiple transports |
| 7 | `@openclaw/training-engine` | User Customization | Manage per-user training profiles, examples, domain knowledge; build dynamic system prompts with RAG | `TrainingEngine` | `@openclaw/tenant-manager` (optional) | Vector DB client (pgvector / Qdrant) | Any app needing user-personalized AI |
| 8 | `@openclaw/agent-fabric` | Cloud.ru Integration | Anti-corruption layer over Cloud.ru AI Agents API; expose agent CRUD, chat, streaming, and A2A delegation | `AgentFabric` | None | `node-fetch` or `undici` | Any app integrating with Cloud.ru AI Agents |

### Dependency Graph (npm packages)

```
@openclaw/messenger-adapters  (0 internal deps)
@openclaw/llm-router          (0 internal deps)
@openclaw/tool-sandbox         (0 internal deps, optional: tenant-manager)
@openclaw/tenant-manager       (0 internal deps)
@openclaw/worker-pool          (0 internal deps)
@openclaw/stream-pipeline      (0 internal deps, optional: messenger-adapters)
@openclaw/training-engine      (0 internal deps, optional: tenant-manager)
@openclaw/agent-fabric         (0 internal deps)

@openclaw/core                 (depends on all 8, composition root)
```

All eight packages have zero required internal dependencies. Optional
dependencies are declared as `peerDependencies` in `package.json` and are
only used when the consumer provides them.

### Package Structure Convention

Each package follows a consistent structure:

```
@openclaw/<package-name>/
  src/
    index.ts          # Public API exports
    types.ts          # TypeScript interfaces (published)
    <impl>.ts         # Implementation
    <impl>.test.ts    # Unit tests (London School, mock-first)
  package.json
  tsconfig.json
  README.md
```

### Versioning Strategy

- All packages follow independent SemVer versioning
- Interface-only changes (new optional fields) are minor bumps
- Breaking interface changes are major bumps
- The `@openclaw/core` package pins exact versions of all eight dependencies
  in its `package.json` to ensure a tested composition

### Event Bus (Cross-Module Communication)

Modules communicate through a typed event bus rather than direct imports.
This preserves loose coupling while enabling cross-cutting concerns like
audit logging, metrics, and quota enforcement.

```typescript
// @openclaw/core/events.ts

interface EventBus {
  emit<T extends DomainEvent>(event: T): void;
  on<T extends DomainEvent>(
    eventType: T["type"],
    handler: (event: T) => Promise<void>
  ): void;
  off(eventType: string, handler: Function): void;
}

type DomainEvent =
  | { type: "message.received"; payload: { source: MessengerSource; chatId: string; tenantId: string } }
  | { type: "message.sent"; payload: { source: MessengerSource; chatId: string; latencyMs: number } }
  | { type: "llm.request"; payload: { provider: LLMProvider; model: string; tenantId: string } }
  | { type: "llm.response"; payload: { provider: LLMProvider; model: string; tokens: TokenUsage; latencyMs: number } }
  | { type: "llm.error"; payload: { provider: LLMProvider; model: string; error: string } }
  | { type: "tool.executed"; payload: { toolName: string; success: boolean; tenantId: string; durationMs: number } }
  | { type: "worker.started"; payload: { workerId: string; taskId: string } }
  | { type: "worker.completed"; payload: { workerId: string; taskId: string; durationMs: number } }
  | { type: "tenant.created"; payload: { tenantId: string; plan: TenantPlan } }
  | { type: "tenant.suspended"; payload: { tenantId: string; reason: string } }
  | { type: "quota.exceeded"; payload: { tenantId: string; resource: string; limit: number } }
  | { type: "fabric.delegated"; payload: { fromAgentId: string; toAgentId: string; task: string } };
```

## Consequences

### Positive

- **Reusability**: Each module can be used in third-party applications without
  any OpenClaw dependency. A developer can `npm install @openclaw/llm-router`
  and use it in their Express app for multi-provider LLM routing.
- **Independent deployment**: Modules can be versioned, tested, and released
  independently. A bug fix in `@openclaw/messenger-adapters` does not require
  releasing all eight packages.
- **Testability**: Each module has a clear interface boundary. Unit tests mock
  the interface, not the implementation. Integration tests compose real modules.
- **Evolvability**: New messenger adapters (WhatsApp, Viber) are added by
  implementing `MessengerAdapter` without touching existing code. New LLM
  providers are added by implementing `LLMProviderAdapter`.
- **Separation of concerns**: Tenant isolation logic lives in one place.
  Streaming logic lives in one place. Tool sandboxing lives in one place.
  No feature is scattered across the codebase.
- **Third-party ecosystem**: The plugin registry enables community-developed
  modules that register at runtime without modifying the core.

### Negative

- **Coordination overhead**: Eight packages require coordinated CI/CD,
  versioning, and changelog management. A monorepo with Turborepo or Nx is
  recommended to mitigate this.
- **Interface stability pressure**: Published interfaces are hard to change.
  Breaking changes in `MessengerAdapter` affect all adapter implementations
  and all consumers. This requires careful upfront interface design.
- **Indirection cost**: The DI container and event bus add a layer of
  indirection that makes debugging harder compared to direct function calls.
  Mitigated by structured logging with correlation IDs.
- **Initial development cost**: Extracting into eight packages takes more
  effort than building a monolith. The payoff comes at scale and reuse.

### Risks

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|-----------|
| Interface instability in early versions | High | Medium | Mark v0.x as unstable; iterate before v1.0 |
| Circular dependency introduced | Low | High | CI check with `depcheck`; topological sort in container |
| Version skew between packages | Medium | Medium | `@openclaw/core` pins exact versions; integration test suite |
| Event bus becomes a hidden coupling | Medium | Low | Strict event schema; no business logic in event handlers |
| Performance overhead from DI | Low | Low | Benchmark; singleton lifetime for hot paths |
| Over-abstraction for current scale | Medium | Low | Start with 3-4 modules; extract remaining as needed |

### Invariants (DDD)

1. **Module Independence**: Every `@openclaw/*` package must have zero required
   internal dependencies. If module A requires module B at runtime, B must be
   declared as a `peerDependency` with a fallback or optional flag.

2. **Interface Stability**: Published TypeScript interfaces (`types.ts`) are
   the contract. Implementations may change freely. Consumers depend on
   interfaces, never on concrete classes.

3. **Tenant Isolation**: The `TenantContext` must be propagated through every
   cross-module call. No module may access data from a tenant other than the
   one in the current context. The DI scoped lifetime enforces this.

4. **No Shared Mutable State**: Modules communicate through the event bus or
   through interface method calls. No module may read or write another
   module's internal state directly.

5. **Health Propagation**: Every module implements `healthCheck()`. The
   composition root aggregates health status. If any critical module is
   unhealthy, the system reports degraded status.

## Alternatives Considered

1. **Monolith with internal modules** -- Simpler to build, but modules cannot
   be used standalone. Third-party developers must depend on the entire OpenClaw
   package even if they only need LLM routing. Rejected because reusability is
   a primary requirement.

2. **Microservices (separate processes per module)** -- Maximum isolation but
   excessive operational complexity for the current team size. Network overhead
   between services adds latency. Rejected for now; modules can be extracted
   into microservices later if needed.

3. **Plugin system with dynamic `require()`** -- More flexible at runtime but
   loses TypeScript type safety. Plugin API is harder to document and version.
   Rejected in favor of compile-time type checking via interfaces.

4. **Framework-based approach (NestJS modules)** -- Provides DI and module
   system out of the box but couples all consumers to the NestJS framework.
   Rejected because standalone usage must not force a framework dependency.

## References

- ADR-001: Cloud.ru FM Proxy Integration (proxy architecture)
- ADR-003: Claude Code as Agentic Execution Engine (worker pool design basis)
- ADR-005: Model Mapping and Fallback Strategy (LLM router design basis)
- `docs/research/max-messenger-integration.md` (MAX Bot API for messenger adapters)
- `docs/research/cloudru-ai-agents-integration.md` (Cloud.ru AI Fabric for agent-fabric module)
- `docs/research/integration-architecture-overview.md` (overall architecture context)
- `docs/cloud-ru-ai-fabric-research.md` (MCP and A2A protocol research)

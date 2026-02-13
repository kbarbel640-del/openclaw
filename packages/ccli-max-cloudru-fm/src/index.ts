/**
 * OpenClaw - Multi-tenant AI Agent Platform
 *
 * Main entry point providing access to all bounded contexts and the DI container.
 *
 * ## Architecture
 *
 * OpenClaw follows Domain-Driven Design with bounded contexts:
 *
 * - **Core**: Shared kernel (types, DI, event bus)
 * - **Session**: Tenant and session management
 * - **Concurrency**: Worker pool and request scheduling
 * - **Streaming**: Real-time response streaming
 * - **Messenger**: Multi-platform messaging (Telegram, Web)
 * - **MCP**: Model Context Protocol tool integration
 * - **Training**: Fine-tuning and context building
 * - **Plugins**: Plugin system with sandboxing
 * - **AI Fabric**: Model provider abstraction and routing
 *
 * ## Usage
 *
 * ```typescript
 * import { createContainer, TOKENS } from 'openclaw';
 *
 * // Create container with external dependencies
 * const container = createContainer({
 *   fileSystem: myFileSystem,
 *   httpClient: myHttpClient,
 *   subprocessFactory: mySubprocessFactory
 * });
 *
 * // Resolve services
 * const eventBus = container.resolve(TOKENS.EVENT_BUS);
 * const workerPool = container.resolve(TOKENS.WORKER_POOL);
 * const toolRegistry = container.resolve(TOKENS.TOOL_REGISTRY);
 * ```
 */

// ============================================================================
// Core Shared Kernel
// ============================================================================

// Core types and utilities
export type { Result } from './core/types/result.js';
export { ok, err, isOk, isErr, unwrap } from './core/types/result.js';

export type { OpenClawError } from './core/types/errors.js';
export {
  ValidationError,
  SecurityError,
  SessionError,
  ConcurrencyError,
  StreamError,
  ProviderError,
  PluginError as CorePluginError,
  TrainingError,
} from './core/types/errors.js';

export type { DomainEvent, DomainEventBus } from './core/types/domain-events.js';
export { createEvent } from './core/types/domain-events.js';

export type { Branded } from './core/types/branded.js';
export { brand } from './core/types/branded.js';

export type { MessengerPlatform } from './core/types/messenger-platform.js';
export { isMessengerPlatform } from './core/types/messenger-platform.js';

export type { TenantIdString, TenantIdComponents } from './core/types/tenant-id.js';
export { createTenantId, parseTenantId } from './core/types/tenant-id.js';

export type { SessionIdString } from './core/types/session-id.js';
export { createSessionId, parseSessionId } from './core/types/session-id.js';

export type { AccessTier, SandboxTier } from './core/types/access-tier.js';
export { mapToSandboxTier, isTierAtLeast } from './core/types/access-tier.js';

// Dependency injection
export { InjectionToken, DependencyContainer, CircularDependencyError, NotRegisteredError } from './core/di/index.js';

// Infrastructure
export { InProcessEventBus } from './core/infra/index.js';

// Container
export { createContainer, TOKENS } from './core/container.js';

// ============================================================================
// Session Bounded Context
// ============================================================================

export type { UserTenant, CreateUserTenantParams } from './session/index.js';
export {
  createUserTenant,
  touchTenant,
  changeTenantTier,
  suspendTenant,
  reinstateTenant,
} from './session/index.js';

export type { TenantSession, SessionState } from './session/index.js';
export {
  createTenantSession,
  transitionSession,
  isValidTransition,
  isSessionExpired,
  extendSession,
} from './session/index.js';

export type { ToolAccessPolicy } from './session/index.js';
export { getDefaultPolicy, isToolAllowed } from './session/index.js';

export type { WorkspacePath } from './session/index.js';
export { validateWorkspacePath } from './session/index.js';

export type {
  SessionCreated,
  SessionActivated,
  SessionSuspended,
  TenantCreated,
  TenantTierChanged,
  WorkspaceProvisioned,
  WorkspaceCleaned,
  ToolPolicyApplied,
  SessionDomainEvent,
  SessionExpiredEvent,
} from './session/index.js';

export {
  SessionNotFound,
  TenantNotFound,
  TenantSuspended,
  SessionExpired,
  InvalidStateTransition,
} from './session/index.js';

export { WorkspaceManager, validateTenantPath } from './session/index.js';
export type { IFileSystem, ITenantStore, ISessionStore } from './session/index.js';
export { InMemoryTenantStore, InMemorySessionStore } from './session/index.js';

// ============================================================================
// Concurrency Bounded Context
// ============================================================================

export type {
  WorkerState,
  Priority,
  QueueEntry,
  WorkerInfo,
  MutexHandle,
  WorkerRequest,
  WorkerResponse,
} from './concurrency/index.js';

export type { ConcurrencyConfig } from './concurrency/index.js';
export { DEFAULT_CONCURRENCY_CONFIG } from './concurrency/index.js';
export type { ConcurrencyMetrics } from './concurrency/index.js';

export {
  QueueFullError,
  WorkerTimeoutError,
  WorkerOOMError,
  BackpressureError,
} from './concurrency/index.js';

export type {
  WorkerSpawnedPayload,
  WorkerRecycledPayload,
  WorkerStuckPayload,
  RequestQueuedPayload,
  RequestStartedPayload,
  RequestCompletedPayload,
  RequestTimedOutPayload,
  BackpressureActivatedPayload,
  ConcurrencyEvent,
} from './concurrency/index.js';

export {
  PriorityScheduler,
  SessionMutex,
  LockAcquisitionError,
  WorkerLifecycle,
  WorkerHealth,
  WorkerPool,
  Backpressure,
} from './concurrency/index.js';

export type { ISubprocessFactory, SubprocessConfig, SubprocessInfo } from './concurrency/index.js';

// ============================================================================
// Streaming Bounded Context
// ============================================================================

export type {
  StreamEventType,
  StreamEvent,
  FlushReason,
  FlushResult,
  StreamConfig,
} from './streaming/index.js';

export {
  DEFAULT_STREAM_CONFIG,
  StreamParser,
  TokenAccumulator,
  LongMessageSplitter,
  SessionLock,
  StreamingResponseHandler,
} from './streaming/index.js';

export type { IStreamAdapter } from './streaming/index.js';
export { getStreamConfigForPlatform, BatchFallbackAdapter } from './streaming/index.js';

// ============================================================================
// Messenger Bounded Context
// ============================================================================

export type {
  IncomingMessage,
  OutgoingMessage,
  SendResult,
  WebhookPayload,
  RateLimitConfig,
} from './messenger/index.js';
export { PLATFORM_RATE_LIMITS } from './messenger/index.js';

export {
  MessengerError,
  WebhookValidationError,
  MessageDeliveryError,
  RateLimitError,
  PlatformUnavailableError,
} from './messenger/index.js';

export type {
  MessageReceived,
  MessageSent,
  MessageDeliveryFailed,
  WebhookReceived,
  WebhookValidationFailed,
} from './messenger/index.js';

export type { IMessengerPort } from './messenger/index.js';
export type { IHttpClient } from './messenger/index.js';
export { TelegramAdapter, WebAdapter } from './messenger/index.js';
export { WebhookRouter, MessageDispatcher, RateLimiter } from './messenger/index.js';

// ============================================================================
// MCP Bounded Context
// ============================================================================

export type {
  ToolDefinition,
  ToolCategory,
  ToolInvocation,
  ToolResult,
  McpServerConfig,
  ConversationTurn,
} from './mcp/index.js';

export {
  McpError,
  ToolNotFoundError,
  ToolAccessDeniedError,
  ToolTimeoutError,
  ToolExecutionError,
  McpConnectionError,
} from './mcp/index.js';

export {
  type ToolInvokedPayload,
  type ToolCompletedPayload,
  type ToolFailedPayload,
  type ToolTimedOutPayload,
  type ConversationStartedPayload,
  type ConversationCompletedPayload,
  createToolInvokedEvent,
  createToolCompletedEvent,
  createToolFailedEvent,
  createToolTimedOutEvent,
  createConversationStartedEvent,
  createConversationCompletedEvent,
} from './mcp/index.js';

export type { IMcpServerPort } from './mcp/index.js';
export type { ILlmPort } from './mcp/index.js';

export {
  ToolRegistry,
  type ToolFilter,
  ToolAccessGuard,
  ToolExecutor,
  ConversationOrchestrator,
} from './mcp/index.js';

export {
  type ConversationContext,
  type CreateContextParams,
  createContext,
  trimHistory,
} from './mcp/index.js';

// ============================================================================
// Training Bounded Context
// ============================================================================

export type {
  TrainingExample,
  ExampleCategory,
  QualityScore,
  FeedbackEntry,
  TrainingContext,
  ContextBuildConfig,
} from './training/index.js';
export { DEFAULT_CONTEXT_CONFIG } from './training/index.js';

export {
  TrainingContextError,
  ExampleNotFoundError,
  InvalidExampleError,
  ContextTooLargeError,
  FeedbackError,
} from './training/index.js';

export type {
  ExampleAdded,
  ExampleRemoved,
  ExampleRated,
  FeedbackReceived,
  ContextBuilt,
  ContextInvalidated,
} from './training/index.js';

export type { IExampleStore, ExampleFilter } from './training/index.js';
export type { IFeedbackStore } from './training/index.js';

export {
  InMemoryExampleStore,
  InMemoryFeedbackStore,
  ContextBuilder,
  type TokenEstimator,
  FeedbackProcessor,
  type ConversationMessage,
  ExampleValidator,
} from './training/index.js';

// ============================================================================
// Plugins Bounded Context
// ============================================================================

export type {
  PluginState,
  PluginManifest,
  PluginPermission,
  PluginInstance,
  PluginHook,
  HookName,
  HookContext,
  HookResult,
} from './plugins/index.js';

export {
  PluginSystemError,
  PluginNotFoundError,
  PluginInstallError,
  PluginPermissionError,
  PluginExecutionError,
  PluginConfigError,
} from './plugins/index.js';

export type {
  PluginRegistered,
  PluginInstalled,
  PluginActivated,
  PluginDisabled,
  PluginError as PluginErrorEvent,
  HookExecuted,
  PluginRegisteredPayload,
  PluginInstalledPayload,
  PluginActivatedPayload,
  PluginDisabledPayload,
  PluginErrorPayload,
  HookExecutedPayload,
} from './plugins/index.js';

export {
  transitionPlugin,
  canTransition,
  getValidTransitions,
} from './plugins/index.js';

export {
  PluginRegistry,
  type PluginListFilter,
  PluginLifecycle,
  PermissionGuard,
  HookDispatcher,
} from './plugins/index.js';

export type { IPluginSandbox } from './plugins/index.js';
export { NoOpSandbox } from './plugins/index.js';

// ============================================================================
// AI Fabric Bounded Context
// ============================================================================

export type {
  ModelProvider,
  ModelDefinition,
  ModelCapability,
  RateLimit,
  ModelRequest,
  ModelResponse,
  TokenUsage,
  FallbackChain,
} from './ai-fabric/index.js';

export {
  AiFabricError,
  ModelNotFoundError,
  ModelOverloadedError,
  AllModelsFailedError,
  RateLimitExceededError,
  TokenBudgetExceededError,
} from './ai-fabric/index.js';

export type {
  ModelRequested,
  ModelResponded,
  ModelFailed,
  FallbackTriggered,
  RateLimitHit,
  TokenBudgetWarning,
} from './ai-fabric/index.js';

export {
  ProviderRegistry,
  FallbackRouter,
  RateLimiter as AiFabricRateLimiter,
  TokenBudget,
  ModelSelector,
} from './ai-fabric/index.js';

export type { IModelPort } from './ai-fabric/index.js';

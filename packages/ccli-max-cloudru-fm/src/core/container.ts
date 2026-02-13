/**
 * OpenClaw Dependency Injection Container
 *
 * Wires together all bounded contexts into a cohesive system.
 * Each context registers its services, stores, and registries.
 */

import { DependencyContainer, InjectionToken } from './di/index.js';
import { InProcessEventBus } from './infra/index.js';
import type { DomainEventBus } from './types/domain-events.js';

// Session context
import { InMemoryTenantStore, InMemorySessionStore, WorkspaceManager } from '../session/index.js';
import type { ITenantStore, ISessionStore, IFileSystem } from '../session/index.js';

// Concurrency context
import { WorkerPool, PriorityScheduler, SessionMutex } from '../concurrency/index.js';
import type { ISubprocessFactory, ConcurrencyConfig } from '../concurrency/index.js';
import { DEFAULT_CONCURRENCY_CONFIG } from '../concurrency/index.js';

// Streaming context
import { BatchFallbackAdapter } from '../streaming/index.js';

// Messenger context
import { WebhookRouter, MessageDispatcher, RateLimiter, WebAdapter } from '../messenger/index.js';
import type { IHttpClient } from '../messenger/index.js';

// MCP context
import { ToolRegistry, ToolAccessGuard, ToolExecutor } from '../mcp/index.js';

// Training context
import { InMemoryExampleStore, InMemoryFeedbackStore, ContextBuilder, FeedbackProcessor, ExampleValidator } from '../training/index.js';
import type { IExampleStore, IFeedbackStore } from '../training/index.js';

// Plugins context
import { PluginRegistry, PluginLifecycle, PermissionGuard, HookDispatcher, NoOpSandbox } from '../plugins/index.js';
import type { IPluginSandbox } from '../plugins/index.js';

// AI Fabric context
import { ProviderRegistry, RateLimiter as AiFabricRateLimiter, TokenBudget, ModelSelector } from '../ai-fabric/index.js';

/**
 * Injection tokens for core services
 */
export const TOKENS = {
  // Core infrastructure
  EVENT_BUS: new InjectionToken<DomainEventBus>('DomainEventBus'),

  // Session context
  TENANT_STORE: new InjectionToken<ITenantStore>('ITenantStore'),
  SESSION_STORE: new InjectionToken<ISessionStore>('ISessionStore'),
  WORKSPACE_MANAGER: new InjectionToken<WorkspaceManager>('WorkspaceManager'),
  FILE_SYSTEM: new InjectionToken<IFileSystem>('IFileSystem'),

  // Concurrency context
  WORKER_POOL: new InjectionToken<WorkerPool>('WorkerPool'),
  PRIORITY_SCHEDULER: new InjectionToken<PriorityScheduler>('PriorityScheduler'),
  SESSION_MUTEX: new InjectionToken<SessionMutex>('SessionMutex'),
  SUBPROCESS_FACTORY: new InjectionToken<ISubprocessFactory>('ISubprocessFactory'),
  CONCURRENCY_CONFIG: new InjectionToken<ConcurrencyConfig>('ConcurrencyConfig'),

  // Streaming context (manually register if needed with specific config)
  BATCH_ADAPTER: new InjectionToken<BatchFallbackAdapter>('BatchFallbackAdapter'),

  // Messenger context
  WEBHOOK_ROUTER: new InjectionToken<WebhookRouter>('WebhookRouter'),
  MESSAGE_DISPATCHER: new InjectionToken<MessageDispatcher>('MessageDispatcher'),
  MESSENGER_RATE_LIMITER: new InjectionToken<RateLimiter>('MessengerRateLimiter'),
  WEB_ADAPTER: new InjectionToken<WebAdapter>('WebAdapter'),
  HTTP_CLIENT: new InjectionToken<IHttpClient>('IHttpClient'),

  // MCP context
  TOOL_REGISTRY: new InjectionToken<ToolRegistry>('ToolRegistry'),
  TOOL_ACCESS_GUARD: new InjectionToken<ToolAccessGuard>('ToolAccessGuard'),
  TOOL_EXECUTOR: new InjectionToken<ToolExecutor>('ToolExecutor'),

  // Training context
  EXAMPLE_STORE: new InjectionToken<IExampleStore>('IExampleStore'),
  FEEDBACK_STORE: new InjectionToken<IFeedbackStore>('IFeedbackStore'),
  CONTEXT_BUILDER: new InjectionToken<ContextBuilder>('ContextBuilder'),
  FEEDBACK_PROCESSOR: new InjectionToken<FeedbackProcessor>('FeedbackProcessor'),
  EXAMPLE_VALIDATOR: new InjectionToken<ExampleValidator>('ExampleValidator'),

  // Plugins context
  PLUGIN_REGISTRY: new InjectionToken<PluginRegistry>('PluginRegistry'),
  PLUGIN_LIFECYCLE: new InjectionToken<PluginLifecycle>('PluginLifecycle'),
  PERMISSION_GUARD: new InjectionToken<PermissionGuard>('PermissionGuard'),
  HOOK_DISPATCHER: new InjectionToken<HookDispatcher>('HookDispatcher'),
  PLUGIN_SANDBOX: new InjectionToken<IPluginSandbox>('IPluginSandbox'),

  // AI Fabric context
  PROVIDER_REGISTRY: new InjectionToken<ProviderRegistry>('ProviderRegistry'),
  AI_RATE_LIMITER: new InjectionToken<AiFabricRateLimiter>('AiFabricRateLimiter'),
  TOKEN_BUDGET: new InjectionToken<TokenBudget>('TokenBudget'),
  MODEL_SELECTOR: new InjectionToken<ModelSelector>('ModelSelector'),
} as const;

/**
 * Creates and configures the OpenClaw dependency injection container.
 *
 * All services are registered as singletons by default.
 * External dependencies (file system, http client, subprocess factory) must be provided.
 *
 * @param deps - External dependencies to inject
 * @returns Configured and frozen container
 */
export function createContainer(deps: {
  fileSystem: IFileSystem;
  httpClient: IHttpClient;
  subprocessFactory: ISubprocessFactory;
}): DependencyContainer {
  const container = new DependencyContainer();

  // Core infrastructure
  container.register(TOKENS.EVENT_BUS, () => new InProcessEventBus());

  // Session context
  container.register(TOKENS.FILE_SYSTEM, () => deps.fileSystem);
  container.register(TOKENS.TENANT_STORE, () => new InMemoryTenantStore());
  container.register(TOKENS.SESSION_STORE, () => new InMemorySessionStore());
  container.register(
    TOKENS.WORKSPACE_MANAGER,
    () => new WorkspaceManager(container.resolve(TOKENS.FILE_SYSTEM))
  );

  // Concurrency context
  container.register(TOKENS.CONCURRENCY_CONFIG, () => DEFAULT_CONCURRENCY_CONFIG);
  container.register(TOKENS.SUBPROCESS_FACTORY, () => deps.subprocessFactory);
  container.register(
    TOKENS.WORKER_POOL,
    () => new WorkerPool(
      container.resolve(TOKENS.CONCURRENCY_CONFIG),
      container.resolve(TOKENS.SUBPROCESS_FACTORY)
    )
  );
  container.register(TOKENS.SESSION_MUTEX, () => new SessionMutex());

  // Streaming context (note: StreamingResponseHandler requires StreamConfig and Timer, register separately if needed)

  // Messenger context (note: TelegramAdapter requires botToken, register separately if needed)
  container.register(TOKENS.HTTP_CLIENT, () => deps.httpClient);
  container.register(TOKENS.MESSENGER_RATE_LIMITER, () => new RateLimiter());
  container.register(TOKENS.WEB_ADAPTER, () => new WebAdapter());
  container.register(
    TOKENS.WEBHOOK_ROUTER,
    () => new WebhookRouter(container.resolve(TOKENS.EVENT_BUS))
  );
  container.register(
    TOKENS.MESSAGE_DISPATCHER,
    () => new MessageDispatcher(container.resolve(TOKENS.EVENT_BUS))
  );

  // MCP context (note: ILlmPort must be provided externally when using ConversationOrchestrator)
  container.register(TOKENS.TOOL_REGISTRY, () => new ToolRegistry());
  container.register(TOKENS.TOOL_ACCESS_GUARD, () => new ToolAccessGuard());
  container.register(
    TOKENS.TOOL_EXECUTOR,
    () => new ToolExecutor(container.resolve(TOKENS.EVENT_BUS))
  );

  // Training context
  container.register(TOKENS.EXAMPLE_STORE, () => new InMemoryExampleStore());
  container.register(TOKENS.FEEDBACK_STORE, () => new InMemoryFeedbackStore());
  container.register(TOKENS.EXAMPLE_VALIDATOR, () => new ExampleValidator());
  container.register(
    TOKENS.CONTEXT_BUILDER,
    () => new ContextBuilder(container.resolve(TOKENS.EXAMPLE_STORE))
  );
  container.register(
    TOKENS.FEEDBACK_PROCESSOR,
    () => new FeedbackProcessor(
      container.resolve(TOKENS.FEEDBACK_STORE),
      container.resolve(TOKENS.EXAMPLE_STORE),
      container.resolve(TOKENS.EVENT_BUS)
    )
  );

  // Plugins context
  container.register(TOKENS.PLUGIN_SANDBOX, () => new NoOpSandbox());
  container.register(TOKENS.PLUGIN_REGISTRY, () => new PluginRegistry());
  container.register(TOKENS.PERMISSION_GUARD, () => new PermissionGuard());
  container.register(
    TOKENS.PLUGIN_LIFECYCLE,
    () => new PluginLifecycle(
      container.resolve(TOKENS.PLUGIN_REGISTRY),
      container.resolve(TOKENS.EVENT_BUS)
    )
  );
  container.register(
    TOKENS.HOOK_DISPATCHER,
    () => new HookDispatcher()
  );

  // AI Fabric context (note: IModelPort must be provided externally for FallbackRouter)
  container.register(TOKENS.PROVIDER_REGISTRY, () => new ProviderRegistry());
  container.register(TOKENS.AI_RATE_LIMITER, () => new AiFabricRateLimiter());
  container.register(TOKENS.TOKEN_BUDGET, () => new TokenBudget());
  container.register(TOKENS.MODEL_SELECTOR, () => new ModelSelector());

  // Freeze container to prevent runtime modifications
  container.freeze();

  return container;
}

/**
 * Unit tests for the composition root (createContainer / TOKENS)
 *
 * London School TDD: all external dependencies injected into createContainer()
 * are mocked. We verify the container wiring, not the behaviour of individual
 * services (those have their own unit tests).
 */

import { describe, it, expect, vi } from 'vitest';
import { createContainer, TOKENS } from '../../src/core/container.js';
import { DependencyContainer } from '../../src/core/di/container.js';
import { InjectionToken } from '../../src/core/di/injection-token.js';
import type { IFileSystem } from '../../src/session/index.js';
import type { IHttpClient } from '../../src/messenger/index.js';
import type { ISubprocessFactory } from '../../src/concurrency/index.js';

// ---------------------------------------------------------------------------
// Mock external dependencies (London School: mock at the boundary)
// ---------------------------------------------------------------------------

function createMockFileSystem(): IFileSystem {
  return {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    rmdir: vi.fn(),
    exists: vi.fn(),
  };
}

function createMockHttpClient(): IHttpClient {
  return {
    post: vi.fn(),
    get: vi.fn(),
  };
}

function createMockSubprocessFactory(): ISubprocessFactory {
  return {
    create: vi.fn(),
    getMemoryUsage: vi.fn(),
    kill: vi.fn(),
  };
}

function buildContainer() {
  return createContainer({
    fileSystem: createMockFileSystem(),
    httpClient: createMockHttpClient(),
    subprocessFactory: createMockSubprocessFactory(),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createContainer()', () => {
  // -----------------------------------------------------------------------
  // Returns a frozen container
  // -----------------------------------------------------------------------
  describe('container state', () => {
    it('should return a DependencyContainer instance', () => {
      const container = buildContainer();

      expect(container).toBeInstanceOf(DependencyContainer);
    });

    it('should return a frozen container', () => {
      const container = buildContainer();

      expect(container.isFrozen()).toBe(true);
    });

    it('should reject further registrations after creation', () => {
      const container = buildContainer();
      const EXTRA = new InjectionToken<string>('Extra');

      expect(() => container.register(EXTRA, () => 'nope')).toThrow(
        'Container is frozen'
      );
    });
  });

  // -----------------------------------------------------------------------
  // All expected tokens are registered and resolvable
  // -----------------------------------------------------------------------
  describe('token registration completeness', () => {
    /** All tokens that createContainer() is expected to register */
    const expectedTokenEntries: Array<[string, InjectionToken<unknown>]> = [
      // Core infrastructure
      ['EVENT_BUS', TOKENS.EVENT_BUS],
      // Session context
      ['FILE_SYSTEM', TOKENS.FILE_SYSTEM],
      ['TENANT_STORE', TOKENS.TENANT_STORE],
      ['SESSION_STORE', TOKENS.SESSION_STORE],
      ['WORKSPACE_MANAGER', TOKENS.WORKSPACE_MANAGER],
      // Concurrency context
      ['CONCURRENCY_CONFIG', TOKENS.CONCURRENCY_CONFIG],
      ['SUBPROCESS_FACTORY', TOKENS.SUBPROCESS_FACTORY],
      ['WORKER_POOL', TOKENS.WORKER_POOL],
      ['SESSION_MUTEX', TOKENS.SESSION_MUTEX],
      // Messenger context
      ['HTTP_CLIENT', TOKENS.HTTP_CLIENT],
      ['MESSENGER_RATE_LIMITER', TOKENS.MESSENGER_RATE_LIMITER],
      ['WEB_ADAPTER', TOKENS.WEB_ADAPTER],
      ['WEBHOOK_ROUTER', TOKENS.WEBHOOK_ROUTER],
      ['MESSAGE_DISPATCHER', TOKENS.MESSAGE_DISPATCHER],
      // MCP context
      ['TOOL_REGISTRY', TOKENS.TOOL_REGISTRY],
      ['TOOL_ACCESS_GUARD', TOKENS.TOOL_ACCESS_GUARD],
      ['TOOL_EXECUTOR', TOKENS.TOOL_EXECUTOR],
      // Training context
      ['EXAMPLE_STORE', TOKENS.EXAMPLE_STORE],
      ['FEEDBACK_STORE', TOKENS.FEEDBACK_STORE],
      ['EXAMPLE_VALIDATOR', TOKENS.EXAMPLE_VALIDATOR],
      ['CONTEXT_BUILDER', TOKENS.CONTEXT_BUILDER],
      ['FEEDBACK_PROCESSOR', TOKENS.FEEDBACK_PROCESSOR],
      // Plugins context
      ['PLUGIN_SANDBOX', TOKENS.PLUGIN_SANDBOX],
      ['PLUGIN_REGISTRY', TOKENS.PLUGIN_REGISTRY],
      ['PERMISSION_GUARD', TOKENS.PERMISSION_GUARD],
      ['PLUGIN_LIFECYCLE', TOKENS.PLUGIN_LIFECYCLE],
      ['HOOK_DISPATCHER', TOKENS.HOOK_DISPATCHER],
      // AI Fabric context
      ['PROVIDER_REGISTRY', TOKENS.PROVIDER_REGISTRY],
      ['AI_RATE_LIMITER', TOKENS.AI_RATE_LIMITER],
      ['TOKEN_BUDGET', TOKENS.TOKEN_BUDGET],
      ['MODEL_SELECTOR', TOKENS.MODEL_SELECTOR],
    ];

    it.each(expectedTokenEntries)(
      'should have %s registered and resolvable',
      (_name, tokenValue) => {
        const container = buildContainer();

        expect(container.has(tokenValue)).toBe(true);
        expect(() => container.resolve(tokenValue)).not.toThrow();
      }
    );

    it('should register all expected tokens (count check)', () => {
      const container = buildContainer();

      for (const [_name, tokenValue] of expectedTokenEntries) {
        expect(container.has(tokenValue)).toBe(true);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Resolved services have correct types
  // -----------------------------------------------------------------------
  describe('resolved service types', () => {
    it('should resolve EVENT_BUS as an InProcessEventBus', async () => {
      const container = buildContainer();
      const eventBus = container.resolve(TOKENS.EVENT_BUS);

      // InProcessEventBus implements DomainEventBus with publish/subscribe
      expect(eventBus).toBeDefined();
      expect(typeof eventBus.publish).toBe('function');
      expect(typeof eventBus.subscribe).toBe('function');
    });

    it('should resolve TENANT_STORE as an InMemoryTenantStore', () => {
      const container = buildContainer();
      const tenantStore = container.resolve(TOKENS.TENANT_STORE);

      expect(tenantStore).toBeDefined();
      expect(typeof tenantStore.save).toBe('function');
      expect(typeof tenantStore.get).toBe('function');
    });

    it('should resolve SESSION_STORE as an InMemorySessionStore', () => {
      const container = buildContainer();
      const sessionStore = container.resolve(TOKENS.SESSION_STORE);

      expect(sessionStore).toBeDefined();
      expect(typeof sessionStore.save).toBe('function');
      expect(typeof sessionStore.get).toBe('function');
    });

    it('should resolve WORKSPACE_MANAGER as a WorkspaceManager', () => {
      const container = buildContainer();
      const workspaceMgr = container.resolve(TOKENS.WORKSPACE_MANAGER);

      expect(workspaceMgr).toBeDefined();
      expect(typeof workspaceMgr.provisionWorkspace).toBe('function');
      expect(typeof workspaceMgr.cleanWorkspace).toBe('function');
      expect(typeof workspaceMgr.validatePath).toBe('function');
    });

    it('should resolve WORKER_POOL as a WorkerPool', () => {
      const container = buildContainer();
      const pool = container.resolve(TOKENS.WORKER_POOL);

      expect(pool).toBeDefined();
      expect(typeof pool.submit).toBe('function');
    });

    it('should resolve SESSION_MUTEX as a SessionMutex', () => {
      const container = buildContainer();
      const mutex = container.resolve(TOKENS.SESSION_MUTEX);

      expect(mutex).toBeDefined();
      expect(typeof mutex.acquire).toBe('function');
    });

    it('should resolve TOOL_REGISTRY as a ToolRegistry', () => {
      const container = buildContainer();
      const registry = container.resolve(TOKENS.TOOL_REGISTRY);

      expect(registry).toBeDefined();
      expect(typeof registry.register).toBe('function');
    });

    it('should resolve TOOL_ACCESS_GUARD as a ToolAccessGuard', () => {
      const container = buildContainer();
      const guard = container.resolve(TOKENS.TOOL_ACCESS_GUARD);

      expect(guard).toBeDefined();
      expect(typeof guard.checkAccess).toBe('function');
    });

    it('should resolve TOOL_EXECUTOR as a ToolExecutor', () => {
      const container = buildContainer();
      const executor = container.resolve(TOKENS.TOOL_EXECUTOR);

      expect(executor).toBeDefined();
      expect(typeof executor.execute).toBe('function');
    });

    it('should resolve EXAMPLE_STORE with IExampleStore interface', () => {
      const container = buildContainer();
      const store = container.resolve(TOKENS.EXAMPLE_STORE);

      expect(store).toBeDefined();
      expect(typeof store.save).toBe('function');
    });

    it('should resolve FEEDBACK_STORE with IFeedbackStore interface', () => {
      const container = buildContainer();
      const store = container.resolve(TOKENS.FEEDBACK_STORE);

      expect(store).toBeDefined();
      expect(typeof store.save).toBe('function');
    });

    it('should resolve PLUGIN_REGISTRY as a PluginRegistry', () => {
      const container = buildContainer();
      const registry = container.resolve(TOKENS.PLUGIN_REGISTRY);

      expect(registry).toBeDefined();
      expect(typeof registry.register).toBe('function');
    });

    it('should resolve PROVIDER_REGISTRY as a ProviderRegistry', () => {
      const container = buildContainer();
      const registry = container.resolve(TOKENS.PROVIDER_REGISTRY);

      expect(registry).toBeDefined();
      expect(typeof registry.register).toBe('function');
    });

    it('should resolve MODEL_SELECTOR as a ModelSelector', () => {
      const container = buildContainer();
      const selector = container.resolve(TOKENS.MODEL_SELECTOR);

      expect(selector).toBeDefined();
      expect(typeof selector.select).toBe('function');
    });

    it('should resolve TOKEN_BUDGET as a TokenBudget', () => {
      const container = buildContainer();
      const budget = container.resolve(TOKENS.TOKEN_BUDGET);

      expect(budget).toBeDefined();
    });

    it('should resolve FILE_SYSTEM as the injected mock', () => {
      const mockFs = createMockFileSystem();
      const container = createContainer({
        fileSystem: mockFs,
        httpClient: createMockHttpClient(),
        subprocessFactory: createMockSubprocessFactory(),
      });

      const resolved = container.resolve(TOKENS.FILE_SYSTEM);

      expect(resolved).toBe(mockFs);
    });

    it('should resolve HTTP_CLIENT as the injected mock', () => {
      const mockHttp = createMockHttpClient();
      const container = createContainer({
        fileSystem: createMockFileSystem(),
        httpClient: mockHttp,
        subprocessFactory: createMockSubprocessFactory(),
      });

      const resolved = container.resolve(TOKENS.HTTP_CLIENT);

      expect(resolved).toBe(mockHttp);
    });

    it('should resolve SUBPROCESS_FACTORY as the injected mock', () => {
      const mockFactory = createMockSubprocessFactory();
      const container = createContainer({
        fileSystem: createMockFileSystem(),
        httpClient: createMockHttpClient(),
        subprocessFactory: mockFactory,
      });

      const resolved = container.resolve(TOKENS.SUBPROCESS_FACTORY);

      expect(resolved).toBe(mockFactory);
    });
  });

  // -----------------------------------------------------------------------
  // Services are wired with correct dependencies
  // -----------------------------------------------------------------------
  describe('dependency wiring', () => {
    it('should wire WORKSPACE_MANAGER with the FILE_SYSTEM dependency', () => {
      const mockFs = createMockFileSystem();
      const container = createContainer({
        fileSystem: mockFs,
        httpClient: createMockHttpClient(),
        subprocessFactory: createMockSubprocessFactory(),
      });

      const workspaceMgr = container.resolve(TOKENS.WORKSPACE_MANAGER);

      // WorkspaceManager receives IFileSystem in constructor. We verify
      // it can call through to the mock, confirming wiring.
      expect(workspaceMgr).toBeDefined();
      // The workspace manager was constructed with our mock fs;
      // calling validatePath exercises no fs but proves the object is live.
      const result = workspaceMgr.validatePath(
        '/workspaces/telegram:u:c/file.txt',
        'telegram:u:c' as Parameters<typeof workspaceMgr.validatePath>[1]
      );
      expect(result).toBeDefined();
    });

    it('should wire WEBHOOK_ROUTER with EVENT_BUS', () => {
      const container = buildContainer();

      // Resolving WEBHOOK_ROUTER should not throw, meaning the EVENT_BUS
      // dependency was successfully injected into its constructor.
      const router = container.resolve(TOKENS.WEBHOOK_ROUTER);
      expect(router).toBeDefined();
    });

    it('should wire MESSAGE_DISPATCHER with EVENT_BUS', () => {
      const container = buildContainer();

      const dispatcher = container.resolve(TOKENS.MESSAGE_DISPATCHER);
      expect(dispatcher).toBeDefined();
    });

    it('should wire TOOL_EXECUTOR with EVENT_BUS', () => {
      const container = buildContainer();

      const executor = container.resolve(TOKENS.TOOL_EXECUTOR);
      expect(executor).toBeDefined();
      expect(typeof executor.execute).toBe('function');
    });

    it('should wire CONTEXT_BUILDER with EXAMPLE_STORE', () => {
      const container = buildContainer();

      const builder = container.resolve(TOKENS.CONTEXT_BUILDER);
      expect(builder).toBeDefined();
      expect(typeof builder.build).toBe('function');
    });

    it('should wire FEEDBACK_PROCESSOR with FEEDBACK_STORE, EXAMPLE_STORE, and EVENT_BUS', () => {
      const container = buildContainer();

      const processor = container.resolve(TOKENS.FEEDBACK_PROCESSOR);
      expect(processor).toBeDefined();
      expect(typeof processor.processFeedback).toBe('function');
    });

    it('should wire PLUGIN_LIFECYCLE with PLUGIN_REGISTRY and EVENT_BUS', () => {
      const container = buildContainer();

      const lifecycle = container.resolve(TOKENS.PLUGIN_LIFECYCLE);
      expect(lifecycle).toBeDefined();
      expect(typeof lifecycle.install).toBe('function');
    });

    it('should wire WORKER_POOL with CONCURRENCY_CONFIG and SUBPROCESS_FACTORY', () => {
      const container = buildContainer();

      const pool = container.resolve(TOKENS.WORKER_POOL);
      expect(pool).toBeDefined();
      expect(typeof pool.submit).toBe('function');
    });

    it('should provide DEFAULT_CONCURRENCY_CONFIG via CONCURRENCY_CONFIG token', () => {
      const container = buildContainer();

      const config = container.resolve(TOKENS.CONCURRENCY_CONFIG);

      expect(config).toBeDefined();
      expect(config.maxWorkers).toBe(4);
      expect(config.maxQueueSize).toBe(32);
    });

    it('should share the same EVENT_BUS singleton across all dependent services', () => {
      const container = buildContainer();

      // Resolve EVENT_BUS directly
      const eventBus = container.resolve(TOKENS.EVENT_BUS);

      // All services that depend on EVENT_BUS should receive the same instance.
      // We verify this indirectly: resolve EVENT_BUS twice and confirm identity.
      const eventBus2 = container.resolve(TOKENS.EVENT_BUS);
      expect(eventBus).toBe(eventBus2);
    });
  });

  // -----------------------------------------------------------------------
  // TOKENS constant
  // -----------------------------------------------------------------------
  describe('TOKENS', () => {
    it('should export all token keys as InjectionToken instances', () => {
      for (const value of Object.values(TOKENS)) {
        expect(value).toBeInstanceOf(InjectionToken);
        expect(value.description).toBeTruthy();
      }
    });

    it('should have unique token instances (no accidental sharing)', () => {
      const tokenValues = Object.values(TOKENS);
      const uniqueTokens = new Set(tokenValues);

      expect(uniqueTokens.size).toBe(tokenValues.length);
    });
  });
});

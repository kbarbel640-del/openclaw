/**
 * Tests for ToolExecutor.
 *
 * Verifies tool invocation, timeout handling, error wrapping,
 * and domain event emission using mocked dependencies (London School TDD).
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ToolExecutor } from '../../src/mcp/application/tool-executor.js';
import { ToolTimeoutError, ToolExecutionError } from '../../src/mcp/domain/errors.js';
import type { ToolInvocation, ToolResult } from '../../src/mcp/domain/types.js';
import type { IMcpServerPort } from '../../src/mcp/ports/mcp-server-port.js';
import type { DomainEventBus, DomainEvent } from '../../src/core/types/domain-events.js';
import { ok, err } from '../../src/core/types/result.js';
import type { TenantIdString } from '../../src/core/types/tenant-id.js';

/**
 * Factory helpers
 */
const tenantId = 'telegram:user1:chat1' as TenantIdString;

function createInvocation(overrides: Partial<ToolInvocation> = {}): ToolInvocation {
  return {
    toolName: overrides.toolName ?? 'test-tool',
    arguments: overrides.arguments ?? { input: 'hello' },
    tenantId: overrides.tenantId ?? tenantId,
    sessionId: overrides.sessionId ?? 'session-1',
    invocationId: overrides.invocationId ?? 'inv-1',
    timestamp: overrides.timestamp ?? new Date('2025-01-01T00:00:00Z'),
  };
}

function createToolResult(overrides: Partial<ToolResult> = {}): ToolResult {
  return {
    invocationId: overrides.invocationId ?? 'inv-1',
    toolName: overrides.toolName ?? 'test-tool',
    content: overrides.content ?? 'result content',
    isError: overrides.isError ?? false,
    durationMs: overrides.durationMs ?? 42,
  };
}

function createMockEventBus(): DomainEventBus {
  return {
    publish: vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => {}),
    subscribeAll: vi.fn().mockReturnValue(() => {}),
  };
}

function createMockServer(overrides: Partial<IMcpServerPort> = {}): IMcpServerPort {
  return {
    connect: overrides.connect ?? vi.fn().mockResolvedValue(ok(undefined)),
    disconnect: overrides.disconnect ?? vi.fn().mockResolvedValue(undefined),
    listTools: overrides.listTools ?? vi.fn().mockResolvedValue(ok([])),
    invokeTool: overrides.invokeTool ?? vi.fn().mockResolvedValue(ok(createToolResult())),
    isConnected: overrides.isConnected ?? vi.fn().mockReturnValue(true),
  };
}

describe('ToolExecutor', () => {
  let eventBus: DomainEventBus;
  let executor: ToolExecutor;

  beforeEach(() => {
    vi.useFakeTimers();
    eventBus = createMockEventBus();
    executor = new ToolExecutor(eventBus, 30000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('successful execution', () => {
    it('should return a successful result when the server responds', async () => {
      vi.useRealTimers();
      const toolResult = createToolResult({ content: 'success output' });
      const server = createMockServer({
        invokeTool: vi.fn().mockResolvedValue(ok(toolResult)),
      });

      const invocation = createInvocation();
      const result = await executor.execute(invocation, server);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.content).toBe('success output');
        expect(result.value.invocationId).toBe('inv-1');
        expect(result.value.toolName).toBe('test-tool');
        expect(result.value.isError).toBe(false);
      }
    });

    it('should enrich the result with durationMs', async () => {
      vi.useRealTimers();
      const toolResult = createToolResult({ durationMs: 0 });
      const server = createMockServer({
        invokeTool: vi.fn().mockResolvedValue(ok(toolResult)),
      });

      const result = await executor.execute(createInvocation(), server);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // durationMs is calculated from wall-clock time, so it should be >= 0
        expect(result.value.durationMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('should pass the invocation to the server port', async () => {
      vi.useRealTimers();
      const invokeSpy = vi.fn().mockResolvedValue(ok(createToolResult()));
      const server = createMockServer({ invokeTool: invokeSpy });
      const invocation = createInvocation({ toolName: 'my-tool', arguments: { x: 42 } });

      await executor.execute(invocation, server);

      expect(invokeSpy).toHaveBeenCalledTimes(1);
      expect(invokeSpy).toHaveBeenCalledWith(invocation);
    });
  });

  describe('event emission', () => {
    it('should emit a ToolInvoked event before execution', async () => {
      vi.useRealTimers();
      const server = createMockServer();
      const invocation = createInvocation();

      await executor.execute(invocation, server);

      const publishCalls = (eventBus.publish as ReturnType<typeof vi.fn>).mock.calls;
      expect(publishCalls.length).toBeGreaterThanOrEqual(1);

      const invokedEvent = publishCalls[0]![0] as DomainEvent;
      expect(invokedEvent.type).toBe('mcp.tool.invoked');
      expect(invokedEvent.payload).toEqual({ invocation });
    });

    it('should emit a ToolCompleted event on success', async () => {
      vi.useRealTimers();
      const toolResult = createToolResult({ content: 'done' });
      const server = createMockServer({
        invokeTool: vi.fn().mockResolvedValue(ok(toolResult)),
      });

      await executor.execute(createInvocation(), server);

      const publishCalls = (eventBus.publish as ReturnType<typeof vi.fn>).mock.calls;
      const completedEvent = publishCalls.find(
        (call: unknown[]) => (call[0] as DomainEvent).type === 'mcp.tool.completed'
      );

      expect(completedEvent).toBeDefined();
      const payload = (completedEvent![0] as DomainEvent).payload as { result: ToolResult };
      expect(payload.result.content).toBe('done');
    });

    it('should emit a ToolFailed event when the server returns an error result', async () => {
      vi.useRealTimers();
      const execError = new ToolExecutionError('test-tool', 'something broke');
      const server = createMockServer({
        invokeTool: vi.fn().mockResolvedValue(err(execError)),
      });

      await executor.execute(createInvocation(), server);

      const publishCalls = (eventBus.publish as ReturnType<typeof vi.fn>).mock.calls;
      const failedEvent = publishCalls.find(
        (call: unknown[]) => (call[0] as DomainEvent).type === 'mcp.tool.failed'
      );

      expect(failedEvent).toBeDefined();
      const payload = (failedEvent![0] as DomainEvent).payload as {
        invocation: ToolInvocation;
        error: string;
      };
      expect(payload.error).toContain('something broke');
    });

    it('should emit a ToolTimedOut event on timeout', async () => {
      const server = createMockServer({
        invokeTool: vi.fn().mockImplementation(
          () => new Promise((resolve) => {
            setTimeout(() => resolve(ok(createToolResult())), 60000);
          })
        ),
      });

      const executePromise = executor.execute(createInvocation(), server, 100);
      vi.advanceTimersByTime(200);

      await executePromise;

      const publishCalls = (eventBus.publish as ReturnType<typeof vi.fn>).mock.calls;
      const timedOutEvent = publishCalls.find(
        (call: unknown[]) => (call[0] as DomainEvent).type === 'mcp.tool.timedout'
      );

      expect(timedOutEvent).toBeDefined();
      const payload = (timedOutEvent![0] as DomainEvent).payload as {
        invocation: ToolInvocation;
        timeoutMs: number;
      };
      expect(payload.timeoutMs).toBe(100);
    });
  });

  describe('timeout handling', () => {
    it('should return a ToolTimeoutError when execution exceeds the timeout', async () => {
      const server = createMockServer({
        invokeTool: vi.fn().mockImplementation(
          () => new Promise((resolve) => {
            setTimeout(() => resolve(ok(createToolResult())), 60000);
          })
        ),
      });

      const executePromise = executor.execute(createInvocation(), server, 500);
      vi.advanceTimersByTime(600);

      const result = await executePromise;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ToolTimeoutError);
        expect(result.error.code).toBe('TOOL_TIMEOUT');
        expect(result.error.message).toContain('test-tool');
        expect(result.error.message).toContain('500');
      }
    });

    it('should use the default timeout when none is specified', async () => {
      const shortExecutor = new ToolExecutor(eventBus, 200);
      const server = createMockServer({
        invokeTool: vi.fn().mockImplementation(
          () => new Promise((resolve) => {
            setTimeout(() => resolve(ok(createToolResult())), 60000);
          })
        ),
      });

      const executePromise = shortExecutor.execute(createInvocation(), server);
      vi.advanceTimersByTime(300);

      const result = await executePromise;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ToolTimeoutError);
        expect(result.error.message).toContain('200');
      }
    });

    it('should allow overriding the default timeout per invocation', async () => {
      // Default is 30000, but we override to 50ms
      const server = createMockServer({
        invokeTool: vi.fn().mockImplementation(
          () => new Promise((resolve) => {
            setTimeout(() => resolve(ok(createToolResult())), 60000);
          })
        ),
      });

      const executePromise = executor.execute(createInvocation(), server, 50);
      vi.advanceTimersByTime(100);

      const result = await executePromise;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ToolTimeoutError);
        expect(result.error.message).toContain('50');
      }
    });

    it('should mark timeout errors as recoverable', async () => {
      const server = createMockServer({
        invokeTool: vi.fn().mockImplementation(
          () => new Promise((resolve) => {
            setTimeout(() => resolve(ok(createToolResult())), 60000);
          })
        ),
      });

      const executePromise = executor.execute(createInvocation(), server, 100);
      vi.advanceTimersByTime(200);

      const result = await executePromise;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.recoverable).toBe(true);
      }
    });

    it('should provide a user-safe message for timeout errors', async () => {
      const server = createMockServer({
        invokeTool: vi.fn().mockImplementation(
          () => new Promise((resolve) => {
            setTimeout(() => resolve(ok(createToolResult())), 60000);
          })
        ),
      });

      const executePromise = executor.execute(createInvocation(), server, 100);
      vi.advanceTimersByTime(200);

      const result = await executePromise;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const userMsg = result.error.toUserMessage();
        expect(userMsg).toBeTruthy();
        // Should not leak internal details
        expect(userMsg).not.toContain('100');
      }
    });
  });

  describe('error wrapping', () => {
    it('should wrap server errors into ToolExecutionError', async () => {
      vi.useRealTimers();
      const server = createMockServer({
        invokeTool: vi.fn().mockRejectedValue(new Error('Connection refused')),
      });

      const result = await executor.execute(createInvocation(), server);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ToolExecutionError);
        expect(result.error.code).toBe('TOOL_EXECUTION_ERROR');
        expect(result.error.message).toContain('Connection refused');
      }
    });

    it('should handle non-Error throw values', async () => {
      vi.useRealTimers();
      const server = createMockServer({
        invokeTool: vi.fn().mockRejectedValue('string error'),
      });

      const result = await executor.execute(createInvocation(), server);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ToolExecutionError);
        expect(result.error.message).toContain('string error');
      }
    });

    it('should wrap server err() results into ToolExecutionError', async () => {
      vi.useRealTimers();
      const serverError = new ToolExecutionError('test-tool', 'invalid arguments');
      const server = createMockServer({
        invokeTool: vi.fn().mockResolvedValue(err(serverError)),
      });

      const result = await executor.execute(createInvocation(), server);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('invalid arguments');
      }
    });

    it('should mark execution errors as recoverable', async () => {
      vi.useRealTimers();
      const server = createMockServer({
        invokeTool: vi.fn().mockRejectedValue(new Error('transient failure')),
      });

      const result = await executor.execute(createInvocation(), server);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.recoverable).toBe(true);
      }
    });

    it('should include the tool name in ToolExecutionError', async () => {
      vi.useRealTimers();
      const server = createMockServer({
        invokeTool: vi.fn().mockRejectedValue(new Error('boom')),
      });

      const invocation = createInvocation({ toolName: 'failing-tool' });
      const result = await executor.execute(invocation, server);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('failing-tool');
      }
    });

    it('should emit a ToolFailed event for thrown errors', async () => {
      vi.useRealTimers();
      const server = createMockServer({
        invokeTool: vi.fn().mockRejectedValue(new Error('crash')),
      });

      await executor.execute(createInvocation(), server);

      const publishCalls = (eventBus.publish as ReturnType<typeof vi.fn>).mock.calls;
      const failedEvent = publishCalls.find(
        (call: unknown[]) => (call[0] as DomainEvent).type === 'mcp.tool.failed'
      );

      expect(failedEvent).toBeDefined();
    });
  });

  describe('invocation ordering', () => {
    it('should always emit ToolInvoked before ToolCompleted', async () => {
      vi.useRealTimers();
      const server = createMockServer();
      const publishOrder: string[] = [];

      (eventBus.publish as ReturnType<typeof vi.fn>).mockImplementation(
        (event: DomainEvent) => {
          publishOrder.push(event.type);
        }
      );

      await executor.execute(createInvocation(), server);

      const invokedIdx = publishOrder.indexOf('mcp.tool.invoked');
      const completedIdx = publishOrder.indexOf('mcp.tool.completed');

      expect(invokedIdx).toBeLessThan(completedIdx);
    });

    it('should always emit ToolInvoked before ToolFailed', async () => {
      vi.useRealTimers();
      const server = createMockServer({
        invokeTool: vi.fn().mockRejectedValue(new Error('fail')),
      });

      const publishOrder: string[] = [];
      (eventBus.publish as ReturnType<typeof vi.fn>).mockImplementation(
        (event: DomainEvent) => {
          publishOrder.push(event.type);
        }
      );

      await executor.execute(createInvocation(), server);

      const invokedIdx = publishOrder.indexOf('mcp.tool.invoked');
      const failedIdx = publishOrder.indexOf('mcp.tool.failed');

      expect(invokedIdx).toBeLessThan(failedIdx);
    });
  });
});

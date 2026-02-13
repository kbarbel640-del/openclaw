import type { Result } from '../../core/types/result.js';
import { ok, err } from '../../core/types/result.js';
import { DomainEventBus } from '../../core/types/domain-events.js';
import { ToolTimeoutError, ToolExecutionError } from '../domain/errors.js';
import type { ToolInvocation, ToolResult } from '../domain/types.js';
import type { IMcpServerPort } from '../ports/mcp-server-port.js';
import {
  createToolInvokedEvent,
  createToolCompletedEvent,
  createToolFailedEvent,
  createToolTimedOutEvent,
} from '../domain/events.js';

/**
 * Executes tool invocations with timeout and error handling
 */
export class ToolExecutor {
  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly defaultTimeoutMs: number = 30000
  ) {}

  /**
   * Execute a tool invocation with timeout protection
   */
  async execute(
    invocation: ToolInvocation,
    server: IMcpServerPort,
    timeoutMs?: number
  ): Promise<Result<ToolResult, ToolTimeoutError | ToolExecutionError>> {
    const timeout = timeoutMs ?? this.defaultTimeoutMs;

    this.eventBus.publish(createToolInvokedEvent({ invocation }));

    try {
      const result = await this.executeWithTimeout(invocation, server, timeout);

      if (result.ok) {
        this.eventBus.publish(createToolCompletedEvent({ result: result.value }));
        return ok(result.value);
      } else {
        this.eventBus.publish(createToolFailedEvent({
          invocation,
          error: result.error.message,
        }));
        return err(result.error);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        const timeoutError = new ToolTimeoutError(invocation.toolName, timeout);
        this.eventBus.publish(createToolTimedOutEvent({
          invocation,
          timeoutMs: timeout,
        }));
        return err(timeoutError);
      }

      const executionError = new ToolExecutionError(
        invocation.toolName,
        error instanceof Error ? error.message : String(error)
      );

      this.eventBus.publish(createToolFailedEvent({
        invocation,
        error: executionError.message,
      }));

      return err(executionError);
    }
  }

  private async executeWithTimeout(
    invocation: ToolInvocation,
    server: IMcpServerPort,
    timeoutMs: number
  ): Promise<Result<ToolResult, ToolExecutionError>> {
    const startTime = Date.now();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), timeoutMs);
    });

    const executionPromise = server.invokeTool(invocation);

    const result = await Promise.race([executionPromise, timeoutPromise]);

    if (result.ok) {
      const durationMs = Date.now() - startTime;
      const enrichedResult: ToolResult = {
        ...result.value,
        durationMs,
      };
      return ok(enrichedResult);
    }

    return err(new ToolExecutionError(invocation.toolName, result.error.message));
  }
}

import type { Result } from '../../core/types/result.js';
import { ok, err } from '../../core/types/result.js';
import type { TenantIdString } from '../../core/types/tenant-id.js';
import type { ChatMessage, TextBlock, ToolUseBlock, ToolResultBlock } from '../../core/types/messages.js';
import { DomainEventBus } from '../../core/types/domain-events.js';
import type { McpError } from '../domain/errors.js';
import { ToolExecutionError, ToolAccessDeniedError } from '../domain/errors.js';
import type { ConversationTurn, ToolInvocation, ToolResult } from '../domain/types.js';
import type { ILlmPort } from '../ports/llm-port.js';
import { ToolRegistry } from './tool-registry.js';
import { ToolAccessGuard } from './tool-access-guard.js';
import { ToolExecutor } from './tool-executor.js';
import type { ConversationContext } from './conversation-context.js';
import { trimHistory } from './conversation-context.js';
import {
  createConversationStartedEvent,
  createConversationCompletedEvent,
} from '../domain/events.js';

const MAX_TOOL_INVOCATIONS = 10;

/**
 * Orchestrates conversation turns with tool use
 */
export class ConversationOrchestrator {
  constructor(
    private readonly llmPort: ILlmPort,
    private readonly toolRegistry: ToolRegistry,
    private readonly accessGuard: ToolAccessGuard,
    _toolExecutor: ToolExecutor,
    private readonly eventBus: DomainEventBus
  ) {}

  /**
   * Process a complete conversation turn
   * Handles multiple rounds of tool use until LLM returns text
   */
  async processTurn(
    tenantId: TenantIdString,
    userMessage: string,
    context: ConversationContext
  ): Promise<Result<ConversationTurn, McpError>> {
    const startTime = Date.now();
    const toolInvocations: ToolInvocation[] = [];
    const toolResults: ToolResult[] = [];

    this.eventBus.publish(createConversationStartedEvent({
      tenantId,
      sessionId: context.sessionId,
      userMessage,
    }));

    const messages: ChatMessage[] = [
      ...trimHistory(context, this.llmPort.estimateTokens.bind(this.llmPort)),
      {
        role: 'user',
        content: [{ type: 'text', text: userMessage }],
        timestamp: new Date(),
      },
    ];

    const availableTools = this.toolRegistry.listTools();
    let assistantResponse: string | undefined;
    let iterations = 0;

    while (iterations < MAX_TOOL_INVOCATIONS) {
      iterations++;

      const responseBlocks: (TextBlock | ToolUseBlock | ToolResultBlock)[] = [];

      for await (const chunk of this.llmPort.sendMessage(messages, availableTools)) {
        const parsed = this.parseResponseChunk(chunk);
        if (parsed) responseBlocks.push(parsed);
      }

      const textBlock = responseBlocks.find(b => b.type === 'text') as TextBlock | undefined;
      const toolUseBlocks = responseBlocks.filter(b => b.type === 'tool_use') as ToolUseBlock[];

      if (textBlock) {
        assistantResponse = textBlock.text;
        break;
      }

      if (toolUseBlocks.length === 0) {
        break;
      }

      messages.push({
        role: 'assistant',
        content: toolUseBlocks,
        timestamp: new Date(),
      });

      const toolResultBlocks: ToolResultBlock[] = [];

      for (const toolUse of toolUseBlocks) {
        const invocation: ToolInvocation = {
          toolName: toolUse.toolName,
          arguments: toolUse.arguments,
          tenantId,
          sessionId: context.sessionId,
          invocationId: toolUse.toolUseId,
          timestamp: new Date(),
        };

        toolInvocations.push(invocation);

        const result = await this.executeTool(invocation, context);

        if (result.ok) {
          toolResults.push(result.value);
          toolResultBlocks.push({
            type: 'tool_result',
            toolUseId: toolUse.toolUseId,
            content: result.value.content,
            isError: false,
          });
        } else {
          toolResultBlocks.push({
            type: 'tool_result',
            toolUseId: toolUse.toolUseId,
            content: result.error.message,
            isError: true,
          });
        }
      }

      messages.push({
        role: 'user',
        content: toolResultBlocks,
        timestamp: new Date(),
      });
    }

    const completedAt = new Date();
    const durationMs = Date.now() - startTime;

    this.eventBus.publish(createConversationCompletedEvent({
      tenantId,
      sessionId: context.sessionId,
      durationMs,
      toolInvocationCount: toolInvocations.length,
    }));

    const turn: ConversationTurn = {
      tenantId,
      userMessage,
      assistantResponse,
      toolInvocations,
      toolResults,
      startedAt: new Date(startTime),
      completedAt,
    };

    return ok(turn);
  }

  private async executeTool(
    invocation: ToolInvocation,
    context: ConversationContext
  ): Promise<Result<ToolResult, ToolExecutionError | ToolAccessDeniedError>> {
    const tool = this.toolRegistry.findTool(invocation.toolName);
    if (!tool) {
      return err(new ToolExecutionError(invocation.toolName, 'Tool not found'));
    }

    const accessResult = this.accessGuard.checkAccess(context.tier, tool);
    if (!accessResult.ok) {
      return err(accessResult.error);
    }

    const server = this.toolRegistry.getServer(invocation.toolName);
    if (!server) {
      return err(new ToolExecutionError(invocation.toolName, 'Server not found'));
    }

    return ok({
      invocationId: invocation.invocationId,
      toolName: invocation.toolName,
      content: 'Tool execution not yet implemented',
      isError: false,
      durationMs: 0,
    });
  }

  private parseResponseChunk(chunk: string): TextBlock | ToolUseBlock | undefined {
    try {
      const parsed = JSON.parse(chunk);
      return parsed;
    } catch {
      return undefined;
    }
  }
}

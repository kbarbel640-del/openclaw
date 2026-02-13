import { createEvent, type DomainEvent } from '../../core/types/domain-events.js';
import type { TenantIdString } from '../../core/types/tenant-id.js';
import type { ToolInvocation, ToolResult } from './types.js';

export interface ToolInvokedPayload {
  readonly invocation: ToolInvocation;
}

export interface ToolCompletedPayload {
  readonly result: ToolResult;
}

export interface ToolFailedPayload {
  readonly invocation: ToolInvocation;
  readonly error: string;
}

export interface ToolTimedOutPayload {
  readonly invocation: ToolInvocation;
  readonly timeoutMs: number;
}

export interface ConversationStartedPayload {
  readonly tenantId: TenantIdString;
  readonly sessionId: string;
  readonly userMessage: string;
}

export interface ConversationCompletedPayload {
  readonly tenantId: TenantIdString;
  readonly sessionId: string;
  readonly durationMs: number;
  readonly toolInvocationCount: number;
}

export const createToolInvokedEvent = (payload: ToolInvokedPayload): DomainEvent<ToolInvokedPayload> =>
  createEvent('mcp.tool.invoked', payload, 'mcp');

export const createToolCompletedEvent = (payload: ToolCompletedPayload): DomainEvent<ToolCompletedPayload> =>
  createEvent('mcp.tool.completed', payload, 'mcp');

export const createToolFailedEvent = (payload: ToolFailedPayload): DomainEvent<ToolFailedPayload> =>
  createEvent('mcp.tool.failed', payload, 'mcp');

export const createToolTimedOutEvent = (payload: ToolTimedOutPayload): DomainEvent<ToolTimedOutPayload> =>
  createEvent('mcp.tool.timedout', payload, 'mcp');

export const createConversationStartedEvent = (payload: ConversationStartedPayload): DomainEvent<ConversationStartedPayload> =>
  createEvent('mcp.conversation.started', payload, 'mcp');

export const createConversationCompletedEvent = (payload: ConversationCompletedPayload): DomainEvent<ConversationCompletedPayload> =>
  createEvent('mcp.conversation.completed', payload, 'mcp');

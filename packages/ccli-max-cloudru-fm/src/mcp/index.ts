// Domain types
export type {
  ToolDefinition,
  ToolCategory,
  ToolInvocation,
  ToolResult,
  McpServerConfig,
  ConversationTurn,
} from './domain/types.js';

// Domain errors
export {
  McpError,
  ToolNotFoundError,
  ToolAccessDeniedError,
  ToolTimeoutError,
  ToolExecutionError,
  McpConnectionError,
} from './domain/errors.js';

// Domain events
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
} from './domain/events.js';

// Ports
export type { IMcpServerPort } from './ports/mcp-server-port.js';
export type { ILlmPort } from './ports/llm-port.js';

// Application services
export { ToolRegistry, type ToolFilter } from './application/tool-registry.js';
export { ToolAccessGuard } from './application/tool-access-guard.js';
export { ToolExecutor } from './application/tool-executor.js';
export { ConversationOrchestrator } from './application/conversation-orchestrator.js';
export {
  type ConversationContext,
  type CreateContextParams,
  createContext,
  trimHistory,
} from './application/conversation-context.js';

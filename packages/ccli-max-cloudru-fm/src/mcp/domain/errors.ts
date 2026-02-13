import { OpenClawError } from '../../core/types/errors.js';

export class McpError extends OpenClawError {
  readonly code = 'MCP_ERROR' as const;
  readonly recoverable = true;

  toUserMessage(): string {
    return 'MCP processing error. Please try again.';
  }
}

export class ToolNotFoundError extends OpenClawError {
  readonly code = 'TOOL_NOT_FOUND' as const;
  readonly recoverable = true;

  constructor(toolName: string) {
    super(`Tool '${toolName}' not found in registry`);
  }

  toUserMessage(): string {
    return 'The requested tool is not available.';
  }
}

export class ToolAccessDeniedError extends OpenClawError {
  readonly code = 'TOOL_ACCESS_DENIED' as const;
  readonly recoverable = false;

  constructor(toolName: string, requiredTier: string, actualTier: string) {
    super(`Access denied to tool '${toolName}': requires ${requiredTier}, tenant has ${actualTier}`);
  }

  toUserMessage(): string {
    return 'You do not have permission to use this tool. Please upgrade your access tier.';
  }
}

export class ToolTimeoutError extends OpenClawError {
  readonly code = 'TOOL_TIMEOUT' as const;
  readonly recoverable = true;

  constructor(toolName: string, timeoutMs: number) {
    super(`Tool '${toolName}' timed out after ${timeoutMs}ms`);
  }

  toUserMessage(): string {
    return 'The tool execution timed out. Please try again.';
  }
}

export class ToolExecutionError extends OpenClawError {
  readonly code = 'TOOL_EXECUTION_ERROR' as const;
  readonly recoverable = true;

  constructor(toolName: string, reason: string) {
    super(`Tool '${toolName}' execution failed: ${reason}`);
  }

  toUserMessage(): string {
    return 'Tool execution failed. Please check your input and try again.';
  }
}

export class McpConnectionError extends OpenClawError {
  readonly code = 'MCP_CONNECTION_ERROR' as const;
  readonly recoverable = true;

  constructor(serverId: string, reason: string) {
    super(`Failed to connect to MCP server '${serverId}': ${reason}`);
  }

  toUserMessage(): string {
    return 'Failed to connect to the tool server. Please try again later.';
  }
}

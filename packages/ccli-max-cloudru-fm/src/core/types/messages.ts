/**
 * Content block types supported in chat messages.
 */
export type ContentBlockType = 'text' | 'tool_use' | 'tool_result' | 'image';

/**
 * Plain text content block.
 */
export interface TextBlock {
  readonly type: 'text';
  readonly text: string;
}

/**
 * Tool invocation request block.
 */
export interface ToolUseBlock {
  readonly type: 'tool_use';
  readonly toolName: string;
  readonly arguments: Record<string, unknown>;
  readonly toolUseId: string;
}

/**
 * Tool execution result block.
 */
export interface ToolResultBlock {
  readonly type: 'tool_result';
  readonly toolUseId: string;
  readonly content: string;
  readonly isError: boolean;
}

/**
 * Union type of all supported content blocks.
 */
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

/**
 * Chat message with role-based content and timestamp.
 */
export interface ChatMessage {
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: ContentBlock[];
  readonly timestamp: Date;
}

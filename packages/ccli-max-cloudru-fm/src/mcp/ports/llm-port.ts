import type { ChatMessage } from '../../core/types/messages.js';
import type { ToolDefinition } from '../domain/types.js';

/**
 * Port for interacting with LLM providers
 * Adapters implement actual provider-specific APIs (Anthropic, OpenAI, etc.)
 */
export interface ILlmPort {
  /**
   * Send messages to LLM and stream back response
   * @param messages - Conversation history
   * @param tools - Available tools for this turn
   * @returns Async iterable of response chunks
   */
  sendMessage(
    messages: ChatMessage[],
    tools: ToolDefinition[]
  ): AsyncIterable<string>;

  /**
   * Estimate token count for text
   * Used for conversation history trimming
   */
  estimateTokens(text: string): number;
}

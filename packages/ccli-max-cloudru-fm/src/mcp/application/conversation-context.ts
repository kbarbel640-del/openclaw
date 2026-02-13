import type { TenantIdString } from '../../core/types/tenant-id.js';
import type { AccessTier } from '../../core/types/access-tier.js';
import type { ChatMessage } from '../../core/types/messages.js';

export interface ConversationContext {
  readonly sessionId: string;
  readonly tenantId: TenantIdString;
  readonly tier: AccessTier;
  readonly history: ChatMessage[];
  readonly maxHistoryTokens: number;
}

export interface CreateContextParams {
  readonly sessionId: string;
  readonly tenantId: TenantIdString;
  readonly tier: AccessTier;
  readonly history?: ChatMessage[];
  readonly maxHistoryTokens?: number;
}

/**
 * Create a new conversation context
 */
export function createContext(params: CreateContextParams): ConversationContext {
  return {
    sessionId: params.sessionId,
    tenantId: params.tenantId,
    tier: params.tier,
    history: params.history ?? [],
    maxHistoryTokens: params.maxHistoryTokens ?? 100000,
  };
}

/**
 * Trim conversation history to fit within token budget
 * Keeps most recent messages, removes oldest first
 */
export function trimHistory(
  ctx: ConversationContext,
  estimateTokens: (text: string) => number
): ChatMessage[] {
  const messages = [...ctx.history];
  let totalTokens = messages.reduce((sum, msg) => {
    const content = msg.content
      .map(block => 'text' in block ? block.text : JSON.stringify(block))
      .join(' ');
    return sum + estimateTokens(content);
  }, 0);

  while (totalTokens > ctx.maxHistoryTokens && messages.length > 1) {
    const removed = messages.shift();
    if (removed) {
      const content = removed.content
        .map(block => 'text' in block ? block.text : JSON.stringify(block))
        .join(' ');
      totalTokens -= estimateTokens(content);
    }
  }

  return messages;
}

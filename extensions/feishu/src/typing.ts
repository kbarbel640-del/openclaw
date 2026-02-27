import type { ClawdbotConfig } from "openclaw/plugin-sdk";
import { resolveFeishuAccount } from "./accounts.js";
import { createFeishuClient } from "./client.js";

// Feishu emoji types for typing indicator
// See: https://open.feishu.cn/document/server-docs/im-v1/message-reaction/emojis-introduce
// Full list: https://github.com/go-lark/lark/blob/main/emoji.go
const TYPING_EMOJI = "Typing"; // Typing indicator emoji

export type TypingIndicatorState = {
  messageId: string;
  reactionId: string | null;
};

/**
 * Add a typing indicator (reaction) to a message
 */
export async function addTypingIndicator(params: {
  cfg: ClawdbotConfig;
  messageId: string;
  accountId?: string;
}): Promise<TypingIndicatorState> {
  const { cfg, messageId, accountId } = params;
  const account = resolveFeishuAccount({ cfg, accountId });
  if (!account.configured) {
    return { messageId, reactionId: null };
  }

  const client = createFeishuClient(account);

  try {
    const response = await client.im.messageReaction.create({
      path: { message_id: messageId },
      data: {
        reaction_type: { emoji_type: TYPING_EMOJI },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK response type
    const reactionId = (response as any)?.data?.reaction_id ?? null;
    return { messageId, reactionId };
  } catch (err) {
    // Re-throw rate-limit / quota errors so the circuit breaker in
    // typing-start-guard can trip and stop the keepalive loop (#28062).
    if (isRateLimitError(err)) {
      throw err;
    }
    // Silently fail for other non-critical errors (e.g. message deleted)
    console.log(`[feishu] failed to add typing indicator: ${err}`);
    return { messageId, reactionId: null };
  }
}

/**
 * Remove a typing indicator (reaction) from a message
 */
export async function removeTypingIndicator(params: {
  cfg: ClawdbotConfig;
  state: TypingIndicatorState;
  accountId?: string;
}): Promise<void> {
  const { cfg, state, accountId } = params;
  if (!state.reactionId) {
    return;
  }

  const account = resolveFeishuAccount({ cfg, accountId });
  if (!account.configured) {
    return;
  }

  const client = createFeishuClient(account);

  try {
    await client.im.messageReaction.delete({
      path: {
        message_id: state.messageId,
        reaction_id: state.reactionId,
      },
    });
  } catch (err) {
    // Re-throw rate-limit / quota errors so the circuit breaker can trip (#28062).
    if (isRateLimitError(err)) {
      throw err;
    }
    // Silently fail for other non-critical errors
    console.log(`[feishu] failed to remove typing indicator: ${err}`);
  }
}

/**
 * Detect Feishu rate-limit or quota-exceeded errors (HTTP 429 / error code 99991403).
 * These must propagate to the circuit breaker to stop the keepalive loop.
 */
function isRateLimitError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) {
    return false;
  }
  const response = (err as Record<string, unknown>).response as Record<string, unknown> | undefined;
  if (!response) {
    return false;
  }
  if (response.status === 429) {
    return true;
  }
  const data = response.data as Record<string, unknown> | undefined;
  return data?.code === 99991403;
}

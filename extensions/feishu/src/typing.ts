import type { ClawdbotConfig } from "openclaw/plugin-sdk";
import { resolveFeishuAccount } from "./accounts.js";
import { createFeishuClient } from "./client.js";

// Feishu emoji types for typing indicator
// See: https://open.feishu.cn/document/server-docs/im-v1/message-reaction/emojis-introduce
// Full list: https://github.com/go-lark/lark/blob/main/emoji.go
const TYPING_EMOJI = "Typing"; // Typing indicator emoji

/** Feishu error code: the target message was not found (deleted or expired). */
const FEISHU_ERROR_MESSAGE_NOT_FOUND = 231003;

export type TypingIndicatorState = {
  messageId: string;
  reactionId: string | null;
};

/**
 * Returns true when the Feishu API error indicates the message no longer
 * exists (code 231003). In that case the caller should stop retrying.
 */
export function isFeishuMessageNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  // Feishu SDK wraps Axios errors: err.response.data carries the API error body.
  const data = (err as { response?: { data?: unknown } }).response?.data;
  if (data && typeof data === "object") {
    const code = (data as { code?: number }).code;
    if (code === FEISHU_ERROR_MESSAGE_NOT_FOUND) return true;
  }
  // Some SDK versions also expose the code at the top level.
  if ((err as { code?: number }).code === FEISHU_ERROR_MESSAGE_NOT_FOUND) return true;
  return false;
}

/**
 * Add a typing indicator (reaction) to a message.
 * Throws on failure so callers can decide how to handle it (e.g. disable
 * retries when the message no longer exists).
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

  const response = await client.im.messageReaction.create({
    path: { message_id: messageId },
    data: {
      reaction_type: { emoji_type: TYPING_EMOJI },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK response type
  const reactionId = (response as any)?.data?.reaction_id ?? null;
  return { messageId, reactionId };
}

/**
 * Remove a typing indicator (reaction) from a message.
 * Throws on failure so callers can log via the structured error path.
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

  await client.im.messageReaction.delete({
    path: {
      message_id: state.messageId,
      reaction_id: state.reactionId,
    },
  });
}

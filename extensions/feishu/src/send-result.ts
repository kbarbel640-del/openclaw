export type FeishuMessageApiResponse = {
  code?: number;
  msg?: string;
  data?: {
    message_id?: string;
  };
};

export function assertFeishuMessageApiSuccess(
  response: FeishuMessageApiResponse,
  errorPrefix: string,
) {
  if (response.code !== 0) {
    throw new Error(`${errorPrefix}: ${response.msg || `code ${response.code}`}`);
  }
}

/**
 * Detect whether the Feishu API error indicates the target message no longer
 * exists — either withdrawn by the sender (230011) or deleted/not found (231003).
 * Callers use this to fall back to a direct send instead of silently dropping
 * the reply.
 */
export function isFeishuMessageGoneError(response: FeishuMessageApiResponse): boolean {
  return response.code === 230011 || response.code === 231003;
}

export function toFeishuSendResult(
  response: FeishuMessageApiResponse,
  chatId: string,
): {
  messageId: string;
  chatId: string;
} {
  return {
    messageId: response.data?.message_id ?? "unknown",
    chatId,
  };
}

import { sleep } from "../infra/sleep.js";

export type TelegramSendChatActionLogger = (message: string) => void;

type SendChatActionFn = (
  chatId: number | string,
  action: string,
  threadParams?: unknown,
) => Promise<void>;

export type TelegramSendChatActionHandler = {
  sendChatAction: () => Promise<void>;
  isSuspended: () => boolean;
  reset: () => void;
};

export type CreateTelegramSendChatActionHandlerParams = {
  sendChatActionFn: SendChatActionFn;
  logger: TelegramSendChatActionLogger;
  chatId: number | string;
  action: string;
  threadParams?: unknown;
  maxRetries?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
};

function is401Error(error: unknown): boolean {
  if (!error) {
    return false;
  }
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  return message.includes("401") || message.toLowerCase().includes("unauthorized");
}

export function createTelegramSendChatActionHandler({
  sendChatActionFn,
  logger,
  chatId,
  action,
  threadParams,
  maxRetries = 10,
  baseBackoffMs = 1000,
  maxBackoffMs = 300000, // 5 minutes
}: CreateTelegramSendChatActionHandlerParams): TelegramSendChatActionHandler {
  let consecutive401Failures = 0;
  let isSuspended = false;

  const getBackoffDelayMs = (attemptNumber: number): number => {
    const exponentialBackoff = baseBackoffMs * Math.pow(2, attemptNumber - 1);
    return Math.min(exponentialBackoff, maxBackoffMs);
  };

  const reset = () => {
    consecutive401Failures = 0;
    isSuspended = false;
  };

  const sendChatAction = async (): Promise<void> => {
    // If suspended, don't make the API call
    if (isSuspended) {
      logger(
        `Telegram sendChatAction skipped for chat ${chatId}: channel suspended due to repeated 401 errors. ` +
          `Token may be invalid. Use 'openclaw channels restart telegram' to resume.`,
      );
      return;
    }

    // Apply backoff if we have previous 401 failures
    if (consecutive401Failures > 0) {
      const backoffMs = getBackoffDelayMs(consecutive401Failures);
      logger(
        `Telegram sendChatAction backoff: waiting ${backoffMs}ms before retry (attempt ${consecutive401Failures + 1})`,
      );
      await sleep(backoffMs);
    }

    try {
      await sendChatActionFn(chatId, action, threadParams);
      // Success - reset failure count
      if (consecutive401Failures > 0) {
        logger(`Telegram sendChatAction recovered after ${consecutive401Failures} failures`);
        consecutive401Failures = 0;
      }
    } catch (error) {
      if (is401Error(error)) {
        consecutive401Failures++;

        if (consecutive401Failures >= maxRetries) {
          isSuspended = true;
          logger(
            `CRITICAL: Telegram channel suspended due to repeated 401 errors (${consecutive401Failures} consecutive failures). ` +
              `Bot token is likely invalid and needs to be replaced. Telegram may DELETE the bot if this continues. ` +
              `Use 'openclaw channels restart telegram' to resume after fixing the token.`,
          );
        } else {
          logger(
            `Telegram sendChatAction 401 error ${consecutive401Failures}/${maxRetries}: ${String(error)}. ` +
              `Will retry with exponential backoff.`,
          );
        }
      } else {
        // Non-401 error - don't count towards suspension but still log
        logger(`Telegram sendChatAction failed (non-401): ${String(error)}`);
      }

      throw error;
    }
  };

  return {
    sendChatAction,
    isSuspended: () => isSuspended,
    reset,
  };
}

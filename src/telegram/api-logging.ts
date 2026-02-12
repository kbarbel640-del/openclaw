import type { RuntimeEnv } from "../runtime.js";
import { danger } from "../globals.js";
import { formatErrorMessage } from "../infra/errors.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

export type TelegramApiLogger = (message: string) => void;

type TelegramApiLoggingParams<T> = {
  operation: string;
  fn: () => Promise<T>;
  runtime?: RuntimeEnv;
  logger?: TelegramApiLogger;
  shouldLog?: (err: unknown) => boolean;
};

const fallbackLogger = createSubsystemLogger("telegram/api");
const REACTION_NOT_FOUND_RE = /message to react not found|message not found/i;

function resolveTelegramApiLogger(runtime?: RuntimeEnv, logger?: TelegramApiLogger) {
  if (logger) {
    return logger;
  }
  if (runtime?.error) {
    return runtime.error;
  }
  return (message: string) => fallbackLogger.error(message);
}

export async function withTelegramApiErrorLogging<T>({
  operation,
  fn,
  runtime,
  logger,
  shouldLog,
}: TelegramApiLoggingParams<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!shouldLog || shouldLog(err)) {
      const errText = formatErrorMessage(err);
      // Suppress benign reaction-not-found errors (message deleted or too old).
      const isReactionOperation = operation === "setMessageReaction" || operation === "reaction";
      if (isReactionOperation && REACTION_NOT_FOUND_RE.test(errText)) {
        // do not log
      } else {
        const log = resolveTelegramApiLogger(runtime, logger);
        log(danger(`telegram ${operation} failed: ${errText}`));
      }
    }
    throw err;
  }
}

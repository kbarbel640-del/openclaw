import { loadConfig } from "../config/config.js";
import { resolveStorePath } from "../config/sessions/paths.js";
import { updateSessionStore } from "../config/sessions/store.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("telegram/session-cache");

/**
 * Clear stale thread IDs from session cache when Telegram "thread not found"
 * errors occur and are successfully retried without the thread ID.
 * This prevents future cron jobs from repeatedly using the same stale thread ID.
 */
export async function clearStaleThreadIdFromSession(params: {
  chatId?: string | number;
}): Promise<void> {
  if (!params.chatId) {
    return;
  }

  try {
    const cfg = loadConfig();
    const storePath = resolveStorePath(cfg.session?.store);

    const result = await updateSessionStore(storePath, (store) => {
      let modified = false;

      // Find sessions that have this chat ID in their delivery context
      // and clear the thread ID to prevent reuse of stale thread IDs
      for (const [sessionKey, entry] of Object.entries(store)) {
        if (entry.lastTo === String(params.chatId) && entry.lastThreadId != null) {
          log.debug(
            `Clearing stale thread ID for session ${sessionKey} targeting ${params.chatId}`,
          );
          entry.lastThreadId = undefined;
          if (entry.deliveryContext?.threadId != null) {
            entry.deliveryContext.threadId = undefined;
          }
          modified = true;
        }
      }

      return modified;
    });

    if (result) {
      log.info(`Cleared stale thread IDs for chat ${params.chatId}`);
    }
  } catch (err) {
    log.warn(`Failed to clear stale thread ID for chat ${params.chatId}: ${err}`);
  }
}

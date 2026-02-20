import { logVerbose } from "../../globals.js";
import type { DiscordUserRawMessage, DiscordUserMessageHandlerParams } from "./message-handler.js";
import { handleDiscordUserMessage } from "./message-handler.js";

export type DiscordUserEventHandlerParams = DiscordUserMessageHandlerParams;

/**
 * Dispatch a gateway event to the appropriate handler.
 * Phase 1: only MESSAGE_CREATE is handled.
 */
export async function handleDiscordUserEvent(
  event: string,
  data: unknown,
  params: DiscordUserEventHandlerParams,
): Promise<void> {
  switch (event) {
    case "MESSAGE_CREATE": {
      const message = data as DiscordUserRawMessage;
      if (!message?.id || !message?.author) {
        logVerbose("discord-user: drop MESSAGE_CREATE (missing id or author)");
        return;
      }
      try {
        await handleDiscordUserMessage(message, params);
      } catch (err) {
        params.runtime.error(
          `discord-user: message handler error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      break;
    }
    default:
      // Future: GUILD_CREATE, MESSAGE_UPDATE, etc.
      break;
  }
}

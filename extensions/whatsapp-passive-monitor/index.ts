import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { createMessageDb, type MessageDb } from "./src/db.js";
import { createDebounceManager, type DebounceManager } from "./src/debounce.js";
import { DEFAULT_CONFIG, type PluginConfig } from "./src/types.js";

export default function register(api: OpenClawPluginApi) {
  const raw = (api.pluginConfig ?? {}) as Partial<PluginConfig>;
  const config: PluginConfig = { ...DEFAULT_CONFIG, ...raw };

  // Resolve DB path relative to openclaw workspace
  const resolvedDbPath = api.resolvePath(`~/.openclaw/workspace/${config.dbPath}`);

  let db: MessageDb;
  try {
    db = createMessageDb(resolvedDbPath);
  } catch (err) {
    api.logger.error?.(`whatsapp-passive-monitor: failed to open SQLite: ${String(err)}`);
    return;
  }

  // Debounce callback — placeholder for Part 3/4 (detector pipeline)
  const onDebouncefire = (conversationId: string) => {
    const messages = db.getConversationContext(conversationId, config.contextMessageLimit);
    api.logger.info?.(
      `whatsapp-passive-monitor: debounce fired for ${conversationId}, ${messages.length} messages in context`,
    );
    // Part 3/4 will wire: detector registry → pre-processor → trigger
  };

  const debounce: DebounceManager = createDebounceManager(config.debounceMs, onDebouncefire);

  // ---- message_received hook ----
  // For WhatsApp: store in SQLite, reset debounce, return { handled: true }
  // For non-WhatsApp: pass through (return void)
  api.on("message_received", async (event, ctx) => {
    if (ctx.channelId !== "whatsapp") return;

    db.insertMessage({
      conversation_id: ctx.conversationId ?? event.from,
      sender: event.from,
      sender_name: (event.metadata?.senderName as string) ?? null,
      content: event.content,
      timestamp: event.timestamp ?? Date.now(),
      direction: "inbound",
      channel_id: "whatsapp",
    });

    debounce.touch(ctx.conversationId ?? event.from);

    // Cancel agent dispatch for WhatsApp messages
    return { handled: true };
  });

  // ---- message_sent hook ----
  // Capture outbound replies for full conversation context
  api.on("message_sent", async (event, ctx) => {
    if (ctx.channelId !== "whatsapp") return;

    db.insertMessage({
      conversation_id: ctx.conversationId ?? event.to,
      sender: "me",
      sender_name: null,
      content: event.content,
      timestamp: Date.now(),
      direction: "outbound",
      channel_id: "whatsapp",
    });
  });
}

import type { OpenClawPluginApi } from "../../src/plugins/types.js";
import type { ChannelMessages, TgMessage } from "./types.js";
import { chunkMarkdownText } from "../../src/auto-reply/chunk.js";
import {
  parseDigestArgs,
  parseChannelArgs,
  parseTopicsArgs,
  parseTopArgs,
  periodToMs,
} from "./parse-args.js";
import { summarize, formatFallback } from "./summarize.js";
import { TelegramDigestClient, resolveTgConfig } from "./tg-client.js";

/** Maximum response length before chunking for Telegram. */
const MAX_RESPONSE_CHARS = 3900;

// ---------------------------------------------------------------------------
// Error sanitization
// ---------------------------------------------------------------------------

/** Strip session tokens and long base64 strings from error messages. */
function sanitizeErrorMessage(msg: string): string {
  let s = msg;
  s = s.replace(/[A-Za-z0-9+/=]{50,}/g, "[SESSION_REDACTED]");
  s = s.replace(/Bearer\s+\S+/g, "Bearer [REDACTED]");
  return s;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Chunk and return response, paginating if needed. */
function chunkResponse(text: string): { text: string } {
  if (text.length > MAX_RESPONSE_CHARS) {
    const chunks = chunkMarkdownText(text, MAX_RESPONSE_CHARS);
    return { text: `${chunks[0]}\n\n(Part 1/${chunks.length})` };
  }
  return { text };
}

/** Read LLM provider/model config from plugin config. */
function readLlmConfig(api: OpenClawPluginApi) {
  const pc = api.pluginConfig as Record<string, unknown> | undefined;
  return {
    config: api.config,
    model: pc?.model as string | undefined,
    provider: pc?.provider as string | undefined,
    language: pc?.language as string | undefined,
  };
}

/** Resolve config and create a connected client. */
async function withClient<T>(
  api: OpenClawPluginApi,
  fn: (client: TelegramDigestClient) => Promise<T>,
): Promise<T> {
  const pc = api.pluginConfig as { channels?: string[]; maxMessages?: number } | undefined;
  const config = resolveTgConfig(pc);
  const client = new TelegramDigestClient(config);

  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.disconnect();
  }
}

// ---------------------------------------------------------------------------
// Plugin registration
// ---------------------------------------------------------------------------

export default function register(api: OpenClawPluginApi) {
  // ── /tg_digest [period] ─────────────────────────────────────────────
  api.registerCommand({
    name: "tg_digest",
    description:
      "Telegram channel digest. Usage: /tg_digest [period]\n" +
      "Examples: /tg_digest, /tg_digest 7d, /tg_digest 2w",
    acceptsArgs: true,
    requireAuth: true,
    handler: async (ctx) => {
      const args = parseDigestArgs(ctx.args ?? "");
      const ms = periodToMs(args.period);

      try {
        const channelMessages = await withClient(api, (client) => client.getAllChannelMessages(ms));

        const allMessages = channelMessages.flatMap((cm) => cm.messages);
        if (allMessages.length === 0) {
          return {
            text:
              `No messages found in the last ${args.period}.` +
              "\n\nTry widening the period: /tg_digest 7d",
          };
        }

        const llmOpts = readLlmConfig(api);
        const summary = await summarize("digest", channelMessages, llmOpts);
        return chunkResponse(summary);
      } catch (err) {
        return { text: sanitizeErrorMessage((err as Error).message) };
      }
    },
  });

  // ── /tg_channel <name> [period] ─────────────────────────────────────
  api.registerCommand({
    name: "tg_channel",
    description:
      "Detailed channel summary. Usage: /tg_channel <name> [period]\n" +
      "Examples: /tg_channel @durov 3d, /tg_channel @telegram 1w",
    acceptsArgs: true,
    requireAuth: true,
    handler: async (ctx) => {
      const args = parseChannelArgs(ctx.args ?? "");

      if (!args.channel) {
        return {
          text: "Please specify a channel name.\nUsage: /tg_channel @channel_name [period]",
        };
      }

      const ms = periodToMs(args.period);

      try {
        const messages = await withClient(api, (client) =>
          client.getChannelMessages(args.channel, ms),
        );

        if (messages.length === 0) {
          return {
            text:
              `No messages found in ${args.channel} for the last ${args.period}.` +
              `\n\nTry widening the period: /tg_channel ${args.channel} 7d`,
          };
        }

        const channelMessages: ChannelMessages[] = [{ channel: args.channel, messages }];

        const llmOpts = readLlmConfig(api);
        const summary = await summarize("channel", channelMessages, llmOpts);
        return chunkResponse(summary);
      } catch (err) {
        return { text: sanitizeErrorMessage((err as Error).message) };
      }
    },
  });

  // ── /tg_topics [period] ─────────────────────────────────────────────
  api.registerCommand({
    name: "tg_topics",
    description:
      "Most discussed topics across channels. Usage: /tg_topics [period]\n" +
      "Examples: /tg_topics, /tg_topics 1w",
    acceptsArgs: true,
    requireAuth: true,
    handler: async (ctx) => {
      const args = parseTopicsArgs(ctx.args ?? "");
      const ms = periodToMs(args.period);

      try {
        const channelMessages = await withClient(api, (client) => client.getAllChannelMessages(ms));

        const allMessages = channelMessages.flatMap((cm) => cm.messages);
        if (allMessages.length === 0) {
          return {
            text:
              `No messages found in the last ${args.period}.` +
              "\n\nTry widening the period: /tg_topics 7d",
          };
        }

        const llmOpts = readLlmConfig(api);
        const summary = await summarize("topics", channelMessages, llmOpts);
        return chunkResponse(summary);
      } catch (err) {
        return { text: sanitizeErrorMessage((err as Error).message) };
      }
    },
  });

  // ── /tg_top [N] [period] ────────────────────────────────────────────
  api.registerCommand({
    name: "tg_top",
    description:
      "Top posts by engagement. Usage: /tg_top [N] [period]\n" +
      "Examples: /tg_top, /tg_top 5 7d, /tg_top 20",
    acceptsArgs: true,
    requireAuth: true,
    handler: async (ctx) => {
      const args = parseTopArgs(ctx.args ?? "");
      const ms = periodToMs(args.period);

      try {
        const channelMessages = await withClient(api, (client) => client.getAllChannelMessages(ms));

        // Flatten and sort by total engagement, take top N
        const allMessages = channelMessages
          .flatMap((cm) => cm.messages)
          .sort(
            (a, b) =>
              b.views +
              b.forwards +
              b.replies +
              b.reactions -
              (a.views + a.forwards + a.replies + a.reactions),
          )
          .slice(0, args.count);

        if (allMessages.length === 0) {
          return {
            text:
              `No messages found in the last ${args.period}.` +
              "\n\nTry widening the period: /tg_top 7d",
          };
        }

        // Re-wrap as ChannelMessages for the summarizer
        const topByChannel = groupByChannel(allMessages);
        const llmOpts = readLlmConfig(api);
        const summary = await summarize("top", topByChannel, llmOpts);
        return chunkResponse(summary);
      } catch (err) {
        return { text: sanitizeErrorMessage((err as Error).message) };
      }
    },
  });
}

/** Group messages by channel name. */
function groupByChannel(messages: TgMessage[]): ChannelMessages[] {
  const map = new Map<string, TgMessage[]>();
  for (const msg of messages) {
    const list = map.get(msg.channel) ?? [];
    list.push(msg);
    map.set(msg.channel, list);
  }
  return Array.from(map.entries()).map(([channel, msgs]) => ({
    channel,
    messages: msgs,
  }));
}

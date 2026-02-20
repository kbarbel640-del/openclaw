import { chunkDiscordText } from "../discord/chunk.js";
import type { DiscordSendResult } from "../discord/send.types.js";
import { parseDiscordTarget } from "../discord/targets.js";
import type { DiscordUserRestClient } from "./rest.js";

const DISCORD_MAX_CHARS = 2000;
const SUPPRESS_NOTIFICATIONS_FLAG = 1 << 12;

export type DiscordUserSendOpts = {
  rest: DiscordUserRestClient;
  replyTo?: string;
  silent?: boolean;
};

type DiscordMessagePayload = {
  content: string;
  message_reference?: { message_id: string };
  flags?: number;
};

/**
 * Create or fetch an existing DM channel for a user.
 */
async function resolveDmChannelId(rest: DiscordUserRestClient, userId: string): Promise<string> {
  const res = await rest.post("/users/@me/channels", { recipient_id: userId });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to create DM channel for user ${userId}: ${res.status} ${body}`);
  }
  const json = (await res.json()) as { id: string };
  return json.id;
}

/**
 * Resolve a target string to a Discord channel ID.
 * Supports "channel:ID", "user:ID", "<@ID>", and raw numeric IDs.
 */
async function resolveTargetChannelId(rest: DiscordUserRestClient, to: string): Promise<string> {
  const target = parseDiscordTarget(to, { defaultKind: "channel" });
  if (!target) {
    throw new Error(`Cannot resolve Discord target: ${to}`);
  }
  if (target.kind === "user") {
    return resolveDmChannelId(rest, target.id);
  }
  return target.id;
}

/**
 * Send a text message via a user account's REST client.
 * Handles text chunking and reply references.
 */
export async function sendDiscordUserMessage(
  to: string,
  text: string,
  opts: DiscordUserSendOpts,
): Promise<DiscordSendResult> {
  const { rest, replyTo, silent } = opts;
  const channelId = await resolveTargetChannelId(rest, to);
  const chunks = chunkDiscordText(text, { maxChars: DISCORD_MAX_CHARS });

  if (chunks.length === 0) {
    chunks.push(text || "\u200b"); // zero-width space for empty messages
  }

  let lastResult: DiscordSendResult = { messageId: "unknown", channelId };

  for (let i = 0; i < chunks.length; i++) {
    const payload: DiscordMessagePayload = {
      content: chunks[i],
    };

    // Reply reference only on the first chunk
    if (i === 0 && replyTo) {
      payload.message_reference = { message_id: replyTo };
    }

    if (silent) {
      payload.flags = SUPPRESS_NOTIFICATIONS_FLAG;
    }

    const res = await rest.post(`/channels/${channelId}/messages`, payload);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Failed to send message to channel ${channelId}: ${res.status} ${body}`);
    }
    const json = (await res.json()) as { id?: string; channel_id?: string };
    lastResult = {
      messageId: json.id ? String(json.id) : "unknown",
      channelId: String(json.channel_id ?? channelId),
    };
  }

  return lastResult;
}

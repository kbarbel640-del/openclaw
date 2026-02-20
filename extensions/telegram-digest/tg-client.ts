/**
 * gramjs (MTProto) client wrapper for Telegram channel message fetching.
 *
 * Uses dynamic imports to avoid load-time failures when `telegram` is not installed.
 * Designed for reuse: the TelegramDigestClient class can be used independently
 * of the OpenClaw plugin system.
 */

import type { TgConfig, TgMessage, ChannelMessages } from "./types.js";

// ---------------------------------------------------------------------------
// Config resolution
// ---------------------------------------------------------------------------

/**
 * Resolve Telegram client config from environment variables and plugin config.
 *
 * Environment variables:
 * - `TELEGRAM_API_ID` (required) — Telegram application API ID
 * - `TELEGRAM_API_HASH` (required) — Telegram application API hash
 * - `TELEGRAM_SESSION` (required) — StringSession token from setup script
 * - `TELEGRAM_CHANNELS` (optional) — comma-separated list of channel usernames
 *
 * Plugin config can override `channels` and `maxMessages`.
 */
export function resolveTgConfig(pluginConfig?: {
  channels?: string[];
  maxMessages?: number;
}): TgConfig {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH ?? "";
  const session = process.env.TELEGRAM_SESSION ?? "";

  if (!apiId || Number.isNaN(apiId)) {
    throw new Error(
      "TELEGRAM_API_ID environment variable is required. " +
        "Get one at https://my.telegram.org/apps",
    );
  }
  if (!apiHash) {
    throw new Error(
      "TELEGRAM_API_HASH environment variable is required. " +
        "Get one at https://my.telegram.org/apps",
    );
  }
  if (!session) {
    throw new Error(
      "TELEGRAM_SESSION environment variable is required. " +
        "Generate one using: npx tsx extensions/telegram-digest/setup-session.ts",
    );
  }

  // Channels: plugin config > env var > empty
  const envChannels = process.env.TELEGRAM_CHANNELS
    ? process.env.TELEGRAM_CHANNELS.split(",")
        .map((c) => c.trim())
        .filter(Boolean)
    : [];

  const channels = pluginConfig?.channels?.length ? pluginConfig.channels : envChannels;

  const maxMessages = pluginConfig?.maxMessages ?? 100;

  return { apiId, apiHash, session, channels, maxMessages };
}

// ---------------------------------------------------------------------------
// Client class
// ---------------------------------------------------------------------------

/** gramjs types (loaded dynamically). */
// oxlint-disable-next-line typescript/no-explicit-any
type GramJsApi = any;

export class TelegramDigestClient {
  // oxlint-disable-next-line typescript/no-explicit-any
  private client: any = null;
  private config: TgConfig;

  constructor(config: TgConfig) {
    this.config = config;
  }

  /** Connect to Telegram using StringSession. */
  async connect(): Promise<void> {
    const { TelegramClient } = await import("telegram");
    const { StringSession } = await import("telegram/sessions/index.js");

    const session = new StringSession(this.config.session);
    this.client = new TelegramClient(session, this.config.apiId, this.config.apiHash, {
      connectionRetries: 3,
    });

    await this.client.connect();
  }

  /** Disconnect from Telegram. */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  }

  /**
   * Fetch messages from a single channel within a time window.
   *
   * @param channel - Channel username (e.g., "@durov") or numeric ID
   * @param periodMs - Time window in milliseconds from now
   * @param limit - Maximum messages to fetch
   */
  async getChannelMessages(
    channel: string,
    periodMs: number,
    limit?: number,
  ): Promise<TgMessage[]> {
    if (!this.client) {
      throw new Error("Client not connected. Call connect() first.");
    }

    const maxLimit = limit ?? this.config.maxMessages;
    const cutoff = new Date(Date.now() - periodMs);

    try {
      const messages = await this.client.getMessages(channel, { limit: maxLimit });
      return this.parseMessages(messages, channel, cutoff);
    } catch (err) {
      throw new Error(`Failed to fetch messages from ${channel}: ${sanitizeTgError(err)}`);
    }
  }

  /**
   * Fetch messages from all configured channels within a time window.
   *
   * @param periodMs - Time window in milliseconds from now
   * @param limit - Maximum messages per channel
   */
  async getAllChannelMessages(periodMs: number, limit?: number): Promise<ChannelMessages[]> {
    const results: ChannelMessages[] = [];

    for (const channel of this.config.channels) {
      const messages = await this.getChannelMessages(channel, periodMs, limit);
      results.push({ channel, messages });
    }

    return results;
  }

  /** Parse raw gramjs messages into TgMessage objects, filtering by cutoff date. */
  // oxlint-disable-next-line typescript/no-explicit-any
  private parseMessages(rawMessages: any[], channel: string, cutoff: Date): TgMessage[] {
    const result: TgMessage[] = [];

    for (const msg of rawMessages) {
      // gramjs stores date as Unix timestamp (seconds)
      const date = new Date((msg.date ?? 0) * 1000);

      if (date < cutoff) continue;
      if (!msg.message && !msg.text) continue;

      const reactions = countReactions(msg);

      result.push({
        id: msg.id ?? 0,
        channel,
        date,
        text: msg.message ?? msg.text ?? "",
        views: msg.views ?? 0,
        forwards: msg.forwards ?? 0,
        replies: msg.replies?.replies ?? 0,
        reactions,
      });
    }

    return result;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count total reactions on a message. */
// oxlint-disable-next-line typescript/no-explicit-any
function countReactions(msg: any): number {
  if (!msg.reactions?.results) return 0;

  let total = 0;
  // oxlint-disable-next-line typescript/no-explicit-any
  for (const r of msg.reactions.results as any[]) {
    total += r.count ?? 0;
  }
  return total;
}

/** Sanitize gramjs error messages — strip session tokens. */
function sanitizeTgError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  // Strip anything that looks like a session string (long base64)
  return msg.replace(/[A-Za-z0-9+/=]{50,}/g, "[SESSION_REDACTED]");
}

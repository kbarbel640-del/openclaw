/**
 * Facebook Messenger Send API client.
 *
 * Implements message sending via the Graph API:
 * - Text messages
 * - Media attachments (image, video, audio, file)
 * - Sender actions (typing indicators)
 * - Quick replies and buttons
 */

import type { RetryConfig } from "../infra/retry.js";
import type {
  MessengerAttachmentType,
  MessengerMessageTag,
  MessengerQuickReplyButton,
  MessengerSendResponse,
  ResolvedMessengerAccount,
} from "./types.js";
import { loadConfig } from "../config/config.js";
import { logVerbose } from "../globals.js";
import { recordChannelActivity } from "../infra/channel-activity.js";
import { formatErrorMessage } from "../infra/errors.js";
import { createMessengerRetryRunner } from "../infra/retry-policy.js";
import { resolveMessengerAccount } from "./accounts.js";
import { normalizeMessengerTarget } from "./normalize.js";

/** Default Graph API version. */
const DEFAULT_API_VERSION = "v18.0";

/** Default text chunk limit for Messenger (2000 chars). */
export const MESSENGER_TEXT_CHUNK_LIMIT = 2000;

/**
 * Options for sending a Messenger message.
 */
export type MessengerSendOptions = {
  /** Page Access Token (if not using account resolution). */
  token?: string;
  /** Account ID for multi-account resolution. */
  accountId?: string;
  /** Media URL to attach. */
  mediaUrl?: string;
  /** Media type (image, video, audio, file). */
  mediaType?: MessengerAttachmentType;
  /** Quick reply buttons. */
  quickReplies?: MessengerQuickReplyButton[];
  /** Message tag for sending outside 24-hour window. */
  messageTag?: MessengerMessageTag;
  /** Graph API version (default: v18.0). */
  apiVersion?: string;
  /** Retry configuration. */
  retry?: RetryConfig;
  /** Enable verbose logging. */
  verbose?: boolean;
  /** Custom fetch implementation (for testing). */
  fetch?: typeof fetch;
};

/**
 * Result of sending a Messenger message.
 */
export type MessengerSendResult = {
  messageId: string;
  recipientId: string;
};

/**
 * Sender actions for Messenger.
 */
export type MessengerSenderAction = "typing_on" | "typing_off" | "mark_seen";

/**
 * Options for sending a sender action.
 */
export type MessengerSenderActionOptions = {
  /** Page Access Token (if not using account resolution). */
  token?: string;
  /** Account ID for multi-account resolution. */
  accountId?: string;
  /** Graph API version (default: v18.0). */
  apiVersion?: string;
  /** Custom fetch implementation (for testing). */
  fetch?: typeof fetch;
};

/**
 * Resolve the Page Access Token from options or account config.
 */
function resolveToken(explicit: string | undefined, account: ResolvedMessengerAccount): string {
  if (explicit?.trim()) {
    return explicit.trim();
  }
  if (!account.pageAccessToken) {
    throw new Error(
      `Messenger page access token missing for account "${account.accountId}" ` +
        `(set channels.messenger.accounts.${account.accountId}.pageAccessToken or ` +
        `channels.messenger.pageAccessToken).`,
    );
  }
  return account.pageAccessToken;
}

/**
 * Normalize a recipient ID (PSID).
 */
function normalizeRecipientId(to: string): string {
  const trimmed = to.trim();
  if (!trimmed) {
    throw new Error("Recipient is required for Messenger sends");
  }

  // Strip messenger: prefix if present
  const normalized = normalizeMessengerTarget(trimmed) ?? trimmed;
  if (!normalized) {
    throw new Error("Invalid Messenger recipient");
  }

  return normalized;
}

/**
 * Build the Graph API URL for the Send API.
 */
function buildSendApiUrl(apiVersion: string): string {
  return `https://graph.facebook.com/${apiVersion}/me/messages`;
}

/**
 * Build the request body for a text message.
 */
function buildTextMessageBody(
  recipientId: string,
  text: string,
  options: MessengerSendOptions,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    recipient: { id: recipientId },
    message: { text },
  };

  if (options.quickReplies?.length) {
    (body.message as Record<string, unknown>).quick_replies = options.quickReplies;
  }

  if (options.messageTag) {
    body.messaging_type = "MESSAGE_TAG";
    body.tag = options.messageTag;
  } else {
    body.messaging_type = "RESPONSE";
  }

  return body;
}

/**
 * Build the request body for a media message.
 */
function buildMediaMessageBody(
  recipientId: string,
  text: string,
  mediaUrl: string,
  mediaType: MessengerAttachmentType,
  options: MessengerSendOptions,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: mediaType,
        payload: {
          url: mediaUrl,
          is_reusable: true,
        },
      },
    },
  };

  if (options.messageTag) {
    body.messaging_type = "MESSAGE_TAG";
    body.tag = options.messageTag;
  } else {
    body.messaging_type = "RESPONSE";
  }

  return body;
}

/**
 * Build the request body for a sender action.
 */
function buildSenderActionBody(
  recipientId: string,
  action: MessengerSenderAction,
): Record<string, unknown> {
  return {
    recipient: { id: recipientId },
    sender_action: action,
  };
}

/**
 * Check if an error is retryable.
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Rate limiting
    if (message.includes("rate limit") || message.includes("too many requests")) {
      return true;
    }
    // Transient errors
    if (message.includes("timeout") || message.includes("econnreset")) {
      return true;
    }
    // Server errors
    if (message.includes("500") || message.includes("502") || message.includes("503")) {
      return true;
    }
  }
  return false;
}

/**
 * Send a request to the Messenger Send API.
 */
async function sendApiRequest(
  url: string,
  body: Record<string, unknown>,
  token: string,
  fetchFn: typeof fetch,
): Promise<MessengerSendResponse> {
  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as
    | MessengerSendResponse
    | { error: { message: string; code: number } };

  if (!response.ok || "error" in data) {
    const errorData = data as { error: { message: string; code: number } };
    const errorMessage = errorData.error?.message ?? `HTTP ${response.status}`;
    const error = new Error(`Messenger API error: ${errorMessage}`);
    (error as Error & { code?: number }).code = errorData.error?.code;
    throw error;
  }

  return data;
}

/**
 * Send a text message via Messenger.
 */
export async function sendMessageMessenger(
  to: string,
  text: string,
  options: MessengerSendOptions = {},
): Promise<MessengerSendResult> {
  const cfg = loadConfig();
  const account = resolveMessengerAccount({ cfg, accountId: options.accountId });
  const token = resolveToken(options.token, account);
  const recipientId = normalizeRecipientId(to);
  const apiVersion = options.apiVersion ?? account.config.apiVersion ?? DEFAULT_API_VERSION;
  const fetchFn = options.fetch ?? fetch;
  const verbose = options.verbose ?? false;

  recordChannelActivity({
    channel: "messenger",
    accountId: account.accountId,
    direction: "outbound",
  });

  const url = buildSendApiUrl(apiVersion);
  const retry = createMessengerRetryRunner({ retry: options.retry, verbose });

  // Handle media messages
  if (options.mediaUrl) {
    const mediaType = options.mediaType ?? inferMediaType(options.mediaUrl);
    const body = buildMediaMessageBody(recipientId, text, options.mediaUrl, mediaType, options);

    if (verbose) {
      logVerbose(`messenger: sending media to ${recipientId}`);
    }

    const result = await retry(async () => {
      try {
        return await sendApiRequest(url, body, token, fetchFn);
      } catch (err) {
        if (isRetryableError(err)) {
          throw err;
        }
        throw new Error(`Messenger send failed: ${formatErrorMessage(err)}`, { cause: err });
      }
    });

    // Send caption as separate text message if provided
    if (text) {
      const textBody = buildTextMessageBody(recipientId, text, options);
      await retry(async () => sendApiRequest(url, textBody, token, fetchFn));
    }

    if (verbose) {
      logVerbose(`messenger: sent media ${result.message_id} to ${recipientId}`);
    }

    return {
      messageId: result.message_id,
      recipientId: result.recipient_id,
    };
  }

  // Text-only message
  const body = buildTextMessageBody(recipientId, text, options);

  if (verbose) {
    logVerbose(`messenger: sending text to ${recipientId} (${text.length} chars)`);
  }

  const result = await retry(async () => {
    try {
      return await sendApiRequest(url, body, token, fetchFn);
    } catch (err) {
      if (isRetryableError(err)) {
        throw err;
      }
      throw new Error(`Messenger send failed: ${formatErrorMessage(err)}`, { cause: err });
    }
  });

  if (verbose) {
    logVerbose(`messenger: sent message ${result.message_id} to ${recipientId}`);
  }

  return {
    messageId: result.message_id,
    recipientId: result.recipient_id,
  };
}

/**
 * Send a sender action (typing indicator, mark seen) via Messenger.
 */
export async function sendSenderAction(
  to: string,
  action: MessengerSenderAction,
  options: MessengerSenderActionOptions = {},
): Promise<void> {
  const cfg = loadConfig();
  const account = resolveMessengerAccount({ cfg, accountId: options.accountId });
  const token = resolveToken(options.token, account);
  const recipientId = normalizeRecipientId(to);
  const apiVersion = options.apiVersion ?? account.config.apiVersion ?? DEFAULT_API_VERSION;
  const fetchFn = options.fetch ?? fetch;

  const url = buildSendApiUrl(apiVersion);
  const body = buildSenderActionBody(recipientId, action);

  try {
    await sendApiRequest(url, body, token, fetchFn);
  } catch (err) {
    // Sender actions are best-effort; log but don't throw
    logVerbose(`messenger: sender action failed: ${formatErrorMessage(err)}`);
  }
}

/**
 * Send a typing indicator.
 */
export async function sendTypingIndicator(
  to: string,
  options: MessengerSenderActionOptions = {},
): Promise<void> {
  await sendSenderAction(to, "typing_on", options);
}

/**
 * Stop the typing indicator.
 */
export async function stopTypingIndicator(
  to: string,
  options: MessengerSenderActionOptions = {},
): Promise<void> {
  await sendSenderAction(to, "typing_off", options);
}

/**
 * Mark messages as seen.
 */
export async function markSeen(
  to: string,
  options: MessengerSenderActionOptions = {},
): Promise<void> {
  await sendSenderAction(to, "mark_seen", options);
}

/**
 * Infer media type from URL.
 */
function inferMediaType(url: string): MessengerAttachmentType {
  const lowerUrl = url.toLowerCase();

  // Check file extension
  if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(lowerUrl)) {
    return "image";
  }
  if (/\.(mp4|mov|avi|webm)(\?|$)/i.test(lowerUrl)) {
    return "video";
  }
  if (/\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(lowerUrl)) {
    return "audio";
  }
  if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip)(\?|$)/i.test(lowerUrl)) {
    return "file";
  }

  // Default to file for unknown types
  return "file";
}

/**
 * Chunk text for Messenger's 2000 character limit.
 */
export function chunkMessengerText(
  text: string,
  limit: number = MESSENGER_TEXT_CHUNK_LIMIT,
): string[] {
  if (text.length <= limit) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }

    // Try to break at paragraph
    let breakPoint = remaining.lastIndexOf("\n\n", limit);
    if (breakPoint <= 0 || breakPoint < limit / 2) {
      // Try to break at newline
      breakPoint = remaining.lastIndexOf("\n", limit);
    }
    if (breakPoint <= 0 || breakPoint < limit / 2) {
      // Try to break at sentence
      breakPoint = remaining.lastIndexOf(". ", limit);
      if (breakPoint > 0) {
        breakPoint += 1; // Include the period
      }
    }
    if (breakPoint <= 0 || breakPoint < limit / 2) {
      // Try to break at word
      breakPoint = remaining.lastIndexOf(" ", limit);
    }
    if (breakPoint <= 0) {
      // Hard break
      breakPoint = limit;
    }

    chunks.push(remaining.slice(0, breakPoint).trim());
    remaining = remaining.slice(breakPoint).trim();
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

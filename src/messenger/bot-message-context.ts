/**
 * Messenger message context building.
 *
 * Parses incoming Messenger webhook events and builds the inbound context
 * for agent processing.
 */

import type { FinalizedMsgContext } from "../auto-reply/templating.js";
import type { OpenClawConfig } from "../config/config.js";
import type { DmPolicy } from "../config/types.js";
import type { RuntimeEnv } from "../runtime.js";
import type { MessengerMessagingEvent, ResolvedMessengerAccount } from "./types.js";
import { formatInboundEnvelope, resolveEnvelopeFormatOptions } from "../auto-reply/envelope.js";
import { finalizeInboundContext } from "../auto-reply/reply/inbound-context.js";
import { recordInboundSession } from "../channels/session.js";
import { readSessionUpdatedAt, resolveStorePath } from "../config/sessions.js";
import { logVerbose } from "../globals.js";
import { recordChannelActivity } from "../infra/channel-activity.js";
import { resolveAgentRoute } from "../routing/resolve-route.js";
import { normalizeMessengerTarget } from "./normalize.js";

/**
 * Media reference from Messenger attachment.
 */
export type MessengerMediaRef = {
  url: string;
  type: string;
  stickerId?: number;
};

/**
 * Parsed Messenger message content.
 */
export type ParsedMessengerMessage = {
  /** Message ID (mid). */
  messageId: string;
  /** Text content (if any). */
  text?: string;
  /** Quick reply payload (if any). */
  quickReplyPayload?: string;
  /** Postback payload (if any). */
  postbackPayload?: string;
  /** Postback title (if any). */
  postbackTitle?: string;
  /** Attachments (media). */
  attachments: MessengerMediaRef[];
  /** Reply-to message ID (if replying). */
  replyToId?: string;
  /** Whether this is an echo of our own message. */
  isEcho: boolean;
  /** Reaction info (if reaction event). */
  reaction?: {
    messageId: string;
    action: "react" | "unreact";
    emoji?: string;
  };
  /** Location data (if location attachment). */
  location?: {
    lat: number;
    long: number;
  };
};

/**
 * Parse a Messenger messaging event into a structured message.
 */
export function parseMessengerEvent(event: MessengerMessagingEvent): ParsedMessengerMessage | null {
  // Handle reaction events
  if (event.reaction) {
    return {
      messageId: event.reaction.mid,
      attachments: [],
      isEcho: false,
      reaction: {
        messageId: event.reaction.mid,
        action: event.reaction.action,
        emoji: event.reaction.emoji ?? event.reaction.reaction,
      },
    };
  }

  // Handle postback events
  if (event.postback) {
    return {
      messageId: `postback-${event.timestamp}`,
      text: event.postback.title,
      postbackPayload: event.postback.payload,
      postbackTitle: event.postback.title,
      attachments: [],
      isEcho: false,
    };
  }

  // Handle message events
  const msg = event.message;
  if (!msg) {
    return null;
  }

  // Skip echo messages (messages we sent)
  if (msg.is_echo) {
    return {
      messageId: msg.mid,
      text: msg.text,
      attachments: [],
      isEcho: true,
    };
  }

  const attachments: MessengerMediaRef[] = [];
  let location: { lat: number; long: number } | undefined;

  if (msg.attachments) {
    for (const attachment of msg.attachments) {
      if (attachment.type === "location" && attachment.payload?.coordinates) {
        location = {
          lat: attachment.payload.coordinates.lat,
          long: attachment.payload.coordinates.long,
        };
      } else if (attachment.payload?.url) {
        attachments.push({
          url: attachment.payload.url,
          type: mapAttachmentType(attachment.type),
          stickerId: attachment.payload.sticker_id,
        });
      }
    }
  }

  return {
    messageId: msg.mid,
    text: msg.text,
    quickReplyPayload: msg.quick_reply?.payload,
    attachments,
    replyToId: msg.reply_to?.mid,
    isEcho: false,
    location,
  };
}

/**
 * Map Messenger attachment type to our content type.
 */
function mapAttachmentType(type: string): string {
  switch (type) {
    case "image":
      return "image";
    case "video":
      return "video";
    case "audio":
      return "audio";
    case "file":
      return "document";
    default:
      return type;
  }
}

/**
 * Format location as text.
 */
function formatLocationText(location: { lat: number; long: number }): string {
  return `[Location: ${location.lat}, ${location.long}]`;
}

/**
 * Build media placeholder for attachments.
 */
function buildMediaPlaceholder(attachments: MessengerMediaRef[]): string {
  if (attachments.length === 0) {
    return "";
  }
  const firstType = attachments[0].type;
  if (attachments.length === 1) {
    return `<media:${firstType}>`;
  }
  return `<media:${firstType}> (${attachments.length} files)`;
}

/**
 * Options for building Messenger message context.
 */
export type BuildMessengerMessageContextParams = {
  event: MessengerMessagingEvent;
  parsedMessage: ParsedMessengerMessage;
  cfg: OpenClawConfig;
  account: ResolvedMessengerAccount;
  storeAllowFrom: string[];
  runtime?: RuntimeEnv;
};

/**
 * Result of building Messenger message context.
 */
export type MessengerMessageContext = {
  /** Finalized inbound context for agent processing. */
  ctxPayload: FinalizedMsgContext;
  /** Sender PSID. */
  senderId: string;
  /** Page ID. */
  pageId: string;
  /** Parsed message. */
  parsedMessage: ParsedMessengerMessage;
  /** Resolved route. */
  route: ReturnType<typeof resolveAgentRoute>;
  /** Account ID. */
  accountId: string;
  /** Callback to send typing indicator. */
  sendTyping: () => Promise<void>;
};

/**
 * Check if sender is allowed based on DM policy and allowlist.
 */
function isSenderAllowed(params: {
  senderId: string;
  dmPolicy: DmPolicy;
  allowFrom: Array<string | number>;
  storeAllowFrom: string[];
}): boolean {
  const { senderId, dmPolicy, allowFrom, storeAllowFrom } = params;

  if (dmPolicy === "disabled") {
    return false;
  }

  if (dmPolicy === "open") {
    return true;
  }

  // Normalize the sender ID
  const normalizedSender = normalizeMessengerTarget(senderId) ?? senderId;

  // Check config allowlist
  const configAllowed = allowFrom.some((entry) => {
    const normalized = normalizeMessengerTarget(String(entry)) ?? String(entry);
    return normalized === normalizedSender || entry === "*";
  });

  if (configAllowed) {
    return true;
  }

  // Check store allowlist (paired users)
  const storeAllowed = storeAllowFrom.some((entry) => {
    const normalized = normalizeMessengerTarget(entry) ?? entry;
    return normalized === normalizedSender;
  });

  return storeAllowed;
}

/**
 * Build the inbound message context from a Messenger event.
 *
 * Returns null if the message should be dropped (unauthorized sender, echo, etc.).
 */
export async function buildMessengerMessageContext(
  params: BuildMessengerMessageContextParams,
): Promise<MessengerMessageContext | null> {
  const { event, parsedMessage, cfg, account, storeAllowFrom, runtime: _runtime } = params;

  // Skip echoes
  if (parsedMessage.isEcho) {
    logVerbose("messenger: skipping echo message");
    return null;
  }

  // Skip reactions for now (could be handled separately)
  if (parsedMessage.reaction) {
    logVerbose("messenger: skipping reaction event");
    return null;
  }

  const senderId = event.sender.id;
  const pageId = event.recipient.id;

  recordChannelActivity({
    channel: "messenger",
    accountId: account.accountId,
    direction: "inbound",
  });

  // DM policy check
  const dmPolicy = account.config.dmPolicy ?? "pairing";
  const allowFrom = account.config.allowFrom ?? [];

  if (!isSenderAllowed({ senderId, dmPolicy, allowFrom, storeAllowFrom })) {
    if (dmPolicy === "pairing") {
      // TODO: Implement pairing flow for Messenger
      logVerbose(`messenger: unauthorized sender ${senderId} (pairing not yet implemented)`);
    } else {
      logVerbose(`messenger: blocked unauthorized sender ${senderId} (dmPolicy=${dmPolicy})`);
    }
    return null;
  }

  // Resolve agent route
  const route = resolveAgentRoute({
    cfg,
    channel: "messenger",
    accountId: account.accountId,
    peer: {
      kind: "dm",
      id: senderId,
    },
  });

  const sessionKey = route.sessionKey;

  // Build message body
  let bodyText = parsedMessage.text ?? "";

  // Add location if present
  if (parsedMessage.location) {
    const locationText = formatLocationText(parsedMessage.location);
    bodyText = bodyText ? `${bodyText}\n${locationText}` : locationText;
  }

  // Add quick reply info if present
  if (parsedMessage.quickReplyPayload) {
    bodyText = `[Quick Reply: ${parsedMessage.quickReplyPayload}] ${bodyText}`.trim();
  }

  // Add postback info if present
  if (parsedMessage.postbackPayload) {
    bodyText =
      `[Button: ${parsedMessage.postbackTitle ?? parsedMessage.postbackPayload}] ${bodyText}`.trim();
  }

  // Add media placeholder if we have attachments but no text
  if (!bodyText && parsedMessage.attachments.length > 0) {
    bodyText = buildMediaPlaceholder(parsedMessage.attachments);
  }

  // If no content at all, skip
  if (!bodyText && parsedMessage.attachments.length === 0) {
    logVerbose("messenger: skipping empty message");
    return null;
  }

  // Build sender label
  const senderLabel = `messenger:${senderId}`;
  const conversationLabel = senderLabel;

  // Build envelope
  const storePath = resolveStorePath(cfg.session?.store, { agentId: route.agentId });
  const envelopeOptions = resolveEnvelopeFormatOptions(cfg);
  const previousTimestamp = readSessionUpdatedAt({ storePath, sessionKey });

  const body = formatInboundEnvelope({
    channel: "Messenger",
    from: conversationLabel,
    timestamp: event.timestamp,
    body: bodyText,
    chatType: "direct",
    previousTimestamp,
    envelope: envelopeOptions,
  });

  // Build context payload
  const ctxPayload = finalizeInboundContext({
    Body: body,
    RawBody: parsedMessage.text ?? bodyText,
    CommandBody: parsedMessage.text ?? bodyText,
    From: senderLabel,
    To: `messenger:${pageId}`,
    SessionKey: sessionKey,
    AccountId: route.accountId,
    ChatType: "direct",
    ConversationLabel: conversationLabel,
    SenderId: senderId,
    Provider: "messenger",
    Surface: "messenger",
    MessageSid: parsedMessage.messageId,
    ReplyToId: parsedMessage.replyToId,
    Timestamp: event.timestamp,
    // Media info
    MediaUrl: parsedMessage.attachments[0]?.url,
    MediaType: parsedMessage.attachments[0]?.type,
    MediaUrls:
      parsedMessage.attachments.length > 0
        ? parsedMessage.attachments.map((a) => a.url)
        : undefined,
    MediaTypes:
      parsedMessage.attachments.length > 0
        ? parsedMessage.attachments.map((a) => a.type)
        : undefined,
    // Location
    ...(parsedMessage.location
      ? {
          LocationLat: parsedMessage.location.lat,
          LocationLong: parsedMessage.location.long,
        }
      : {}),
    // Routing
    OriginatingChannel: "messenger" as const,
    OriginatingTo: `messenger:${senderId}`,
    // Command authorization (allow for now, can be refined later)
    CommandAuthorized: true,
  });

  // Record session
  await recordInboundSession({
    storePath,
    sessionKey: ctxPayload.SessionKey ?? sessionKey,
    ctx: ctxPayload,
    updateLastRoute: {
      sessionKey: route.mainSessionKey,
      channel: "messenger",
      to: senderId,
      accountId: route.accountId,
    },
    onRecordError: (err) => {
      logVerbose(`messenger: failed updating session meta: ${String(err)}`);
    },
  });

  logVerbose(
    `messenger: inbound from=${senderId} len=${bodyText.length} mid=${parsedMessage.messageId}`,
  );

  // Create typing callback (placeholder - actual implementation needs API client)
  const sendTyping = async () => {
    // Will be implemented when we add the send API
    logVerbose(`messenger: would send typing indicator to ${senderId}`);
  };

  return {
    ctxPayload,
    senderId,
    pageId,
    parsedMessage,
    route,
    accountId: account.accountId,
    sendTyping,
  };
}

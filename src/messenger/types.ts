/**
 * Facebook Messenger channel types.
 *
 * Key concepts:
 * - PSID: Page-Scoped User ID - unique identifier for a user interacting with a specific page
 * - Page Access Token: Token for authenticating API calls on behalf of a page
 * - App Secret: Secret for verifying webhook request signatures
 * - Verify Token: Token for webhook verification handshake
 */

import type { MessengerAccountConfig } from "../config/types.messenger.js";

/**
 * Resolved Messenger account with merged configuration.
 */
export type ResolvedMessengerAccount = {
  /** Account identifier (e.g., "default" or custom name). */
  accountId: string;
  /** Whether this account is enabled. */
  enabled: boolean;
  /** Optional display name for the account. */
  name?: string;
  /** Page Access Token for API calls. */
  pageAccessToken: string;
  /** Source of the page access token (env, config, file, or none). */
  tokenSource: "env" | "tokenFile" | "config" | "none";
  /** App Secret for webhook signature verification. */
  appSecret?: string;
  /** Verify Token for webhook verification handshake. */
  verifyToken?: string;
  /** Facebook Page ID this account is linked to. */
  pageId?: string;
  /** Merged account configuration. */
  config: MessengerAccountConfig;
};

/**
 * Messenger webhook event types.
 */
export type MessengerEventType =
  | "message"
  | "message_deliveries"
  | "message_reads"
  | "message_reactions"
  | "messaging_postbacks"
  | "messaging_optins"
  | "messaging_referrals";

/**
 * Messenger message attachment type.
 */
export type MessengerAttachmentType =
  | "image"
  | "video"
  | "audio"
  | "file"
  | "location"
  | "fallback";

/**
 * Messenger message attachment.
 */
export type MessengerAttachment = {
  type: MessengerAttachmentType;
  payload?: {
    url?: string;
    sticker_id?: number;
    coordinates?: {
      lat: number;
      long: number;
    };
  };
};

/**
 * Messenger quick reply payload.
 */
export type MessengerQuickReply = {
  payload: string;
};

/**
 * Messenger message received from webhook.
 */
export type MessengerInboundMessage = {
  mid: string;
  text?: string;
  attachments?: MessengerAttachment[];
  quick_reply?: MessengerQuickReply;
  reply_to?: {
    mid: string;
  };
  is_echo?: boolean;
  app_id?: number;
};

/**
 * Messenger sender information.
 */
export type MessengerSender = {
  id: string; // PSID
};

/**
 * Messenger recipient information.
 */
export type MessengerRecipient = {
  id: string; // Page ID or PSID
};

/**
 * Messenger messaging event from webhook.
 */
export type MessengerMessagingEvent = {
  sender: MessengerSender;
  recipient: MessengerRecipient;
  timestamp: number;
  message?: MessengerInboundMessage;
  postback?: {
    title: string;
    payload: string;
    referral?: {
      ref: string;
      source: string;
      type: string;
    };
  };
  reaction?: {
    mid: string;
    action: "react" | "unreact";
    emoji?: string;
    reaction?: string;
  };
  read?: {
    watermark: number;
  };
  delivery?: {
    mids?: string[];
    watermark: number;
  };
  optin?: {
    ref?: string;
    user_ref?: string;
  };
  referral?: {
    ref: string;
    source: string;
    type: string;
  };
};

/**
 * Messenger webhook entry.
 */
export type MessengerWebhookEntry = {
  id: string; // Page ID
  time: number;
  messaging: MessengerMessagingEvent[];
};

/**
 * Messenger webhook payload.
 */
export type MessengerWebhookPayload = {
  object: "page";
  entry: MessengerWebhookEntry[];
};

/**
 * Messenger send API response.
 */
export type MessengerSendResponse = {
  recipient_id: string;
  message_id: string;
};

/**
 * Messenger send API error.
 */
export type MessengerApiError = {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

/**
 * Messenger message tag for sending outside 24-hour window.
 */
export type MessengerMessageTag =
  | "CONFIRMED_EVENT_UPDATE"
  | "POST_PURCHASE_UPDATE"
  | "ACCOUNT_UPDATE"
  | "HUMAN_AGENT";

/**
 * Messenger quick reply button.
 */
export type MessengerQuickReplyButton = {
  content_type: "text" | "user_phone_number" | "user_email";
  title?: string;
  payload?: string;
  image_url?: string;
};

/**
 * Messenger outbound message payload.
 */
export type MessengerOutboundPayload = {
  /** PSID of the recipient. */
  recipientId: string;
  /** Text message to send. */
  text?: string;
  /** URL of media attachment. */
  attachmentUrl?: string;
  /** Type of attachment. */
  attachmentType?: MessengerAttachmentType;
  /** Quick reply buttons. */
  quickReplies?: MessengerQuickReplyButton[];
  /** Message tag for sending outside 24-hour window. */
  messageTag?: MessengerMessageTag;
  /** Account ID to use. */
  accountId?: string;
};

/**
 * Messenger profile API persona.
 */
export type MessengerPersona = {
  id: string;
  name: string;
  profile_picture_url: string;
};

/**
 * Messenger user profile from Graph API.
 */
export type MessengerUserProfile = {
  first_name?: string;
  last_name?: string;
  profile_pic?: string;
  locale?: string;
  timezone?: number;
  gender?: string;
  id: string;
};

/**
 * Configuration interface for Webex channel plugin
 */
export interface WebexConfig {
  /** Enable/disable the Webex channel */
  enabled?: boolean;
  /** Bot access token from developer.webex.com */
  botToken?: string;
  /** Path to file containing bot token */
  tokenFile?: string;
  /** Public URL for webhook endpoint (e.g., https://your-domain.com) */
  webhookUrl?: string;
  /** Webhook path (defaults to /webex-webhook) */
  webhookPath?: string;
  /** Shared secret for webhook validation */
  webhookSecret?: string;
  /** Direct message policy */
  dmPolicy?: "pairing" | "open" | "disabled";
  /** List of allowed sender emails/IDs */
  allowFrom?: string[];
  /** Display name for this account */
  name?: string;
  /** Multi-account configuration */
  accounts?: Record<string, WebexAccountConfig>;
}

/**
 * Per-account configuration for multi-account setups
 */
export interface WebexAccountConfig {
  /** Enable/disable this account */
  enabled?: boolean;
  /** Bot access token for this account */
  botToken?: string;
  /** Path to file containing bot token for this account */
  tokenFile?: string;
  /** Public webhook URL for this account */
  webhookUrl?: string;
  /** Webhook path for this account */
  webhookPath?: string;
  /** Webhook secret for this account */
  webhookSecret?: string;
  /** Direct message policy for this account */
  dmPolicy?: "pairing" | "open" | "disabled";
  /** List of allowed senders for this account */
  allowFrom?: string[];
  /** Display name for this account */
  name?: string;
}

/**
 * Resolved account configuration with token and metadata
 */
export interface ResolvedWebexAccount {
  /** Account identifier */
  accountId: string;
  /** Whether this account is enabled */
  enabled: boolean;
  /** Bot access token */
  token: string;
  /** Where the token was loaded from */
  tokenSource: "config" | "file" | "env" | "none";
  /** Account configuration */
  config: WebexAccountConfig;
  /** Display name for this account */
  name?: string;
}

// ── Webex API Types ─────────────────────────────────────────────────

/**
 * Webex message object from the API
 * @see https://developer.webex.com/docs/api/v1/messages
 */
export interface WebexMessage {
  /** Unique message identifier */
  id: string;
  /** Room ID where the message was posted */
  roomId?: string;
  /** Type of room (direct or group) */
  roomType: "direct" | "group";
  /** Person ID of direct message recipient */
  toPersonId?: string;
  /** Email address of direct message recipient */
  toPersonEmail?: string;
  /** Plain text content of the message */
  text?: string;
  /** Markdown content of the message */
  markdown?: string;
  /** Person ID of the message sender */
  personId: string;
  /** Email address of the message sender */
  personEmail: string;
  /** ISO 8601 timestamp when the message was created */
  created: string;
  /** List of person IDs mentioned in the message */
  mentionedPeople?: string[];
  /** List of group mentions in the message */
  mentionedGroups?: string[];
}

/**
 * Webex person (user/bot) object
 * @see https://developer.webex.com/docs/api/v1/people
 */
export interface WebexPerson {
  /** Unique person identifier */
  id: string;
  /** List of email addresses */
  emails: string[];
  /** List of phone numbers */
  phoneNumbers?: string[];
  /** Display name */
  displayName: string;
  /** Nickname */
  nickName?: string;
  /** Username */
  userName?: string;
  /** Avatar URL */
  avatar?: string;
  /** Organization ID */
  orgId?: string;
  /** ISO 8601 timestamp when the person was created */
  created: string;
  /** Current status */
  status: string;
  /** Type of person */
  type: "person" | "bot";
}

/**
 * Webex room (space) object
 * @see https://developer.webex.com/docs/api/v1/rooms
 */
export interface WebexRoom {
  /** Unique room identifier */
  id: string;
  /** Room title/name */
  title?: string;
  /** Type of room */
  type: "direct" | "group";
  /** Whether the room is locked */
  isLocked?: boolean;
  /** Team ID if the room belongs to a team */
  teamId?: string;
  /** ISO 8601 timestamp when the room was created */
  created: string;
  /** Person ID of the room creator */
  creatorId?: string;
}

/**
 * Webex webhook event payload
 * @see https://developer.webex.com/docs/api/v1/webhooks
 */
export interface WebexWebhookEvent {
  /** Unique webhook event identifier */
  id: string;
  /** Webhook name */
  name: string;
  /** Resource type that triggered the webhook */
  resource: string;
  /** Event type */
  event: string;
  /** Optional filter */
  filter?: string;
  /** Event data */
  data: {
    /** ID of the resource that triggered the event */
    id: string;
    /** Room ID (for message events) */
    roomId?: string;
    /** Person ID (for message events) */
    personId?: string;
    /** Person email (for message events) */
    personEmail?: string;
    /** ISO 8601 timestamp when the resource was created */
    created?: string;
  };
}

/**
 * Result of probing Webex API connectivity
 */
export interface WebexProbeResult {
  /** Whether the probe was successful */
  ok: boolean;
  /** Bot information if successful */
  bot?: WebexPerson;
  /** Error message if unsuccessful */
  error?: string;
  /** HTTP status code if applicable */
  statusCode?: number;
}
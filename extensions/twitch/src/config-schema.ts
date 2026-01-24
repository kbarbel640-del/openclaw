import { MarkdownConfigSchema } from "clawdbot/plugin-sdk";
import { z } from "zod";

/**
 * Twitch user roles that can be allowed to interact with the bot
 */
const TwitchRoleSchema = z.enum(["moderator", "owner", "vip", "subscriber", "all"]);

/**
 * Twitch account configuration schema
 */
const TwitchAccountSchema = z.object({
  /** Twitch username */
  username: z.string(),
  /** Twitch OAuth token (requires chat:read and chat:write scopes) */
  token: z.string(),
  /** Twitch client ID (from Twitch Developer Portal or twitchtokengenerator.com) */
  clientId: z.string().optional(),
  /** Channel name to join (defaults to username) */
  channel: z.string().optional(),
  /** Enable this account */
  enabled: z.boolean().optional(),
  /** Allowlist of Twitch user IDs who can interact with the bot (use IDs for safety, not usernames) */
  allowFrom: z.array(z.string()).optional(),
  /** Roles allowed to interact with the bot (e.g., ["mod", "vip", "sub"]) */
  allowedRoles: z.array(TwitchRoleSchema).optional(),
  /** Require @mention to trigger bot responses */
  requireMention: z.boolean().optional(),
  /** Twitch client secret (required for token refresh via RefreshingAuthProvider) */
  clientSecret: z.string().optional(),
  /** Refresh token (required for automatic token refresh) */
  refreshToken: z.string().optional(),
  /** Token expiry time in seconds (optional, for token refresh tracking) */
  expiresIn: z.number().nullable().optional(),
  /** Timestamp when token was obtained (optional, for token refresh tracking) */
  obtainmentTimestamp: z.number().optional(),
});

/**
 * Twitch plugin configuration schema
 */
export const TwitchConfigSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  markdown: MarkdownConfigSchema.optional(),
  /** Per-account configuration */
  accounts: z.record(z.string(), TwitchAccountSchema).optional(),
});

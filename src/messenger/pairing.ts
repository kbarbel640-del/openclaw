/**
 * Messenger pairing store.
 *
 * Manages PSID-based pairing for DM access control.
 */

import type { ChannelPairingAdapter, ChannelSecurityAdapter } from "../channels/plugins/types.js";
import type { OpenClawConfig } from "../config/config.js";
import type { ResolvedMessengerAccount } from "./types.js";
import {
  addChannelAllowFromStoreEntry,
  approveChannelPairingCode,
  listChannelPairingRequests,
  readChannelAllowFromStore,
  upsertChannelPairingRequest,
} from "../pairing/pairing-store.js";
import { resolveMessengerAccount } from "./accounts.js";
import { normalizeMessengerTarget } from "./normalize.js";
import { sendMessageMessenger } from "./send.js";

const CHANNEL = "messenger" as const;

// ============================================================================
// Pairing Store Types
// ============================================================================

/**
 * Messenger pairing list entry.
 */
export type MessengerPairingListEntry = {
  psid: string;
  name?: string;
  code: string;
  createdAt: string;
  lastSeenAt: string;
};

// ============================================================================
// Allow-From Store
// ============================================================================

/**
 * Read Messenger allow-from entries from store.
 */
export async function readMessengerAllowFromStore(
  env: NodeJS.ProcessEnv = process.env,
): Promise<string[]> {
  return readChannelAllowFromStore(CHANNEL, env);
}

/**
 * Add a PSID to the Messenger allow-from store.
 */
export async function addMessengerAllowFromStoreEntry(params: {
  entry: string | number;
  env?: NodeJS.ProcessEnv;
}): Promise<{ changed: boolean; allowFrom: string[] }> {
  return addChannelAllowFromStoreEntry({
    channel: CHANNEL,
    entry: params.entry,
    env: params.env,
  });
}

// ============================================================================
// Pairing Requests
// ============================================================================

/**
 * List pending Messenger pairing requests.
 */
export async function listMessengerPairingRequests(
  env: NodeJS.ProcessEnv = process.env,
): Promise<MessengerPairingListEntry[]> {
  const list = await listChannelPairingRequests(CHANNEL, env);
  return list.map((r) => ({
    psid: r.id,
    code: r.code,
    createdAt: r.createdAt,
    lastSeenAt: r.lastSeenAt,
    name: r.meta?.name,
  }));
}

/**
 * Create or update a Messenger pairing request.
 */
export async function upsertMessengerPairingRequest(params: {
  psid: string;
  name?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{ code: string; created: boolean }> {
  return upsertChannelPairingRequest({
    channel: CHANNEL,
    id: String(params.psid),
    env: params.env,
    meta: {
      name: params.name,
    },
  });
}

/**
 * Approve a Messenger pairing code.
 */
export async function approveMessengerPairingCode(params: {
  code: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{ psid: string; entry?: MessengerPairingListEntry } | null> {
  const res = await approveChannelPairingCode({
    channel: CHANNEL,
    code: params.code,
    env: params.env,
  });
  if (!res) {
    return null;
  }
  const entry = res.entry
    ? {
        psid: res.entry.id,
        code: res.entry.code,
        createdAt: res.entry.createdAt,
        lastSeenAt: res.entry.lastSeenAt,
        name: res.entry.meta?.name,
      }
    : undefined;
  return { psid: res.id, entry };
}

// ============================================================================
// Effective Allow-From Resolution
// ============================================================================

/**
 * Resolve effective allow-from list combining config and store.
 */
export async function resolveMessengerEffectiveAllowFrom(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
  env?: NodeJS.ProcessEnv;
}): Promise<string[]> {
  const env = params.env ?? process.env;
  const account = resolveMessengerAccount({ cfg: params.cfg, accountId: params.accountId });

  // Get allow-from from config
  const cfgAllowFrom = (account.config.allowFrom ?? [])
    .map((v) => String(v).trim())
    .filter(Boolean)
    .map((v) => normalizeMessengerTarget(v) ?? v.replace(/^messenger:/i, ""))
    .filter((v) => v !== "*");

  // Get allow-from from store
  const storeAllowFrom = await readMessengerAllowFromStore(env);

  return Array.from(new Set([...cfgAllowFrom, ...storeAllowFrom]));
}

// ============================================================================
// Pairing Adapter
// ============================================================================

/**
 * Messenger pairing adapter for channel plugin.
 */
export const messengerPairingAdapter: ChannelPairingAdapter = {
  idLabel: "PSID",
  normalizeAllowEntry: (entry: string) => {
    const normalized = normalizeMessengerTarget(entry);
    return normalized ?? entry.replace(/^messenger:/i, "").trim();
  },
  notifyApproval: async (params) => {
    const { id } = params;
    try {
      await sendMessageMessenger(
        id,
        "Your pairing request has been approved. You can now chat with the assistant.",
        { verbose: false },
      );
    } catch {
      // Best-effort notification
    }
  },
};

// ============================================================================
// Security Adapter
// ============================================================================

/**
 * Resolve DM policy for Messenger.
 */
function resolveDmPolicy(ctx: {
  cfg: OpenClawConfig;
  accountId?: string | null;
  account: ResolvedMessengerAccount;
}) {
  const { account } = ctx;
  const dmPolicy = account.config.dmPolicy ?? "pairing";
  const allowFrom = account.config.allowFrom;

  return {
    policy: dmPolicy,
    allowFrom: allowFrom ?? null,
    policyPath: `channels.messenger.dmPolicy`,
    allowFromPath: `channels.messenger.allowFrom`,
    approveHint: `openclaw pair approve messenger <code>`,
    normalizeEntry: (raw: string) => {
      const normalized = normalizeMessengerTarget(raw);
      return normalized ?? raw.replace(/^messenger:/i, "").trim();
    },
  };
}

/**
 * Collect security warnings for Messenger account.
 */
async function collectSecurityWarnings(ctx: {
  cfg: OpenClawConfig;
  accountId?: string | null;
  account: ResolvedMessengerAccount;
}): Promise<string[]> {
  const { account } = ctx;
  const warnings: string[] = [];

  // Warn on open DM policy
  const dmPolicy = account.config.dmPolicy ?? "pairing";
  if (dmPolicy === "open") {
    warnings.push(
      `Messenger DM policy is "open" - anyone can message. ` +
        `Consider using "pairing" or "allowlist" for production.`,
    );
  }

  // Warn on missing appSecret (required for signature verification)
  if (!account.appSecret) {
    warnings.push(
      `Messenger appSecret is not configured. ` +
        `Webhook signature verification is disabled. ` +
        `Set channels.messenger.appSecret for security.`,
    );
  }

  // Warn on missing verifyToken
  if (!account.verifyToken) {
    warnings.push(
      `Messenger verifyToken is not configured. ` +
        `Webhook subscription verification may fail. ` +
        `Set channels.messenger.verifyToken.`,
    );
  }

  // Warn if token source is env (less secure than config file)
  if (account.tokenSource === "env") {
    warnings.push(
      `Messenger pageAccessToken is loaded from environment variable. ` +
        `Consider using config file or tokenFile for better security.`,
    );
  }

  return warnings;
}

/**
 * Messenger security adapter for channel plugin.
 */
export const messengerSecurityAdapter: ChannelSecurityAdapter<ResolvedMessengerAccount> = {
  resolveDmPolicy,
  collectWarnings: collectSecurityWarnings,
};

// ============================================================================
// DM Policy Helpers
// ============================================================================

/**
 * Check if a sender is allowed based on DM policy.
 */
export async function isMessengerSenderAllowed(params: {
  cfg: OpenClawConfig;
  senderId: string;
  accountId?: string | null;
  storeAllowFrom?: string[];
}): Promise<{ allowed: boolean; reason: string }> {
  const { cfg, senderId, accountId, storeAllowFrom } = params;
  const account = resolveMessengerAccount({ cfg, accountId });
  const dmPolicy = account.config.dmPolicy ?? "pairing";

  // Open policy - always allowed
  if (dmPolicy === "open") {
    return { allowed: true, reason: "open policy" };
  }

  // Disabled policy - never allowed
  if (dmPolicy === "disabled") {
    return { allowed: false, reason: "DMs disabled" };
  }

  // Get allow-from list
  const configAllowFrom = (account.config.allowFrom ?? [])
    .map((v: string | number) => String(v).trim())
    .filter(Boolean);

  // Check for wildcard
  if (configAllowFrom.includes("*")) {
    return { allowed: true, reason: "wildcard allowlist" };
  }

  // Normalize sender ID
  const normalizedSender = normalizeMessengerTarget(senderId) ?? senderId;

  // Check config allowlist
  const normalizedConfigList = configAllowFrom
    .map((v: string) => normalizeMessengerTarget(v) ?? v.replace(/^messenger:/i, ""))
    .filter(Boolean);

  if (normalizedConfigList.includes(normalizedSender)) {
    return { allowed: true, reason: "config allowlist" };
  }

  // Check store allowlist
  const normalizedStoreList = (storeAllowFrom ?? [])
    .map((v: string) => normalizeMessengerTarget(v) ?? v)
    .filter(Boolean);

  if (normalizedStoreList.includes(normalizedSender)) {
    return { allowed: true, reason: "store allowlist" };
  }

  // Not allowed
  if (dmPolicy === "allowlist") {
    return { allowed: false, reason: "not in allowlist" };
  }

  // Pairing policy - needs pairing request
  return { allowed: false, reason: "pairing required" };
}

import { normalizeAccountId } from "./account-id.js";
import { normalizeMessageChannel } from "./message-channel.js";

/** Default TTL for delivery context in milliseconds (24 hours) */
export const DEFAULT_DELIVERY_CONTEXT_TTL_MS = 24 * 60 * 60 * 1000;

export type DeliveryContext = {
  channel?: string;
  to?: string;
  accountId?: string;
  threadId?: string | number;
  /** Timestamp when this context was last updated (ms since epoch) */
  updatedAt?: number;
};

export type DeliveryContextTrustParams = {
  /** Sender identifier (e.g., E.164 phone number, user id). */
  sender?: string | null;
  /** Allowlist entries for the channel. */
  allowFrom?: Array<string | number>;
  /** When true, trust any sender (no allowlist check). */
  trustAll?: boolean;
};

/**
 * Validates whether a sender is trusted for updating the delivery context.
 * Only messages from allowlisted senders (or when trustAll/wildcard is set) should
 * update the delivery context to prevent routing replies to unknown recipients.
 *
 * @returns true if the sender is trusted, false otherwise
 */
export function isSenderTrustedForDeliveryContext(params: DeliveryContextTrustParams): boolean {
  const { sender, allowFrom, trustAll } = params;

  // If trustAll is explicitly set, allow
  if (trustAll) return true;

  // If no allowFrom list, allow (open policy)
  if (!allowFrom || allowFrom.length === 0) return true;

  // Check for wildcard in allowlist
  const hasWildcard = allowFrom.some((entry) => String(entry).trim() === "*");
  if (hasWildcard) return true;

  // No sender to check - don't trust
  const senderNormalized = sender?.trim();
  if (!senderNormalized) return false;

  // Check if sender is in allowlist
  const allowList = allowFrom.map((entry) => String(entry).trim()).filter(Boolean);
  return allowList.includes(senderNormalized);
}

export type DeliveryContextSessionSource = {
  channel?: string;
  lastChannel?: string;
  lastTo?: string;
  lastAccountId?: string;
  lastThreadId?: string | number;
  deliveryContext?: DeliveryContext;
};

/**
 * Check if a delivery context has expired based on its updatedAt timestamp.
 * @param context The delivery context to check
 * @param ttlMs TTL in milliseconds (default: 24 hours)
 * @returns true if the context has expired, false if valid or no timestamp (backwards compatible)
 */
export function isDeliveryContextExpired(
  context?: DeliveryContext,
  ttlMs: number = DEFAULT_DELIVERY_CONTEXT_TTL_MS,
): boolean {
  if (!context) return true;
  const updatedAt = context.updatedAt;
  // Backwards compatibility: contexts without timestamps are considered valid (not expired)
  if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt)) return false;
  const now = Date.now();
  return now - updatedAt > ttlMs;
}

/**
 * Create a fresh delivery context with the current timestamp.
 */
export function createDeliveryContext(params: Omit<DeliveryContext, "updatedAt">): DeliveryContext {
  return {
    ...normalizeDeliveryContext(params),
    updatedAt: Date.now(),
  };
}

export function normalizeDeliveryContext(context?: DeliveryContext): DeliveryContext | undefined {
  if (!context) return undefined;
  const channel =
    typeof context.channel === "string"
      ? (normalizeMessageChannel(context.channel) ?? context.channel.trim())
      : undefined;
  const to = typeof context.to === "string" ? context.to.trim() : undefined;
  const accountId = normalizeAccountId(context.accountId);
  const threadId =
    typeof context.threadId === "number" && Number.isFinite(context.threadId)
      ? Math.trunc(context.threadId)
      : typeof context.threadId === "string"
        ? context.threadId.trim()
        : undefined;
  const normalizedThreadId =
    typeof threadId === "string" ? (threadId ? threadId : undefined) : threadId;
  // Preserve updatedAt timestamp if present
  const updatedAt =
    typeof context.updatedAt === "number" && Number.isFinite(context.updatedAt)
      ? context.updatedAt
      : undefined;
  if (!channel && !to && !accountId && normalizedThreadId == null) return undefined;
  const normalized: DeliveryContext = {
    channel: channel || undefined,
    to: to || undefined,
    accountId,
  };
  if (normalizedThreadId != null) normalized.threadId = normalizedThreadId;
  if (updatedAt != null) normalized.updatedAt = updatedAt;
  return normalized;
}

export function normalizeSessionDeliveryFields(source?: DeliveryContextSessionSource): {
  deliveryContext?: DeliveryContext;
  lastChannel?: string;
  lastTo?: string;
  lastAccountId?: string;
  lastThreadId?: string | number;
} {
  if (!source) {
    return {
      deliveryContext: undefined,
      lastChannel: undefined,
      lastTo: undefined,
      lastAccountId: undefined,
      lastThreadId: undefined,
    };
  }

  const merged = mergeDeliveryContext(
    normalizeDeliveryContext({
      channel: source.lastChannel ?? source.channel,
      to: source.lastTo,
      accountId: source.lastAccountId,
      threadId: source.lastThreadId,
    }),
    normalizeDeliveryContext(source.deliveryContext),
  );

  if (!merged) {
    return {
      deliveryContext: undefined,
      lastChannel: undefined,
      lastTo: undefined,
      lastAccountId: undefined,
      lastThreadId: undefined,
    };
  }

  return {
    deliveryContext: merged,
    lastChannel: merged.channel,
    lastTo: merged.to,
    lastAccountId: merged.accountId,
    lastThreadId: merged.threadId,
  };
}

export function deliveryContextFromSession(
  entry?: DeliveryContextSessionSource,
  options?: { ttlMs?: number; checkExpiry?: boolean },
): DeliveryContext | undefined {
  if (!entry) return undefined;
  const context = normalizeSessionDeliveryFields(entry).deliveryContext;
  // FIX-3.2: Check for TTL expiration if requested
  if (options?.checkExpiry !== false && isDeliveryContextExpired(context, options?.ttlMs)) {
    return undefined;
  }
  return context;
}

export function mergeDeliveryContext(
  primary?: DeliveryContext,
  fallback?: DeliveryContext,
): DeliveryContext | undefined {
  const normalizedPrimary = normalizeDeliveryContext(primary);
  const normalizedFallback = normalizeDeliveryContext(fallback);
  if (!normalizedPrimary && !normalizedFallback) return undefined;
  // Use the most recent timestamp from either context (only if at least one has it)
  const primaryUpdatedAt = normalizedPrimary?.updatedAt;
  const fallbackUpdatedAt = normalizedFallback?.updatedAt;
  const hasTimestamp = primaryUpdatedAt != null || fallbackUpdatedAt != null;
  const updatedAt = hasTimestamp
    ? Math.max(primaryUpdatedAt ?? 0, fallbackUpdatedAt ?? 0)
    : undefined;
  return normalizeDeliveryContext({
    channel: normalizedPrimary?.channel ?? normalizedFallback?.channel,
    to: normalizedPrimary?.to ?? normalizedFallback?.to,
    accountId: normalizedPrimary?.accountId ?? normalizedFallback?.accountId,
    threadId: normalizedPrimary?.threadId ?? normalizedFallback?.threadId,
    updatedAt,
  });
}

/**
 * Clear the delivery context (returns undefined).
 * Used when resetting routing state (e.g., on logout).
 */
export function clearDeliveryContext(): undefined {
  return undefined;
}

export function deliveryContextKey(context?: DeliveryContext): string | undefined {
  const normalized = normalizeDeliveryContext(context);
  if (!normalized?.channel || !normalized?.to) return undefined;
  const threadId =
    normalized.threadId != null && normalized.threadId !== "" ? String(normalized.threadId) : "";
  return `${normalized.channel}|${normalized.to}|${normalized.accountId ?? ""}|${threadId}`;
}

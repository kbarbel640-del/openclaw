/**
 * Cross-channel deduplication cache.
 *
 * When both the bot (discord) and user (discord-user) gateways are connected
 * to the same guild, both will receive the same MESSAGE_CREATE event.  The
 * first caller to register a message ID wins; the second caller is told to
 * skip.  The bot's synchronous event loop typically fires first, giving it
 * priority.
 *
 * Entries expire after TTL_MS and the cache is capped at MAX_ENTRIES to bound
 * memory usage.
 */

const TTL_MS = 30_000;
const MAX_ENTRIES = 2000;

type CacheEntry = { registeredAt: number };

const cache = new Map<string, CacheEntry>();

/**
 * Returns `true` if this message has already been registered by another
 * channel and should be skipped.  Returns `false` on first call for a
 * given message ID (the caller "wins" and should process the message).
 */
export function shouldSkipCrossChannelDuplicate(messageId: string): boolean {
  const now = Date.now();

  // Periodically prune stale entries
  if (cache.size > MAX_ENTRIES) {
    pruneCache(now);
  }

  const existing = cache.get(messageId);
  if (existing) {
    // Already registered — caller should skip
    return true;
  }

  // First caller wins — register this message
  cache.set(messageId, { registeredAt: now });
  return false;
}

function pruneCache(now: number): void {
  for (const [id, entry] of cache) {
    if (now - entry.registeredAt > TTL_MS) {
      cache.delete(id);
    }
  }
}

/**
 * Visible for testing.
 */
export function clearDedupeCache(): void {
  cache.clear();
}

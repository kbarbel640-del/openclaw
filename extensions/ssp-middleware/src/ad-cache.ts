/**
 * Ad Bid Cache
 *
 * In-memory LRU-like cache for winning bids, keyed by conversation identifier.
 * Ensures each conversation gets at most one sponsored solution per TTL window.
 */

import type { CachedBid, NativeAdAsset } from "./types.js";

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 500;

export class AdCache {
  private cache = new Map<string, CachedBid>();
  private ttlMs: number;

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  /**
   * Store a winning bid for a conversation.
   * Only one bid per conversation key at a time.
   */
  set(conversationKey: string, asset: NativeAdAsset, price: number): void {
    // Evict oldest entries if we hit the cap
    if (this.cache.size >= MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(conversationKey, {
      asset,
      cachedAt: Date.now(),
      price,
      conversationKey,
    });
  }

  /**
   * Retrieve and consume a cached bid for a conversation.
   * Returns the bid once, then removes it (single-use).
   * Returns undefined if no bid exists or if it has expired.
   */
  consume(conversationKey: string): CachedBid | undefined {
    const entry = this.cache.get(conversationKey);
    if (!entry) return undefined;

    // Check TTL expiry
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.cache.delete(conversationKey);
      return undefined;
    }

    // Consume: remove after retrieval (one-shot)
    this.cache.delete(conversationKey);
    return entry;
  }

  /** Check if a conversation has a pending bid (without consuming). */
  has(conversationKey: string): boolean {
    const entry = this.cache.get(conversationKey);
    if (!entry) return false;
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.cache.delete(conversationKey);
      return false;
    }
    return true;
  }

  /** Number of active (non-expired) entries. */
  get size(): number {
    return this.cache.size;
  }

  /** Purge all expired entries. */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.cachedAt > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }
}

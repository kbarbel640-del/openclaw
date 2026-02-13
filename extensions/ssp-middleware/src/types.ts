/**
 * SSP Middleware Types
 * Shared type definitions for the Supply-Side Platform middleware.
 */

/** Result of LLM-based intent extraction from a user message. */
export type IntentSignal = {
  /** Top 3 high-yield commercial keywords (e.g., "tax consultant") */
  keywords: string[];
  /** IAB Content Taxonomy category ID (e.g., "IAB13-2") */
  category: string;
  /** Confidence score from the LLM (0-1) */
  confidence: number;
};

/** Native ad asset returned from a winning bid. */
export type NativeAdAsset = {
  title: string;
  description: string;
  cta: string;
};

/** Cached winning bid for a conversation. */
export type CachedBid = {
  asset: NativeAdAsset;
  /** Timestamp when the bid was cached */
  cachedAt: number;
  /** Original bid price in USD */
  price: number;
  /** Conversation key this bid is associated with */
  conversationKey: string;
};

/** SSP middleware configuration loaded from environment or plugin config. */
export type SspConfig = {
  /** OpenAI API key for GPT-4o-mini intent extraction */
  openaiApiKey: string;
  /** Epom SSP endpoint URL */
  epomEndpoint: string;
  /** Epom site ID for bid requests */
  epomSiteId: string;
  /** Minimum confidence threshold for intent signals (0-1) */
  confidenceThreshold: number;
  /** Bid floor in USD */
  bidFloor: number;
  /** Maximum time to wait for bid response (ms) */
  tmax: number;
  /** TTL for cached bids (ms) */
  bidCacheTtlMs: number;
  /** Whether the SSP middleware is enabled */
  enabled: boolean;
  /** Use mock SSP responder instead of live Epom (for demos/VC presentations) */
  mockMode: boolean;
};

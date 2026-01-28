/**
 * Centralized payload normalization for deduplication and key generation.
 *
 * This module provides a SINGLE source of truth for normalizing reply payloads.
 * Both block reply tracking (in agent-runner-execution.ts) and final payload
 * filtering (in agent-runner-payloads.ts) MUST use these functions to ensure
 * consistent key generation and reliable deduplication.
 *
 * ## Runtime Contract
 *
 * All agent runtimes (Pi, CCSDK) must adhere to:
 *
 * 1. **Final payloads contain user-facing text only**
 *    - `payloads[].text` must NEVER contain reasoning/thinking content
 *    - Reasoning must be streamed via `onReasoningStream` callback
 *    - This ensures gateway/channel delivery never includes internal reasoning
 *
 * 2. **Block replies use the same normalization**
 *    - Both block and final payloads go through `normalizePayloadForDedup`
 *    - This ensures keys always match for deduplication
 *
 * 3. **Whitespace is normalized**
 *    - All text is trimmed for consistent key generation
 *    - Leading/trailing whitespace differences don't break deduplication
 */

import type { ReplyPayload } from "../types.js";

/**
 * Normalized payload structure for deduplication.
 *
 * All fields are in a consistent format suitable for key generation.
 */
export type NormalizedPayload = {
  /** Trimmed text content (never reasoning) */
  text: string;
  /** Normalized media URL list (never undefined, always an array) */
  mediaList: string[];
  /** Reply threading: target message ID */
  replyToId: string | null;
  /** Reply threading: tag flag */
  replyToTag: boolean;
  /** Reply threading: reply to current message flag */
  replyToCurrent: boolean;
  /** Audio as voice flag */
  audioAsVoice: boolean;
};

/**
 * Normalize a payload into a consistent structure for deduplication.
 *
 * This is the SINGLE function used by both:
 * - Block reply tracking in `agent-runner-execution.ts`
 * - Final payload filtering in `agent-runner-payloads.ts`
 *
 * Using the same normalization ensures keys always match.
 */
export function normalizePayloadForDedup(payload: ReplyPayload): NormalizedPayload {
  // Normalize text: trim whitespace for consistent matching
  const text = (payload.text ?? "").trim();

  // Normalize media: collapse mediaUrl and mediaUrls into a single list
  const mediaList = payload.mediaUrls?.length
    ? payload.mediaUrls
    : payload.mediaUrl
      ? [payload.mediaUrl]
      : [];

  return {
    text,
    mediaList,
    replyToId: payload.replyToId ?? null,
    replyToTag: Boolean(payload.replyToTag),
    replyToCurrent: Boolean(payload.replyToCurrent),
    audioAsVoice: Boolean(payload.audioAsVoice),
  };
}

/**
 * Create a stable string key for a payload for deduplication.
 *
 * Payloads with the same key are considered duplicates and one will be filtered.
 */
export function createPayloadKey(payload: ReplyPayload): string {
  const normalized = normalizePayloadForDedup(payload);
  return JSON.stringify({
    text: normalized.text,
    mediaList: normalized.mediaList,
    replyToId: normalized.replyToId,
    replyToTag: normalized.replyToTag,
    replyToCurrent: normalized.replyToCurrent,
    audioAsVoice: normalized.audioAsVoice,
  });
}

/**
 * Check if two payloads are duplicates based on their normalized keys.
 */
export function arePayloadsDuplicates(a: ReplyPayload, b: ReplyPayload): boolean {
  return createPayloadKey(a) === createPayloadKey(b);
}

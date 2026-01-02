/**
 * Deep Research topic normalization helpers
 */

export const MAX_DEEP_RESEARCH_TOPIC_LENGTH = 240;

export function normalizeDeepResearchTopic(
  raw: string,
): { topic: string; truncated: boolean } | null {
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return { topic: normalized, truncated: false };
}

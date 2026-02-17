import type { RoutingProfile, RoutingStats, Tier } from "./types.js";

const stats: RoutingStats = {
  totalRequests: 0,
  requestsByTier: { SIMPLE: 0, MEDIUM: 0, COMPLEX: 0, REASONING: 0 },
  requestsByProvider: {},
  cacheHits: 0,
  cacheMisses: 0,
  dedupHits: 0,
  agenticOverrides: 0,
  activeProfile: "auto",
};

export function recordRequest(tier: Tier, provider: string): void {
  stats.totalRequests++;
  stats.requestsByTier[tier]++;
  stats.requestsByProvider[provider] = (stats.requestsByProvider[provider] ?? 0) + 1;
}

export function recordCacheHit(): void {
  stats.cacheHits++;
}

export function recordCacheMiss(): void {
  stats.cacheMisses++;
}

export function recordDedupHit(): void {
  stats.dedupHits++;
}

export function recordAgenticOverride(): void {
  stats.agenticOverrides++;
}

export function setActiveProfile(profile: RoutingProfile): void {
  stats.activeProfile = profile;
}

export function getStats(): Readonly<RoutingStats> {
  return { ...stats };
}

export function resetStats(): void {
  stats.totalRequests = 0;
  stats.requestsByTier = { SIMPLE: 0, MEDIUM: 0, COMPLEX: 0, REASONING: 0 };
  stats.requestsByProvider = {};
  stats.cacheHits = 0;
  stats.cacheMisses = 0;
  stats.dedupHits = 0;
  stats.agenticOverrides = 0;
}

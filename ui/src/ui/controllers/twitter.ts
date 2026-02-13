/**
 * Twitter dashboard controller
 */

export interface TwitterData {
  profile: {
    followers: number;
    followers_growth_24h: number;
    followers_growth_7d: number;
    following: number;
    ff_ratio: string;
    tweet_count: number;
    tweets_last_7d: number;
  };
  engagement: {
    rate_avg_7d: number;
    reach_rate: number;
  };
  tweets: Array<{
    id: string;
    text: string;
    created_at: string;
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
    engagement_rate: string;
  }>;
  alerts: Array<{
    type: "info" | "warning" | "error";
    severity: "low" | "medium" | "high" | "critical";
    message: string;
  }>;
  lastUpdated?: string;
}

let cachedData: TwitterData | null = null;
let lastFetch = 0;
const CACHE_TTL = 15 * 60 * 1000; // 15min

export async function loadTwitterData(): Promise<TwitterData | null> {
  const now = Date.now();

  // Use cache if fresh
  if (cachedData && now - lastFetch < CACHE_TTL) {
    return cachedData;
  }

  try {
    const response = await fetch("/api/twitter/dashboard");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.data) {
      cachedData = result.data;
      lastFetch = now;
      return cachedData;
    }

    return null;
  } catch (error) {
    console.error("Failed to load Twitter data:", error);
    return null;
  }
}

export function needsRefresh(): boolean {
  return !cachedData || Date.now() - lastFetch >= CACHE_TTL;
}

export function clearCache(): void {
  cachedData = null;
  lastFetch = 0;
}

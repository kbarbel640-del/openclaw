/**
 * Twitter API Endpoint - Fast Version (< 3s)
 * Skip genealogy for initial load, provide separate endpoint if needed
 * Updated to use xfetch-cli (wrapper 'x')
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// Use the 'x' wrapper which has credentials embedded
async function execX(command: string, timeout = 10000): Promise<Record<string, unknown>> {
  try {
    const fullCommand = `x ${command} --format json`;
    const { stdout } = await execAsync(fullCommand, {
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (stdout.trim()) {
      return JSON.parse(stdout.trim()) as Record<string, unknown>;
    }

    throw new Error("No JSON output from x CLI");
  } catch (error) {
    const err = error as { killed?: boolean; signal?: string; message?: string };
    if (err.killed || err.signal) {
      throw new Error(`x CLI timeout: ${command}`, { cause: error });
    }
    throw new Error(`x CLI error: ${err.message ?? String(error)}`, { cause: error });
  }
}

async function getWhoami(): Promise<{ username: string; userId: string }> {
  // Get current user via 'x user @handle' (need to know handle first)
  // For now, hardcode known account
  const data = await execX("user @CriptoMonkeyMan");
  return {
    username: (data.screenName as string) || "CriptoMonkeyMan",
    userId: (data.restId as string) || "1960364446976811008",
  };
}

interface TwitterUser {
  id: string;
  username: string;
  name: string;
  avatar: string;
  followers: number;
  following: number;
  verified: boolean;
  description?: string;
}

export async function getTwitterRelationships(limit = 50) {
  const startTime = Date.now();

  try {
    const whoami = await getWhoami();

    // Get following list
    const followingData = await execX(`following @${whoami.username} -n ${limit}`);
    const followingUsers: TwitterUser[] = ((followingData.items as unknown[]) || []).map(
      (user: unknown) => {
        const u = user as Record<string, unknown>;
        const restId = u.restId && typeof u.restId === "string" ? u.restId : "";
        const userId = u.id && typeof u.id === "string" ? u.id : "";
        const screenName = u.screenName && typeof u.screenName === "string" ? u.screenName : "";
        const username = u.username && typeof u.username === "string" ? u.username : "";
        const name = u.name && typeof u.name === "string" ? u.name : "";
        const profileImageUrl =
          u.profileImageUrl && typeof u.profileImageUrl === "string" ? u.profileImageUrl : "";
        const avatarUrl = u.avatarUrl && typeof u.avatarUrl === "string" ? u.avatarUrl : "";
        const description = u.description && typeof u.description === "string" ? u.description : "";

        return {
          id: restId || userId || "",
          username: screenName || username || "",
          name,
          avatar: (profileImageUrl || avatarUrl || "")
            .replace("_normal", "_bigger")
            .replace("http://", "https://"),
          followers: Number(u.followersCount) || 0,
          following: Number(u.followingCount) || 0,
          verified: Boolean(u.verified),
          description,
        };
      },
    );

    // Get followers list (sample)
    const followersData = await execX(`followers @${whoami.username} -n ${Math.min(limit, 30)}`);
    const followersUsers: TwitterUser[] = ((followersData.items as unknown[]) || []).map(
      (user: unknown) => {
        const u = user as Record<string, unknown>;
        const restId = u.restId && typeof u.restId === "string" ? u.restId : "";
        const userId = u.id && typeof u.id === "string" ? u.id : "";
        const screenName = u.screenName && typeof u.screenName === "string" ? u.screenName : "";
        const username = u.username && typeof u.username === "string" ? u.username : "";
        const name = u.name && typeof u.name === "string" ? u.name : "";
        const profileImageUrl =
          u.profileImageUrl && typeof u.profileImageUrl === "string" ? u.profileImageUrl : "";
        const avatarUrl = u.avatarUrl && typeof u.avatarUrl === "string" ? u.avatarUrl : "";
        const description = u.description && typeof u.description === "string" ? u.description : "";

        return {
          id: restId || userId || "",
          username: screenName || username || "",
          name,
          avatar: (profileImageUrl || avatarUrl || "")
            .replace("_normal", "_bigger")
            .replace("http://", "https://"),
          followers: Number(u.followersCount) || 0,
          following: Number(u.followingCount) || 0,
          verified: Boolean(u.verified),
          description,
        };
      },
    );

    // Detect mutual relationships
    const followersSet = new Set(followersUsers.map((u) => u.id));
    const relationships = followingUsers.map((user) => ({
      ...user,
      isMutual: followersSet.has(user.id),
    }));

    const responseTimeMs = Date.now() - startTime;

    return {
      success: true,
      data: {
        current_user: {
          id: whoami.userId,
          username: whoami.username,
        },
        following: relationships,
        followers_sample: followersUsers,
      },
      timestamp: new Date().toISOString(),
      responseTimeMs,
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    const err = error as { message?: string };

    return {
      success: false,
      error: err.message || "Unknown error",
      timestamp: new Date().toISOString(),
      responseTimeMs,
    };
  }
}

export async function getTwitterDashboardData() {
  const startTime = Date.now();

  try {
    // Get profile info
    const whoami = await getWhoami();
    const profile = await execX(`user @${whoami.username}`);

    // Parallel fetch: tweets and home timeline
    const [tweets] = await Promise.all([
      execX(`tweets @${whoami.username} -n 20`),
      execX("home -n 10").catch(() => ({ items: [] })),
    ]);

    const tweetItems = (tweets.items as unknown[]) || [];

    const data = {
      profile: {
        followers: Number(profile.followersCount) || 0,
        followers_growth_24h: 0, // TODO: track over time
        followers_growth_7d: 0, // TODO: track over time
        following: Number(profile.followingCount) || 0,
        ff_ratio:
          profile.followersCount && profile.followingCount
            ? (Number(profile.followersCount) / Number(profile.followingCount)).toFixed(2)
            : "0",
        tweet_count: Number(profile.tweetCount) || 0,
        tweets_last_7d: tweetItems.length, // Approximation
      },
      engagement: {
        rate_avg_7d: 0, // TODO: calculate from tweets
        reach_rate: 0, // TODO: calculate impressions/followers
      },
      tweets: tweetItems.slice(0, 10).map((tweet: unknown) => {
        const t = tweet as Record<string, unknown>;
        const likeCount = Number(t.likeCount) || 0;
        const retweetCount = Number(t.retweetCount) || 0;
        const replyCount = Number(t.replyCount) || 0;
        const viewCount = Number(t.viewCount) || 0;
        const tweetId = t.id && typeof t.id === "string" ? t.id : "";
        const text = t.text && typeof t.text === "string" ? t.text : "";
        const createdAt =
          t.createdAt && typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString();

        return {
          id: tweetId,
          text,
          created_at: createdAt,
          likes: likeCount,
          retweets: retweetCount,
          replies: replyCount,
          impressions: viewCount,
          engagement_rate:
            likeCount && viewCount
              ? (((likeCount + retweetCount + replyCount) / viewCount) * 100).toFixed(2)
              : "0",
        };
      }),
      alerts: [], // TODO: implement alert logic
      lastUpdated: new Date().toISOString(),
    };

    const responseTimeMs = Date.now() - startTime;

    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      responseTimeMs,
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    const err = error as { message?: string };

    return {
      success: false,
      error: err.message || "Unknown error",
      timestamp: new Date().toISOString(),
      responseTimeMs,
    };
  }
}

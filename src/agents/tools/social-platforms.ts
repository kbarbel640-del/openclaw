import { Type } from "@sinclair/typebox";
import type { OpenClawConfig } from "../../config/config.js";
import type { AnyAgentTool } from "./common.js";
import { wrapExternalContent } from "../../security/external-content.js";
import { normalizeSecretInput } from "../../utils/normalize-secret-input.js";
import { stringEnum } from "../schema/typebox.js";
import {
  jsonResult,
  readNumberParam,
  readStringParam,
  readStringArrayParam,
  ToolInputError,
} from "./common.js";
import {
  CacheEntry,
  DEFAULT_CACHE_TTL_MINUTES,
  normalizeCacheKey,
  readCache,
  readResponseText,
  resolveCacheTtlMs,
  resolveTimeoutSeconds,
  withTimeout,
  writeCache,
} from "./web-shared.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOCIAL_PLATFORMS = ["instagram", "tiktok", "youtube"] as const;
type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

const INSTAGRAM_MODES = ["url", "search"] as const;
const INSTAGRAM_URL_TYPES = ["posts", "comments", "mentions", "urls"] as const;
const INSTAGRAM_SEARCH_TYPES = ["hashtags", "places", "users"] as const;
const TIKTOK_TYPES = ["search", "hashtags", "videos", "profiles"] as const;

const DEFAULT_APIFY_BASE_URL = "https://api.apify.com";
const DEFAULT_TIMEOUT_SECONDS = 60;
const DEFAULT_MAX_RESULTS = 20;
const MAX_RESULT_CHARS = 50_000;

const ACTOR_IDS: Record<SocialPlatform, string> = {
  instagram: "shu8hvrXbJbY3Eb9W",
  tiktok: "GdWCkxBtKWOsKjdch",
  youtube: "h7sDV53CddomktSi5",
};

const SOCIAL_CACHE = new Map<string, CacheEntry<Record<string, unknown>>>();

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SocialPlatformsSchema = Type.Object({
  platform: stringEnum(SOCIAL_PLATFORMS, {
    description: "Social media platform to scrape.",
  }),

  // Instagram-specific
  instagramMode: Type.Optional(
    stringEnum(INSTAGRAM_MODES, {
      description: "Instagram: 'url' to scrape direct URLs, 'search' to search by query.",
    }),
  ),
  instagramType: Type.Optional(
    stringEnum([...INSTAGRAM_URL_TYPES, ...INSTAGRAM_SEARCH_TYPES] as const, {
      description:
        "Instagram data type. URL mode: posts, comments, mentions, urls. Search mode: hashtags, places, users.",
    }),
  ),

  // TikTok-specific
  tiktokType: Type.Optional(
    stringEnum(TIKTOK_TYPES, {
      description: "TikTok input type: search queries, hashtags, video URLs, or profiles.",
    }),
  ),

  // Common inputs
  urls: Type.Optional(
    Type.Array(Type.String(), {
      description: "URLs to scrape (Instagram URLs, TikTok video URLs, YouTube URLs).",
    }),
  ),
  queries: Type.Optional(
    Type.Array(Type.String(), {
      description: "Search terms (Instagram search, TikTok search, YouTube search).",
    }),
  ),
  hashtags: Type.Optional(
    Type.Array(Type.String(), {
      description: "Hashtags to scrape (TikTok).",
    }),
  ),
  profiles: Type.Optional(
    Type.Array(Type.String(), {
      description: "Profile usernames (TikTok profiles).",
    }),
  ),
  maxResults: Type.Optional(
    Type.Number({
      description: "Maximum results to return (default: 20).",
      minimum: 1,
      maximum: 100,
    }),
  ),
});

// ---------------------------------------------------------------------------
// Config resolution (follows Firecrawl pattern)
// ---------------------------------------------------------------------------

type SocialConfig = NonNullable<OpenClawConfig["tools"]>["social"];

function resolveSocialConfig(cfg?: OpenClawConfig): SocialConfig {
  return cfg?.tools?.social;
}

function resolveSocialApiKey(config?: SocialConfig): string | undefined {
  const fromConfig =
    config && typeof config.apiKey === "string" ? normalizeSecretInput(config.apiKey) : "";
  const fromEnv = normalizeSecretInput(process.env.APIFY_API_KEY);
  return fromConfig || fromEnv || undefined;
}

function resolveSocialEnabled(params: { config?: SocialConfig; apiKey?: string }): boolean {
  if (typeof params.config?.enabled === "boolean") {
    return params.config.enabled;
  }
  return Boolean(params.apiKey);
}

function resolveSocialBaseUrl(config?: SocialConfig): string {
  const raw = config && typeof config.baseUrl === "string" ? config.baseUrl.trim() : "";
  return raw || DEFAULT_APIFY_BASE_URL;
}

function resolveAllowedPlatforms(config?: SocialConfig): Set<SocialPlatform> {
  const list = config?.allowedPlatforms;
  if (Array.isArray(list) && list.length > 0) {
    return new Set(list.filter((p): p is SocialPlatform => SOCIAL_PLATFORMS.includes(p as never)));
  }
  return new Set(SOCIAL_PLATFORMS);
}

function resolveMaxResults(config?: SocialConfig): number {
  const raw = config?.maxResults;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.min(100, Math.floor(raw));
  }
  return DEFAULT_MAX_RESULTS;
}

// ---------------------------------------------------------------------------
// Per-platform input builders
// ---------------------------------------------------------------------------

function buildInstagramInput(params: {
  mode: string;
  type: string;
  urls?: string[];
  queries?: string[];
  maxResults: number;
}): Record<string, unknown> {
  if (params.mode === "url") {
    if (!params.urls?.length) {
      throw new ToolInputError("Instagram URL mode requires 'urls' parameter.");
    }
    return {
      directUrls: params.urls,
      resultsType: params.type === "urls" ? "posts" : params.type,
      resultsLimit: params.maxResults,
    };
  }
  // search mode
  if (!params.queries?.length) {
    throw new ToolInputError("Instagram search mode requires 'queries' parameter.");
  }
  return {
    search: params.queries[0],
    searchType: params.type,
    searchLimit: params.maxResults,
    resultsType: "posts",
    resultsLimit: params.maxResults,
  };
}

function buildTiktokInput(params: {
  type: string;
  queries?: string[];
  hashtags?: string[];
  urls?: string[];
  profiles?: string[];
  maxResults: number;
}): Record<string, unknown> {
  const base = {
    resultsPerPage: params.maxResults,
    shouldDownloadVideos: false,
    shouldDownloadSubtitles: false,
    shouldDownloadCovers: false,
    shouldDownloadAvatars: false,
    shouldDownloadSlideshowImages: false,
    shouldDownloadMusicCovers: false,
  };
  switch (params.type) {
    case "search":
      if (!params.queries?.length) {
        throw new ToolInputError("TikTok search requires 'queries' parameter.");
      }
      return { ...base, searchQueries: params.queries };
    case "hashtags":
      if (!params.hashtags?.length) {
        throw new ToolInputError("TikTok hashtags requires 'hashtags' parameter.");
      }
      return { ...base, hashtags: params.hashtags };
    case "videos":
      if (!params.urls?.length) {
        throw new ToolInputError("TikTok videos requires 'urls' parameter.");
      }
      return { ...base, videoUrls: params.urls };
    case "profiles":
      if (!params.profiles?.length) {
        throw new ToolInputError("TikTok profiles requires 'profiles' parameter.");
      }
      return { ...base, profiles: params.profiles, profileScrapeSections: ["videos"] };
    default:
      throw new ToolInputError(`Unknown TikTok type: ${params.type}`);
  }
}

function buildYoutubeInput(params: {
  urls?: string[];
  queries?: string[];
  maxResults: number;
}): Record<string, unknown> {
  if (params.urls?.length) {
    return {
      startUrls: params.urls.map((url) => ({ url })),
      maxResults: params.maxResults,
    };
  }
  if (params.queries?.length) {
    return {
      searchKeywords: params.queries.join(", "),
      maxResults: params.maxResults,
    };
  }
  throw new ToolInputError("YouTube requires 'urls' or 'queries' parameter.");
}

// ---------------------------------------------------------------------------
// Apify API call
// ---------------------------------------------------------------------------

async function runApifyActor(params: {
  actorId: string;
  input: Record<string, unknown>;
  apiKey: string;
  baseUrl: string;
  timeoutSeconds: number;
}): Promise<unknown[]> {
  const endpoint = `${params.baseUrl}/v2/acts/${params.actorId}/run-sync-get-dataset-items`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(params.input),
    signal: withTimeout(undefined, params.timeoutSeconds * 1000),
  });

  if (!res.ok) {
    const detailResult = await readResponseText(res, { maxBytes: 64_000 });
    const detail = detailResult.text;
    throw new Error(`Apify actor run failed (${res.status}): ${detail || res.statusText}`);
  }
  return (await res.json()) as unknown[];
}

// ---------------------------------------------------------------------------
// Result formatters (Apify JSON → markdown for LLM)
// ---------------------------------------------------------------------------

function str(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value as string | number | boolean);
}

function num(value: unknown): string {
  if (typeof value === "number") {
    return value.toLocaleString();
  }
  return str(value);
}

function formatInstagramItem(item: Record<string, unknown>): string {
  const lines: string[] = [`## Instagram Post by @${str(item.ownerUsername)}`];
  if (item.url) {
    lines.push(`**URL**: ${str(item.url)}`);
  }
  if (item.type) {
    lines.push(`**Type**: ${str(item.type)}`);
  }
  const stats: string[] = [];
  if (item.likesCount !== undefined) {
    stats.push(`Likes: ${num(item.likesCount)}`);
  }
  if (item.commentsCount !== undefined) {
    stats.push(`Comments: ${num(item.commentsCount)}`);
  }
  if (stats.length) {
    lines.push(`**${stats.join(" | ")}**`);
  }
  if (item.caption) {
    lines.push(`**Caption**: ${str(item.caption)}`);
  }
  if (item.timestamp) {
    lines.push(`**Posted**: ${str(item.timestamp)}`);
  }
  return lines.join("\n");
}

function formatTiktokItem(item: Record<string, unknown>): string {
  const author =
    item.authorMeta && typeof item.authorMeta === "object"
      ? (item.authorMeta as Record<string, unknown>).name
      : item.author;
  const lines: string[] = [`## TikTok Video by @${str(author)}`];
  if (item.webVideoUrl) {
    lines.push(`**URL**: ${str(item.webVideoUrl)}`);
  }
  const stats: string[] = [];
  if (item.playCount !== undefined) {
    stats.push(`Plays: ${num(item.playCount)}`);
  }
  if (item.diggCount !== undefined) {
    stats.push(`Likes: ${num(item.diggCount)}`);
  }
  if (item.shareCount !== undefined) {
    stats.push(`Shares: ${num(item.shareCount)}`);
  }
  if (item.commentCount !== undefined) {
    stats.push(`Comments: ${num(item.commentCount)}`);
  }
  if (stats.length) {
    lines.push(`**${stats.join(" | ")}**`);
  }
  if (item.text) {
    lines.push(`**Description**: ${str(item.text)}`);
  }
  const videoMeta = item.videoMeta as Record<string, unknown> | undefined;
  if (videoMeta?.duration) {
    lines.push(`**Duration**: ${num(videoMeta.duration)}s`);
  }
  if (item.createTimeISO) {
    lines.push(`**Posted**: ${str(item.createTimeISO)}`);
  }
  return lines.join("\n");
}

function formatYoutubeItem(item: Record<string, unknown>): string {
  const lines: string[] = [`## ${str(item.title)}`];
  if (item.url) {
    lines.push(`**URL**: ${str(item.url)}`);
  }
  if (item.channelName) {
    const subs = item.numberOfSubscribers ? ` (${num(item.numberOfSubscribers)} subscribers)` : "";
    lines.push(`**Channel**: ${str(item.channelName)}${subs}`);
  }
  const stats: string[] = [];
  if (item.viewCount !== undefined) {
    stats.push(`Views: ${num(item.viewCount)}`);
  }
  if (item.likes !== undefined) {
    stats.push(`Likes: ${num(item.likes)}`);
  }
  if (stats.length) {
    lines.push(`**${stats.join(" | ")}**`);
  }
  if (item.duration) {
    lines.push(`**Duration**: ${str(item.duration)}`);
  }
  if (item.date) {
    lines.push(`**Published**: ${str(item.date)}`);
  }
  if (item.text) {
    lines.push(`**Description**: ${str(item.text)}`);
  }
  return lines.join("\n");
}

function formatPlatformResults(platform: SocialPlatform, items: unknown[]): string {
  const formatter =
    platform === "instagram"
      ? formatInstagramItem
      : platform === "tiktok"
        ? formatTiktokItem
        : formatYoutubeItem;

  const parts = items.map((item) => {
    try {
      return formatter(item as Record<string, unknown>);
    } catch {
      return `## [unreadable item]\n${JSON.stringify(item).slice(0, 200)}`;
    }
  });

  const text = parts.join("\n\n---\n\n");
  if (text.length > MAX_RESULT_CHARS) {
    return text.slice(0, MAX_RESULT_CHARS) + "\n\n[…truncated]";
  }
  return text;
}

// ---------------------------------------------------------------------------
// Tool description builder
// ---------------------------------------------------------------------------

function buildToolDescription(allowed: Set<SocialPlatform>): string {
  const lines = [
    "Scrape structured data from social media platforms via Apify.",
    "Always prefer this tool over web_fetch for Instagram, TikTok, and YouTube data.",
    "",
    "PARAMETER RULES:",
    '- "platform" is always required.',
    "- Each platform requires specific parameters (see below). Omit parameters not relevant to the chosen platform.",
    "",
  ];

  if (allowed.has("instagram")) {
    lines.push(
      'INSTAGRAM (platform="instagram"):',
      "  Requires: instagramMode + instagramType.",
      '  Mode "url" — scrape direct Instagram URLs:',
      "    instagramType: posts | comments | mentions | urls",
      "    Requires: urls (array of Instagram post/profile/reel URLs)",
      '    Example: { platform: "instagram", instagramMode: "url", instagramType: "posts", urls: ["https://www.instagram.com/natgeo/"] }',
      '  Mode "search" — search Instagram by keyword:',
      "    instagramType: hashtags | places | users",
      "    Requires: queries (array of search terms)",
      '    Example: { platform: "instagram", instagramMode: "search", instagramType: "hashtags", queries: ["sunset photography"] }',
      "",
    );
  }

  if (allowed.has("tiktok")) {
    lines.push(
      'TIKTOK (platform="tiktok"):',
      "  Requires: tiktokType + the matching input array.",
      '  tiktokType="search"   → requires queries (search terms)',
      '  tiktokType="hashtags" → requires hashtags (without # prefix)',
      '  tiktokType="videos"   → requires urls (TikTok video URLs)',
      '  tiktokType="profiles" → requires profiles (usernames without @)',
      '  Example: { platform: "tiktok", tiktokType: "search", queries: ["AI coding tools"] }',
      "",
    );
  }

  if (allowed.has("youtube")) {
    lines.push(
      'YOUTUBE (platform="youtube"):',
      "  Provide either urls (video/channel/playlist URLs) or queries (search keywords). At least one is required.",
      '  Example (search): { platform: "youtube", queries: ["machine learning tutorial"] }',
      '  Example (URL):    { platform: "youtube", urls: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"] }',
      "",
    );
  }

  lines.push(
    "COMMON OPTIONS:",
    "- maxResults: number (1-100, default 20). Controls how many items are returned.",
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

async function runSocialPlatforms(params: {
  args: Record<string, unknown>;
  allowedPlatforms: Set<SocialPlatform>;
  apiKey: string | undefined;
  baseUrl: string;
  defaultMaxResults: number;
  timeoutSeconds: number;
  cacheTtlMs: number;
}): Promise<Record<string, unknown>> {
  const platform = readStringParam(params.args, "platform", { required: true }) as SocialPlatform;

  if (!params.allowedPlatforms.has(platform)) {
    throw new ToolInputError(`Platform "${platform}" is not enabled.`);
  }
  if (!params.apiKey) {
    return {
      error: "missing_api_key",
      message: "Set APIFY_API_KEY env var or tools.social.apiKey in config.",
      docs: "https://docs.openclaw.ai/tools/social",
    };
  }

  const maxResults = readNumberParam(params.args, "maxResults") ?? params.defaultMaxResults;
  const urls = readStringArrayParam(params.args, "urls");
  const queries = readStringArrayParam(params.args, "queries");
  const hashtags = readStringArrayParam(params.args, "hashtags");
  const profiles = readStringArrayParam(params.args, "profiles");

  // Build platform-specific input
  let input: Record<string, unknown>;
  const actorId = ACTOR_IDS[platform];

  switch (platform) {
    case "instagram": {
      const mode = readStringParam(params.args, "instagramMode", { required: true });
      const type = readStringParam(params.args, "instagramType", { required: true });
      input = buildInstagramInput({ mode, type, urls, queries, maxResults });
      break;
    }
    case "tiktok": {
      const type = readStringParam(params.args, "tiktokType", { required: true });
      input = buildTiktokInput({ type, queries, hashtags, urls, profiles, maxResults });
      break;
    }
    case "youtube": {
      input = buildYoutubeInput({ urls, queries, maxResults });
      break;
    }
  }

  // Cache check
  const cacheKey = normalizeCacheKey(`social:${platform}:${JSON.stringify(input)}`);
  const cached = readCache(SOCIAL_CACHE, cacheKey);
  if (cached) {
    return { ...cached.value, cached: true };
  }

  // Call Apify
  const start = Date.now();
  const items = await runApifyActor({
    actorId,
    input,
    apiKey: params.apiKey,
    baseUrl: params.baseUrl,
    timeoutSeconds: params.timeoutSeconds,
  });

  // Format results
  const text = formatPlatformResults(platform, items);
  const wrapped = wrapExternalContent(text, {
    source: "social_platforms",
    includeWarning: true,
  });

  const payload: Record<string, unknown> = {
    platform,
    resultCount: items.length,
    tookMs: Date.now() - start,
    text: wrapped,
    externalContent: { untrusted: true, source: "social_platforms", wrapped: true },
    fetchedAt: new Date().toISOString(),
  };

  writeCache(SOCIAL_CACHE, cacheKey, payload, params.cacheTtlMs);
  return payload;
}

// ---------------------------------------------------------------------------
// Main tool factory
// ---------------------------------------------------------------------------

export function createSocialPlatformsTool(options?: {
  config?: OpenClawConfig;
}): AnyAgentTool | null {
  const config = resolveSocialConfig(options?.config);
  const apiKey = resolveSocialApiKey(config);
  if (!resolveSocialEnabled({ config, apiKey })) {
    return null;
  }

  const allowedPlatforms = resolveAllowedPlatforms(config);
  const baseUrl = resolveSocialBaseUrl(config);
  const defaultMaxResults = resolveMaxResults(config);
  const timeoutSeconds = resolveTimeoutSeconds(config?.timeoutSeconds, DEFAULT_TIMEOUT_SECONDS);
  const cacheTtlMs = resolveCacheTtlMs(config?.cacheTtlMinutes, DEFAULT_CACHE_TTL_MINUTES);
  const description = buildToolDescription(allowedPlatforms);

  return {
    label: "Social Platforms",
    name: "social_platforms",
    description,
    parameters: SocialPlatformsSchema,
    execute: async (_toolCallId, args) => {
      const result = await runSocialPlatforms({
        args: args as Record<string, unknown>,
        allowedPlatforms,
        apiKey,
        baseUrl,
        defaultMaxResults,
        timeoutSeconds,
        cacheTtlMs,
      });
      return jsonResult(result);
    },
  };
}

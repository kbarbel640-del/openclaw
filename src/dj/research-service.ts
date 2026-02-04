/**
 * Research Service for DJ Assistant
 *
 * Handles research operations including:
 * - Budget-aware depth limits
 * - Caching to avoid repeated API spend
 * - Saving to Notion Research Radar
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { NotionService } from "./notion/notion-service.js";
import type { ResearchRadarEntry } from "./notion/types.js";

// =============================================================================
// Types
// =============================================================================

export type BudgetProfileId = "cheap" | "normal" | "deep";

export interface ResearchLimits {
  maxSearches: number;
  maxFetches: number;
  maxCharsPerFetch: number;
}

export interface ResearchResult {
  query: string;
  findings: string[];
  citations: Array<{ title: string; url: string }>;
  nextActions: string[];
  uncertainty?: string;
  profile: BudgetProfileId;
  searchCount: number;
  fetchCount: number;
  cachedAt?: string;
  fromCache: boolean;
}

export interface ResearchCacheEntry {
  query: string;
  urls: string[];
  result: ResearchResult;
  cachedAt: string;
  expiresAt: string;
}

export interface ResearchServiceConfig {
  /** Notion service for saving to Research Radar */
  notionService?: NotionService;
  /** Auto-save all research to Notion */
  autoSave: boolean;
  /** Cache TTL in hours */
  cacheTtlHours: number;
  /** Cache directory path */
  cacheDir?: string;
  /** Research limits per profile */
  limits: Record<BudgetProfileId, ResearchLimits>;
}

// =============================================================================
// Default Configuration
// =============================================================================

export const DEFAULT_RESEARCH_LIMITS: Record<BudgetProfileId, ResearchLimits> = {
  cheap: {
    maxSearches: 1,
    maxFetches: 2,
    maxCharsPerFetch: 10000,
  },
  normal: {
    maxSearches: 2,
    maxFetches: 5,
    maxCharsPerFetch: 50000,
  },
  deep: {
    maxSearches: 5,
    maxFetches: 10,
    maxCharsPerFetch: 100000,
  },
};

export const DEFAULT_RESEARCH_CONFIG: ResearchServiceConfig = {
  autoSave: false,
  cacheTtlHours: 24,
  limits: DEFAULT_RESEARCH_LIMITS,
};

// =============================================================================
// Research Service
// =============================================================================

export class ResearchService {
  private config: ResearchServiceConfig;
  private cacheDir: string;

  constructor(config: Partial<ResearchServiceConfig> = {}) {
    this.config = {
      ...DEFAULT_RESEARCH_CONFIG,
      ...config,
      limits: {
        ...DEFAULT_RESEARCH_LIMITS,
        ...config.limits,
      },
    };
    this.cacheDir = config.cacheDir ?? join(homedir(), ".openclaw", "cache", "research");
  }

  /**
   * Set the Notion service for saving research entries.
   */
  setNotionService(service: NotionService): void {
    this.config.notionService = service;
  }

  /**
   * Get research limits for a budget profile.
   */
  getLimits(profile: BudgetProfileId): ResearchLimits {
    return this.config.limits[profile];
  }

  // ===========================================================================
  // Cache Operations
  // ===========================================================================

  /**
   * Generate a cache key for a research query.
   */
  generateCacheKey(query: string, urls: string[] = []): string {
    const normalized = query.toLowerCase().trim();
    const sortedUrls = [...urls].sort().join("|");
    const content = `${normalized}|${sortedUrls}`;
    return createHash("sha256").update(content).digest("hex").slice(0, 16);
  }

  /**
   * Check cache for existing research results.
   */
  checkCache(cacheKey: string): ResearchCacheEntry | null {
    const cachePath = this.getCachePath(cacheKey);

    if (!existsSync(cachePath)) {
      return null;
    }

    try {
      const content = readFileSync(cachePath, "utf-8");
      const entry = JSON.parse(content) as ResearchCacheEntry;

      // Check expiration
      if (new Date(entry.expiresAt) < new Date()) {
        return null; // Expired
      }

      return entry;
    } catch {
      return null;
    }
  }

  /**
   * Save research results to cache.
   */
  saveCache(cacheKey: string, result: ResearchResult, urls: string[]): void {
    const cachePath = this.getCachePath(cacheKey);
    const dir = join(this.cacheDir);

    // Ensure cache directory exists
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.cacheTtlHours * 60 * 60 * 1000);

    const entry: ResearchCacheEntry = {
      query: result.query,
      urls,
      result: {
        ...result,
        cachedAt: now.toISOString(),
        fromCache: false, // Will be true when read from cache
      },
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    writeFileSync(cachePath, JSON.stringify(entry, null, 2), "utf-8");
  }

  /**
   * Get cache file path for a cache key.
   */
  private getCachePath(cacheKey: string): string {
    return join(this.cacheDir, `${cacheKey}.json`);
  }

  // ===========================================================================
  // Save to Notion
  // ===========================================================================

  /**
   * Save research results to Notion Research Radar.
   * Dedupes by cache key - if entry exists, updates it.
   *
   * @returns Page URL if saved successfully, null if not configured or failed
   */
  async saveToNotion(result: ResearchResult): Promise<string | null> {
    if (!this.config.notionService) {
      console.warn("[research-service] Notion service not configured, skipping save");
      return null;
    }

    const cacheKey = this.generateCacheKey(
      result.query,
      result.citations.map((c) => c.url),
    );

    const entry: ResearchRadarEntry = {
      title: result.query,
      query: result.query,
      summary: result.findings,
      citations: result.citations,
      nextActions: result.nextActions,
      uncertainty: result.uncertainty,
      cacheKey,
      profile: result.profile,
      searchCount: result.searchCount,
      fetchCount: result.fetchCount,
    };

    try {
      const page = await this.config.notionService.saveResearchEntry(entry);
      if (page) {
        console.log(`[research-service] Saved to Research Radar: ${page.id}`);
        return page.url;
      }
      return null;
    } catch (error) {
      console.error("[research-service] Failed to save to Notion:", error);
      return null;
    }
  }

  /**
   * Check if a research query already exists in Notion.
   */
  async checkNotionDuplicate(query: string, urls: string[]): Promise<boolean> {
    if (!this.config.notionService) {
      return false;
    }

    const cacheKey = this.generateCacheKey(query, urls);
    const existing = await this.config.notionService.findResearchByCacheKey(cacheKey);

    return existing !== null;
  }

  // ===========================================================================
  // Result Formatting
  // ===========================================================================

  /**
   * Format research results as markdown.
   */
  formatAsMarkdown(result: ResearchResult): string {
    const lines: string[] = [];

    lines.push(`## Research: ${result.query}`);
    lines.push("");

    // Key findings
    lines.push("### Key Findings");
    for (const finding of result.findings) {
      lines.push(`- ${finding}`);
    }
    lines.push("");

    // Sources
    lines.push("### Sources");
    for (let i = 0; i < result.citations.length; i++) {
      const citation = result.citations[i];
      lines.push(`${i + 1}. [${citation.title}](${citation.url})`);
    }
    lines.push("");

    // Next actions
    if (result.nextActions.length > 0) {
      lines.push("### Next Actions");
      for (const action of result.nextActions) {
        lines.push(`- [ ] ${action}`);
      }
      lines.push("");
    }

    // Uncertainty
    if (result.uncertainty) {
      lines.push("### Uncertainty");
      lines.push(result.uncertainty);
      lines.push("");
    }

    // Cache status
    if (result.fromCache) {
      lines.push(`*Cached: ${result.cachedAt}*`);
    }

    return lines.join("\n");
  }

  /**
   * Get configuration (for display/debugging).
   */
  getConfig(): ResearchServiceConfig {
    return { ...this.config };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a research service with default configuration.
 */
export function createResearchService(config?: Partial<ResearchServiceConfig>): ResearchService {
  return new ResearchService(config);
}

/**
 * Load research service configuration from environment variables.
 */
export function loadResearchConfig(): Partial<ResearchServiceConfig> {
  const config: Partial<ResearchServiceConfig> = {
    autoSave: process.env.DJ_RESEARCH_AUTO_SAVE === "true",
    cacheTtlHours: parseInt(process.env.DJ_RESEARCH_CACHE_TTL_HOURS ?? "24", 10),
  };

  // Load custom limits from env if present
  const limits: Partial<Record<BudgetProfileId, ResearchLimits>> = {};

  if (process.env.DJ_RESEARCH_CHEAP_MAX_SEARCHES) {
    limits.cheap = {
      ...DEFAULT_RESEARCH_LIMITS.cheap,
      maxSearches: parseInt(process.env.DJ_RESEARCH_CHEAP_MAX_SEARCHES, 10),
    };
  }
  if (process.env.DJ_RESEARCH_CHEAP_MAX_FETCHES) {
    limits.cheap = {
      ...(limits.cheap ?? DEFAULT_RESEARCH_LIMITS.cheap),
      maxFetches: parseInt(process.env.DJ_RESEARCH_CHEAP_MAX_FETCHES, 10),
    };
  }

  if (process.env.DJ_RESEARCH_NORMAL_MAX_SEARCHES) {
    limits.normal = {
      ...DEFAULT_RESEARCH_LIMITS.normal,
      maxSearches: parseInt(process.env.DJ_RESEARCH_NORMAL_MAX_SEARCHES, 10),
    };
  }
  if (process.env.DJ_RESEARCH_NORMAL_MAX_FETCHES) {
    limits.normal = {
      ...(limits.normal ?? DEFAULT_RESEARCH_LIMITS.normal),
      maxFetches: parseInt(process.env.DJ_RESEARCH_NORMAL_MAX_FETCHES, 10),
    };
  }

  if (process.env.DJ_RESEARCH_DEEP_MAX_SEARCHES) {
    limits.deep = {
      ...DEFAULT_RESEARCH_LIMITS.deep,
      maxSearches: parseInt(process.env.DJ_RESEARCH_DEEP_MAX_SEARCHES, 10),
    };
  }
  if (process.env.DJ_RESEARCH_DEEP_MAX_FETCHES) {
    limits.deep = {
      ...(limits.deep ?? DEFAULT_RESEARCH_LIMITS.deep),
      maxFetches: parseInt(process.env.DJ_RESEARCH_DEEP_MAX_FETCHES, 10),
    };
  }

  if (Object.keys(limits).length > 0) {
    config.limits = {
      ...DEFAULT_RESEARCH_LIMITS,
      ...limits,
    } as Record<BudgetProfileId, ResearchLimits>;
  }

  return config;
}

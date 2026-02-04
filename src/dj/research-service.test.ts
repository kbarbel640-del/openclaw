/**
 * Tests for Research Service
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotionService } from "./notion/notion-service.js";
import {
  createResearchService,
  DEFAULT_RESEARCH_LIMITS,
  loadResearchConfig,
  ResearchService,
} from "./research-service.js";

// =============================================================================
// Mock Factory
// =============================================================================

function createMockNotionService(overrides: Partial<NotionService> = {}): NotionService {
  return {
    findResearchByCacheKey: vi.fn().mockResolvedValue(null),
    saveResearchEntry: vi
      .fn()
      .mockResolvedValue({ id: "saved-id", url: "https://notion.so/research" }),
    ...overrides,
  } as unknown as NotionService;
}

// =============================================================================
// Test Setup
// =============================================================================

describe("ResearchService", () => {
  let testCacheDir: string;

  beforeEach(() => {
    testCacheDir = join(tmpdir(), `openclaw-research-test-${Date.now()}`);
    mkdirSync(testCacheDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  // ===========================================================================
  // Factory Tests
  // ===========================================================================

  describe("createResearchService", () => {
    it("should create service with default config", () => {
      const service = createResearchService();
      expect(service).toBeInstanceOf(ResearchService);
    });

    it("should create service with custom config", () => {
      const service = createResearchService({
        autoSave: true,
        cacheTtlHours: 48,
      });

      const config = service.getConfig();
      expect(config.autoSave).toBe(true);
      expect(config.cacheTtlHours).toBe(48);
    });
  });

  // ===========================================================================
  // Limits Tests
  // ===========================================================================

  describe("getLimits", () => {
    it("should return correct limits for cheap profile", () => {
      const service = createResearchService();
      const limits = service.getLimits("cheap");

      expect(limits).toEqual(DEFAULT_RESEARCH_LIMITS.cheap);
      expect(limits.maxSearches).toBe(1);
      expect(limits.maxFetches).toBe(2);
    });

    it("should return correct limits for normal profile", () => {
      const service = createResearchService();
      const limits = service.getLimits("normal");

      expect(limits).toEqual(DEFAULT_RESEARCH_LIMITS.normal);
      expect(limits.maxSearches).toBe(2);
      expect(limits.maxFetches).toBe(5);
    });

    it("should return correct limits for deep profile", () => {
      const service = createResearchService();
      const limits = service.getLimits("deep");

      expect(limits).toEqual(DEFAULT_RESEARCH_LIMITS.deep);
      expect(limits.maxSearches).toBe(5);
      expect(limits.maxFetches).toBe(10);
    });

    it("should use custom limits when configured", () => {
      const service = createResearchService({
        limits: {
          cheap: { maxSearches: 2, maxFetches: 3, maxCharsPerFetch: 5000 },
          normal: DEFAULT_RESEARCH_LIMITS.normal,
          deep: DEFAULT_RESEARCH_LIMITS.deep,
        },
      });

      const limits = service.getLimits("cheap");
      expect(limits.maxSearches).toBe(2);
      expect(limits.maxFetches).toBe(3);
    });
  });

  // ===========================================================================
  // Cache Key Tests
  // ===========================================================================

  describe("generateCacheKey", () => {
    it("should generate consistent keys for same query", () => {
      const service = createResearchService();

      const key1 = service.generateCacheKey("Test Query");
      const key2 = service.generateCacheKey("Test Query");

      expect(key1).toBe(key2);
    });

    it("should generate case-insensitive keys", () => {
      const service = createResearchService();

      const key1 = service.generateCacheKey("Test Query");
      const key2 = service.generateCacheKey("test query");
      const key3 = service.generateCacheKey("TEST QUERY");

      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
    });

    it("should trim whitespace", () => {
      const service = createResearchService();

      const key1 = service.generateCacheKey("Test Query");
      const key2 = service.generateCacheKey("  Test Query  ");

      expect(key1).toBe(key2);
    });

    it("should include URLs in key generation", () => {
      const service = createResearchService();

      const key1 = service.generateCacheKey("Test Query", []);
      const key2 = service.generateCacheKey("Test Query", ["https://example.com"]);

      expect(key1).not.toBe(key2);
    });

    it("should generate same key regardless of URL order", () => {
      const service = createResearchService();

      const key1 = service.generateCacheKey("Query", ["https://a.com", "https://b.com"]);
      const key2 = service.generateCacheKey("Query", ["https://b.com", "https://a.com"]);

      expect(key1).toBe(key2);
    });
  });

  // ===========================================================================
  // Cache Operations Tests
  // ===========================================================================

  describe("cache operations", () => {
    it("should return null for missing cache", () => {
      const service = createResearchService({ cacheDir: testCacheDir });

      const result = service.checkCache("nonexistent-key");

      expect(result).toBeNull();
    });

    it("should save and retrieve cache", () => {
      const service = createResearchService({ cacheDir: testCacheDir });

      const result = {
        query: "Test Query",
        findings: ["Finding 1"],
        citations: [{ title: "Source", url: "https://example.com" }],
        nextActions: ["Action 1"],
        profile: "normal" as const,
        searchCount: 1,
        fetchCount: 2,
        fromCache: false,
      };

      const cacheKey = service.generateCacheKey("Test Query");
      service.saveCache(cacheKey, result, ["https://example.com"]);

      const cached = service.checkCache(cacheKey);

      expect(cached).not.toBeNull();
      expect(cached!.result.query).toBe("Test Query");
      expect(cached!.result.findings).toEqual(["Finding 1"]);
    });

    it("should return null for expired cache", () => {
      const service = createResearchService({
        cacheDir: testCacheDir,
        cacheTtlHours: 1, // 1 hour TTL
      });

      const cacheKey = "expired-key";
      const cachePath = join(testCacheDir, `${cacheKey}.json`);

      // Create an expired cache entry
      const expiredEntry = {
        query: "Expired Query",
        urls: [],
        result: {
          query: "Expired Query",
          findings: [],
          citations: [],
          nextActions: [],
          profile: "normal",
          searchCount: 0,
          fetchCount: 0,
          fromCache: false,
        },
        cachedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago (expired)
      };

      writeFileSync(cachePath, JSON.stringify(expiredEntry), "utf-8");

      const cached = service.checkCache(cacheKey);

      expect(cached).toBeNull();
    });

    it("should handle corrupted cache gracefully", () => {
      const service = createResearchService({ cacheDir: testCacheDir });

      const cacheKey = "corrupted-key";
      const cachePath = join(testCacheDir, `${cacheKey}.json`);

      writeFileSync(cachePath, "not valid json {{{", "utf-8");

      const cached = service.checkCache(cacheKey);

      expect(cached).toBeNull();
    });
  });

  // ===========================================================================
  // Notion Save Tests
  // ===========================================================================

  describe("saveToNotion", () => {
    it("should return null if Notion service not configured", async () => {
      const service = createResearchService();

      const result = await service.saveToNotion({
        query: "Test",
        findings: [],
        citations: [],
        nextActions: [],
        profile: "normal",
        searchCount: 1,
        fetchCount: 1,
        fromCache: false,
      });

      expect(result).toBeNull();
    });

    it("should save to Notion and return URL", async () => {
      const mockNotion = createMockNotionService();
      const service = createResearchService();
      service.setNotionService(mockNotion);

      const result = await service.saveToNotion({
        query: "AI Ethics Research",
        findings: ["Finding 1", "Finding 2"],
        citations: [{ title: "Source", url: "https://example.com" }],
        nextActions: ["Review findings"],
        profile: "normal",
        searchCount: 2,
        fetchCount: 3,
        fromCache: false,
      });

      expect(result).toBe("https://notion.so/research");
      expect(mockNotion.saveResearchEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "AI Ethics Research",
          query: "AI Ethics Research",
          summary: ["Finding 1", "Finding 2"],
          citations: [{ title: "Source", url: "https://example.com" }],
          nextActions: ["Review findings"],
          profile: "normal",
          searchCount: 2,
          fetchCount: 3,
        }),
      );
    });

    it("should include cacheKey for deduplication", async () => {
      const mockNotion = createMockNotionService();
      const service = createResearchService();
      service.setNotionService(mockNotion);

      await service.saveToNotion({
        query: "Dedupe Test",
        findings: [],
        citations: [{ title: "A", url: "https://a.com" }],
        nextActions: [],
        profile: "cheap",
        searchCount: 1,
        fetchCount: 1,
        fromCache: false,
      });

      expect(mockNotion.saveResearchEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          cacheKey: expect.any(String),
        }),
      );
    });

    it("should handle save errors gracefully", async () => {
      const mockNotion = createMockNotionService({
        saveResearchEntry: vi.fn().mockRejectedValue(new Error("Network error")),
      });
      const service = createResearchService();
      service.setNotionService(mockNotion);

      const result = await service.saveToNotion({
        query: "Error Test",
        findings: [],
        citations: [],
        nextActions: [],
        profile: "normal",
        searchCount: 1,
        fetchCount: 1,
        fromCache: false,
      });

      // Should not throw, returns null
      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // Duplicate Check Tests
  // ===========================================================================

  describe("checkNotionDuplicate", () => {
    it("should return false if Notion service not configured", async () => {
      const service = createResearchService();

      const result = await service.checkNotionDuplicate("Query", []);

      expect(result).toBe(false);
    });

    it("should return true if duplicate exists", async () => {
      const mockNotion = createMockNotionService({
        findResearchByCacheKey: vi.fn().mockResolvedValue({ id: "existing" }),
      });
      const service = createResearchService();
      service.setNotionService(mockNotion);

      const result = await service.checkNotionDuplicate("Existing Query", []);

      expect(result).toBe(true);
    });

    it("should return false if no duplicate", async () => {
      const mockNotion = createMockNotionService({
        findResearchByCacheKey: vi.fn().mockResolvedValue(null),
      });
      const service = createResearchService();
      service.setNotionService(mockNotion);

      const result = await service.checkNotionDuplicate("New Query", []);

      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // Markdown Formatting Tests
  // ===========================================================================

  describe("formatAsMarkdown", () => {
    it("should format research result as markdown", () => {
      const service = createResearchService();

      const md = service.formatAsMarkdown({
        query: "AI Regulation",
        findings: ["EU AI Act passed", "Phased implementation"],
        citations: [
          { title: "Official Text", url: "https://ec.europa.eu/ai-act" },
          { title: "Analysis", url: "https://example.com/analysis" },
        ],
        nextActions: ["Review requirements", "Assess compliance"],
        uncertainty: "Implementation details pending",
        profile: "normal",
        searchCount: 2,
        fetchCount: 4,
        fromCache: false,
      });

      expect(md).toContain("## Research: AI Regulation");
      expect(md).toContain("### Key Findings");
      expect(md).toContain("- EU AI Act passed");
      expect(md).toContain("- Phased implementation");
      expect(md).toContain("### Sources");
      expect(md).toContain("[Official Text](https://ec.europa.eu/ai-act)");
      expect(md).toContain("### Next Actions");
      expect(md).toContain("- [ ] Review requirements");
      expect(md).toContain("### Uncertainty");
      expect(md).toContain("Implementation details pending");
    });

    it("should include cache notice when from cache", () => {
      const service = createResearchService();

      const md = service.formatAsMarkdown({
        query: "Cached Query",
        findings: [],
        citations: [],
        nextActions: [],
        profile: "cheap",
        searchCount: 1,
        fetchCount: 1,
        fromCache: true,
        cachedAt: "2024-01-01T10:00:00Z",
      });

      expect(md).toContain("*Cached:");
    });

    it("should omit empty sections", () => {
      const service = createResearchService();

      const md = service.formatAsMarkdown({
        query: "Minimal",
        findings: ["One finding"],
        citations: [],
        nextActions: [],
        profile: "cheap",
        searchCount: 1,
        fetchCount: 0,
        fromCache: false,
      });

      expect(md).not.toContain("### Next Actions");
      expect(md).not.toContain("### Uncertainty");
    });
  });
});

// =============================================================================
// Config Loading Tests
// =============================================================================

describe("loadResearchConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should load defaults when no env vars set", () => {
    delete process.env.DJ_RESEARCH_AUTO_SAVE;
    delete process.env.DJ_RESEARCH_CACHE_TTL_HOURS;

    const config = loadResearchConfig();

    expect(config.autoSave).toBe(false);
    expect(config.cacheTtlHours).toBe(24);
  });

  it("should load autoSave from env", () => {
    process.env.DJ_RESEARCH_AUTO_SAVE = "true";

    const config = loadResearchConfig();

    expect(config.autoSave).toBe(true);
  });

  it("should load cacheTtlHours from env", () => {
    process.env.DJ_RESEARCH_CACHE_TTL_HOURS = "48";

    const config = loadResearchConfig();

    expect(config.cacheTtlHours).toBe(48);
  });

  it("should load custom limits from env", () => {
    process.env.DJ_RESEARCH_CHEAP_MAX_SEARCHES = "3";
    process.env.DJ_RESEARCH_CHEAP_MAX_FETCHES = "5";

    const config = loadResearchConfig();

    expect(config.limits?.cheap?.maxSearches).toBe(3);
    expect(config.limits?.cheap?.maxFetches).toBe(5);
  });
});

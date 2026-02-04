/**
 * Tests for Podcast Service
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BudgetGovernor } from "../budget/governor.js";
import type { NotionService } from "./notion/notion-service.js";
import type { EpisodeId, EpisodeManifest, EpisodePack } from "./podcast-types.js";
import {
  createPodcastService,
  DEFAULT_PODCAST_DIR,
  loadPodcastConfig,
  PodcastService,
} from "./podcast-service.js";
import { resetPodcastState } from "./podcast-state.js";

// =============================================================================
// Test Helpers
// =============================================================================

interface TestContext {
  baseDir: string;
  stateFilePath: string;
  service: PodcastService;
}

function createTestContext(): TestContext {
  const testId = `podcast-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const baseDir = join(tmpdir(), "openclaw-test", testId, "podcast");
  const stateFilePath = join(tmpdir(), "openclaw-test", testId, "state", "dj-podcast.json");

  mkdirSync(dirname(stateFilePath), { recursive: true });

  const service = createPodcastService({
    baseDir,
    stateFilePath,
  });

  return { baseDir, stateFilePath, service };
}

function cleanupTestContext(ctx: TestContext): void {
  try {
    const testDir = dirname(dirname(ctx.stateFilePath));
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  } catch {
    // Ignore cleanup errors
  }
}

function createMockNotionService(overrides: Partial<NotionService> = {}): NotionService {
  return {
    client: {} as NotionService["client"],
    createEpisodePipelineEntry: vi.fn().mockResolvedValue({ id: "notion-page-123" }),
    findPodcastAssetByCacheKey: vi.fn().mockResolvedValue(null),
    savePodcastAsset: vi.fn().mockResolvedValue({ id: "notion-asset-123" }),
    listEpisodeIds: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as NotionService;
}

function createMockBudgetGovernor(overrides: Partial<BudgetGovernor> = {}): BudgetGovernor {
  return {
    getStatus: vi.fn().mockReturnValue({ profileId: "normal" }),
    checkLimits: vi.fn().mockReturnValue({ allowed: true }),
    isStopped: vi.fn().mockReturnValue(false),
    getStopReason: vi.fn().mockReturnValue(null),
    recordToolCall: vi.fn(),
    ...overrides,
  } as unknown as BudgetGovernor;
}

const SAMPLE_TRANSCRIPT = `
Hello and welcome to the podcast.

Today we're discussing artificial intelligence and its impact on society.

Our guest is Dr. Jane Smith, an expert in machine learning.

Jane: Thanks for having me. AI is transforming every industry.

Host: What are the key trends you're seeing?

Jane: We're seeing a shift towards more responsible AI development.
Companies are focusing on ethical considerations alongside performance.

This is a fascinating area of research with many implications.

Thank you for listening!
`.trim();

// =============================================================================
// Service Creation Tests
// =============================================================================

describe("createPodcastService", () => {
  it("should create service with default config", () => {
    const service = createPodcastService();
    const config = service.getConfig();
    expect(config.baseDir).toBe(DEFAULT_PODCAST_DIR);
    expect(config.preferLocalModel).toBe(true);
  });

  it("should accept custom config", () => {
    const service = createPodcastService({
      baseDir: "/custom/path",
      preferLocalModel: false,
    });
    const config = service.getConfig();
    expect(config.baseDir).toBe("/custom/path");
    expect(config.preferLocalModel).toBe(false);
  });

  it("should allow setting Notion service", () => {
    const service = createPodcastService();
    const mockNotion = createMockNotionService();
    service.setNotionService(mockNotion);
    // Service should accept it without error
    expect(true).toBe(true);
  });

  it("should allow setting budget governor", () => {
    const service = createPodcastService();
    const mockGovernor = createMockBudgetGovernor();
    service.setBudgetGovernor(mockGovernor);
    // Service should accept it without error
    expect(true).toBe(true);
  });
});

describe("loadPodcastConfig", () => {
  it("should return default values when env vars not set", () => {
    const config = loadPodcastConfig();
    expect(config.baseDir).toBe(DEFAULT_PODCAST_DIR);
    expect(config.preferLocalModel).toBe(true);
  });

  it("should respect DJ_PODCAST_DIR env var", () => {
    const originalEnv = process.env.DJ_PODCAST_DIR;
    process.env.DJ_PODCAST_DIR = "/env/podcast/dir";

    const config = loadPodcastConfig();
    expect(config.baseDir).toBe("/env/podcast/dir");

    process.env.DJ_PODCAST_DIR = originalEnv;
  });

  it("should respect DJ_PODCAST_PREFER_LOCAL env var", () => {
    const originalEnv = process.env.DJ_PODCAST_PREFER_LOCAL;
    process.env.DJ_PODCAST_PREFER_LOCAL = "false";

    const config = loadPodcastConfig();
    expect(config.preferLocalModel).toBe(false);

    process.env.DJ_PODCAST_PREFER_LOCAL = originalEnv;
  });
});

// =============================================================================
// Transcript Hash Tests
// =============================================================================

describe("Transcript Hash Stability", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    cleanupTestContext(ctx);
  });

  it("should produce consistent hash for same content", async () => {
    const result1 = await ctx.service.ingest(SAMPLE_TRANSCRIPT, {
      sourceType: "clipboard",
    });
    expect(result1.success).toBe(true);

    resetPodcastState(ctx.stateFilePath);

    const result2 = await ctx.service.ingest(SAMPLE_TRANSCRIPT, {
      sourceType: "clipboard",
    });
    expect(result2.success).toBe(true);

    expect(result1.transcriptHash).toBe(result2.transcriptHash);
  });

  it("should produce different hash for different content", async () => {
    const result1 = await ctx.service.ingest("Content A", {
      sourceType: "clipboard",
    });
    expect(result1.success).toBe(true);

    const result2 = await ctx.service.ingest("Content B", {
      sourceType: "clipboard",
    });
    expect(result2.success).toBe(true);

    expect(result1.transcriptHash).not.toBe(result2.transcriptHash);
  });

  it("should produce 16-character hash", async () => {
    const result = await ctx.service.ingest(SAMPLE_TRANSCRIPT, {
      sourceType: "clipboard",
    });
    expect(result.success).toBe(true);
    expect(result.transcriptHash).toHaveLength(16);
  });
});

// =============================================================================
// Ingest Tests
// =============================================================================

describe("Ingest Operations", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    cleanupTestContext(ctx);
  });

  it("should ingest transcript and allocate E001", async () => {
    const result = await ctx.service.ingest(SAMPLE_TRANSCRIPT, {
      sourceType: "clipboard",
    });

    expect(result.success).toBe(true);
    expect(result.episodeId).toBe("E001");
    expect(result.transcriptHash).toBeDefined();
    expect(result.transcriptPath).toContain("E001");
    expect(result.transcriptPath).toContain("transcript.txt");
  });

  it("should allocate sequential episode IDs", async () => {
    const result1 = await ctx.service.ingest("Transcript 1", { sourceType: "clipboard" });
    const result2 = await ctx.service.ingest("Transcript 2", { sourceType: "clipboard" });
    const result3 = await ctx.service.ingest("Transcript 3", { sourceType: "clipboard" });

    expect(result1.episodeId).toBe("E001");
    expect(result2.episodeId).toBe("E002");
    expect(result3.episodeId).toBe("E003");
  });

  it("should save transcript file", async () => {
    const result = await ctx.service.ingest(SAMPLE_TRANSCRIPT, {
      sourceType: "clipboard",
    });

    expect(result.success).toBe(true);
    const transcriptPath = result.transcriptPath!;
    expect(existsSync(transcriptPath)).toBe(true);

    const savedContent = readFileSync(transcriptPath, "utf-8");
    expect(savedContent).toBe(SAMPLE_TRANSCRIPT);
  });

  it("should save manifest file", async () => {
    const result = await ctx.service.ingest(SAMPLE_TRANSCRIPT, {
      sourceType: "file",
      sourcePath: "/path/to/file.txt",
      filename: "file.txt",
    });

    expect(result.success).toBe(true);
    const manifestPath = join(ctx.baseDir, "episodes", "E001", "manifest.json");
    expect(existsSync(manifestPath)).toBe(true);

    const manifest: EpisodeManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    expect(manifest.episodeId).toBe("E001");
    expect(manifest.transcriptHash).toBe(result.transcriptHash);
    expect(manifest.sourceInfo.type).toBe("file");
    expect(manifest.sourceInfo.source).toBe("/path/to/file.txt");
    expect(manifest.sourceInfo.filename).toBe("file.txt");
    expect(manifest.status).toBe("ingested");
  });

  it("should reject empty transcript", async () => {
    const result = await ctx.service.ingest("", { sourceType: "clipboard" });

    expect(result.success).toBe(false);
    expect(result.message).toContain("empty");
  });

  it("should reject whitespace-only transcript", async () => {
    const result = await ctx.service.ingest("   \n\t  ", { sourceType: "clipboard" });

    expect(result.success).toBe(false);
    expect(result.message).toContain("empty");
  });

  it("should allow episode ID override", async () => {
    const result = await ctx.service.ingest(SAMPLE_TRANSCRIPT, {
      sourceType: "clipboard",
      episodeId: "E042" as EpisodeId,
    });

    expect(result.success).toBe(true);
    expect(result.episodeId).toBe("E042");
  });

  it("should reject duplicate episode ID", async () => {
    await ctx.service.ingest("First transcript", { sourceType: "clipboard" });

    const mockNotion = createMockNotionService({
      listEpisodeIds: vi.fn().mockResolvedValue(["E001"]),
    });
    ctx.service.setNotionService(mockNotion);

    const result = await ctx.service.ingest("Second transcript", {
      sourceType: "clipboard",
      episodeId: "E001" as EpisodeId,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("already in use");
  });

  it("should create Notion entry when service configured", async () => {
    const mockNotion = createMockNotionService();
    ctx.service.setNotionService(mockNotion);

    const result = await ctx.service.ingest(SAMPLE_TRANSCRIPT, {
      sourceType: "clipboard",
    });

    expect(result.success).toBe(true);
    expect(result.notionPageId).toBe("notion-page-123");
    expect(mockNotion.createEpisodePipelineEntry).toHaveBeenCalled();
  });

  it("should continue on Notion failure (non-fatal)", async () => {
    const mockNotion = createMockNotionService({
      createEpisodePipelineEntry: vi.fn().mockRejectedValue(new Error("Notion error")),
    });
    ctx.service.setNotionService(mockNotion);

    const result = await ctx.service.ingest(SAMPLE_TRANSCRIPT, {
      sourceType: "clipboard",
    });

    expect(result.success).toBe(true);
    expect(result.episodeId).toBe("E001");
    expect(result.notionPageId).toBeUndefined();
  });
});

// =============================================================================
// Pack Operations Tests
// =============================================================================

describe("Pack Operations", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    cleanupTestContext(ctx);
  });

  it("should generate pack for episode", async () => {
    await ctx.service.ingest(SAMPLE_TRANSCRIPT, { sourceType: "clipboard" });

    const result = await ctx.service.pack("E001" as EpisodeId);

    expect(result.success).toBe(true);
    expect(result.episodeId).toBe("E001");
    expect(result.fromCache).toBe(false);
    expect(result.pack).toBeDefined();
    expect(result.pack?.artifacts.titles).toBeDefined();
    expect(result.pack?.artifacts.showNotes).toBeDefined();
    expect(result.pack?.artifacts.chapters).toBeDefined();
  });

  it("should generate pack for latest episode", async () => {
    await ctx.service.ingest("First transcript", { sourceType: "clipboard" });
    await ctx.service.ingest("Second transcript", { sourceType: "clipboard" });

    const result = await ctx.service.pack("latest");

    expect(result.success).toBe(true);
    expect(result.episodeId).toBe("E002");
  });

  it("should return cached pack on second call", async () => {
    await ctx.service.ingest(SAMPLE_TRANSCRIPT, { sourceType: "clipboard" });

    const result1 = await ctx.service.pack("E001" as EpisodeId);
    const result2 = await ctx.service.pack("E001" as EpisodeId);

    expect(result1.success).toBe(true);
    expect(result1.fromCache).toBe(false);

    expect(result2.success).toBe(true);
    expect(result2.fromCache).toBe(true);
    expect(result2.pack?.transcriptHash).toBe(result1.pack?.transcriptHash);
  });

  it("should save pack.json file", async () => {
    await ctx.service.ingest(SAMPLE_TRANSCRIPT, { sourceType: "clipboard" });
    await ctx.service.pack("E001" as EpisodeId);

    const packPath = join(ctx.baseDir, "episodes", "E001", "pack", "pack.json");
    expect(existsSync(packPath)).toBe(true);

    const pack: EpisodePack = JSON.parse(readFileSync(packPath, "utf-8"));
    expect(pack.episodeId).toBe("E001");
    expect(pack.artifacts).toBeDefined();
  });

  it("should save individual artifact files", async () => {
    await ctx.service.ingest(SAMPLE_TRANSCRIPT, { sourceType: "clipboard" });
    await ctx.service.pack("E001" as EpisodeId);

    const packDir = join(ctx.baseDir, "episodes", "E001", "pack");
    expect(existsSync(join(packDir, "show_notes_short.md"))).toBe(true);
    expect(existsSync(join(packDir, "show_notes_long.md"))).toBe(true);
    expect(existsSync(join(packDir, "titles.json"))).toBe(true);
    expect(existsSync(join(packDir, "chapters.json"))).toBe(true);
    expect(existsSync(join(packDir, "quotes.md"))).toBe(true);
    expect(existsSync(join(packDir, "clip_plan.md"))).toBe(true);
  });

  it("should fail gracefully for non-existent episode", async () => {
    const result = await ctx.service.pack("E999" as EpisodeId);

    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("should fail gracefully when no episodes exist", async () => {
    const result = await ctx.service.pack("latest");

    expect(result.success).toBe(false);
    expect(result.message).toContain("No episodes found");
  });

  it("should force regenerate when option set", async () => {
    await ctx.service.ingest(SAMPLE_TRANSCRIPT, { sourceType: "clipboard" });
    await ctx.service.pack("E001" as EpisodeId);

    const result = await ctx.service.pack("E001" as EpisodeId, { forceRegenerate: true });

    expect(result.success).toBe(true);
    expect(result.fromCache).toBe(false);
  });

  it("should update manifest status on pack completion", async () => {
    await ctx.service.ingest(SAMPLE_TRANSCRIPT, { sourceType: "clipboard" });
    await ctx.service.pack("E001" as EpisodeId);

    const manifestPath = join(ctx.baseDir, "episodes", "E001", "manifest.json");
    const manifest: EpisodeManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

    expect(manifest.status).toBe("pack_complete");
    expect(Object.keys(manifest.artifactVersions)).toContain("titles");
    expect(Object.keys(manifest.artifactVersions)).toContain("showNotes");
  });
});

// =============================================================================
// Status Operations Tests
// =============================================================================

describe("Status Operations", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    cleanupTestContext(ctx);
  });

  it("should return status for episode", async () => {
    await ctx.service.ingest(SAMPLE_TRANSCRIPT, { sourceType: "clipboard" });

    const result = ctx.service.getStatus("E001" as EpisodeId);

    expect(result.success).toBe(true);
    expect(result.episodeId).toBe("E001");
    expect(result.manifest?.status).toBe("ingested");
  });

  it("should return status for latest episode", async () => {
    await ctx.service.ingest("First", { sourceType: "clipboard" });
    await ctx.service.ingest("Second", { sourceType: "clipboard" });

    const result = ctx.service.getStatus("latest");

    expect(result.success).toBe(true);
    expect(result.episodeId).toBe("E002");
  });

  it("should include pack in status after generation", async () => {
    await ctx.service.ingest(SAMPLE_TRANSCRIPT, { sourceType: "clipboard" });
    await ctx.service.pack("E001" as EpisodeId);

    const result = ctx.service.getStatus("E001" as EpisodeId);

    expect(result.success).toBe(true);
    expect(result.pack).toBeDefined();
    expect(result.manifest?.status).toBe("pack_complete");
  });

  it("should fail for non-existent episode", () => {
    const result = ctx.service.getStatus("E999" as EpisodeId);

    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });
});

// =============================================================================
// Cache Status Tests
// =============================================================================

describe("Cache Status Operations", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    cleanupTestContext(ctx);
  });

  it("should show not cached before pack generation", async () => {
    await ctx.service.ingest(SAMPLE_TRANSCRIPT, { sourceType: "clipboard" });

    const result = await ctx.service.getCacheStatus("E001" as EpisodeId);

    expect(result.success).toBe(true);
    expect(result.cached).toBe(false);
    expect(result.cacheKey).toBeDefined();
  });

  it("should show cached after pack generation", async () => {
    await ctx.service.ingest(SAMPLE_TRANSCRIPT, { sourceType: "clipboard" });
    await ctx.service.pack("E001" as EpisodeId);

    const result = await ctx.service.getCacheStatus("E001" as EpisodeId);

    expect(result.success).toBe(true);
    expect(result.cached).toBe(true);
    expect(result.cacheKey).toBeDefined();
  });

  it("should check Notion cache when service configured", async () => {
    await ctx.service.ingest(SAMPLE_TRANSCRIPT, { sourceType: "clipboard" });

    const mockNotion = createMockNotionService({
      findPodcastAssetByCacheKey: vi.fn().mockResolvedValue({ id: "notion-asset-456" }),
    });
    ctx.service.setNotionService(mockNotion);

    const result = await ctx.service.getCacheStatus("E001" as EpisodeId);

    expect(result.success).toBe(true);
    expect(result.cached).toBe(true);
    expect(result.notionAssetId).toBe("notion-asset-456");
  });
});

// =============================================================================
// Budget Integration Tests
// =============================================================================

describe("Budget Integration", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    cleanupTestContext(ctx);
  });

  it("should record tool calls with budget governor", async () => {
    const mockGovernor = createMockBudgetGovernor();
    ctx.service.setBudgetGovernor(mockGovernor);

    await ctx.service.ingest(SAMPLE_TRANSCRIPT, { sourceType: "clipboard" });
    await ctx.service.pack("E001" as EpisodeId);

    expect(mockGovernor.recordToolCall).toHaveBeenCalled();
  });

  it("should check limits before pack generation", async () => {
    const mockGovernor = createMockBudgetGovernor();
    ctx.service.setBudgetGovernor(mockGovernor);

    await ctx.service.ingest(SAMPLE_TRANSCRIPT, { sourceType: "clipboard" });
    await ctx.service.pack("E001" as EpisodeId);

    expect(mockGovernor.checkLimits).toHaveBeenCalled();
  });

  it("should stop and return partial on budget exceeded", async () => {
    const mockGovernor = createMockBudgetGovernor({
      checkLimits: vi.fn().mockReturnValue({ allowed: false, message: "Token limit reached" }),
      isStopped: vi.fn().mockReturnValue(true),
      getStopReason: vi.fn().mockReturnValue({ message: "Token limit reached" }),
    });
    ctx.service.setBudgetGovernor(mockGovernor);

    await ctx.service.ingest(SAMPLE_TRANSCRIPT, { sourceType: "clipboard" });
    const result = await ctx.service.pack("E001" as EpisodeId);

    expect(result.success).toBe(false);
    expect(result.budgetExceeded).toBe(true);
    expect(result.message).toContain("Budget limit");
    expect(result.message).toContain("deep mode");
  });

  it("should update manifest status on budget exceeded", async () => {
    const mockGovernor = createMockBudgetGovernor({
      checkLimits: vi.fn().mockReturnValue({ allowed: false, message: "Token limit" }),
      isStopped: vi.fn().mockReturnValue(true),
      getStopReason: vi.fn().mockReturnValue({ message: "Token limit" }),
    });
    ctx.service.setBudgetGovernor(mockGovernor);

    await ctx.service.ingest(SAMPLE_TRANSCRIPT, { sourceType: "clipboard" });
    await ctx.service.pack("E001" as EpisodeId);

    const manifestPath = join(ctx.baseDir, "episodes", "E001", "manifest.json");
    const manifest: EpisodeManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

    expect(manifest.status).toBe("pack_partial");
  });
});

// =============================================================================
// Notion Integration Tests
// =============================================================================

describe("Notion Integration", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    cleanupTestContext(ctx);
  });

  it("should save pack to Notion", async () => {
    const mockNotion = createMockNotionService();
    ctx.service.setNotionService(mockNotion);

    await ctx.service.ingest(SAMPLE_TRANSCRIPT, { sourceType: "clipboard" });
    await ctx.service.pack("E001" as EpisodeId);

    expect(mockNotion.savePodcastAsset).toHaveBeenCalled();
  });

  it("should skip Notion save when option set", async () => {
    const mockNotion = createMockNotionService();
    ctx.service.setNotionService(mockNotion);

    await ctx.service.ingest(SAMPLE_TRANSCRIPT, { sourceType: "clipboard" });
    await ctx.service.pack("E001" as EpisodeId, { skipNotionSave: true });

    expect(mockNotion.savePodcastAsset).not.toHaveBeenCalled();
  });

  it("should continue on Notion save failure", async () => {
    const mockNotion = createMockNotionService({
      savePodcastAsset: vi.fn().mockRejectedValue(new Error("Notion error")),
    });
    ctx.service.setNotionService(mockNotion);

    await ctx.service.ingest(SAMPLE_TRANSCRIPT, { sourceType: "clipboard" });
    const result = await ctx.service.pack("E001" as EpisodeId);

    expect(result.success).toBe(true);
    expect(result.pack).toBeDefined();
  });
});

// =============================================================================
// Latest Episode ID Tests
// =============================================================================

describe("getLatestEpisodeId", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    cleanupTestContext(ctx);
  });

  it("should return null when no episodes", () => {
    const latest = ctx.service.getLatestEpisodeId();
    expect(latest).toBeNull();
  });

  it("should return last allocated episode ID", async () => {
    await ctx.service.ingest("First", { sourceType: "clipboard" });
    await ctx.service.ingest("Second", { sourceType: "clipboard" });
    await ctx.service.ingest("Third", { sourceType: "clipboard" });

    const latest = ctx.service.getLatestEpisodeId();
    expect(latest).toBe("E003");
  });
});

/**
 * Tests for Site Service
 */

import { describe, expect, it, vi } from "vitest";
import type { NotionService } from "./notion/notion-service.js";
import { computeContentHash } from "./notion/notion-service.js";
import { createSiteService, SiteService } from "./site-service.js";

// =============================================================================
// Mock Factory
// =============================================================================

function createMockNotionService(overrides: Partial<NotionService> = {}): NotionService {
  return {
    client: {
      getPage: vi.fn().mockResolvedValue({
        id: "page-id",
        properties: {
          ContentHash: {
            type: "rich_text",
            rich_text: [],
          },
        },
      }),
    },
    createPostEntry: vi.fn().mockResolvedValue({ id: "new-post-id", url: "https://notion.so/new" }),
    updatePostEntry: vi.fn().mockResolvedValue({ id: "updated-id" }),
    findPostByDraftId: vi.fn().mockResolvedValue(null),
    fetchPageContent: vi.fn().mockResolvedValue({ content: "Test content", hash: "abc123" }),
    ...overrides,
  } as unknown as NotionService;
}

// =============================================================================
// Factory Tests
// =============================================================================

describe("createSiteService", () => {
  it("should create service with default config", () => {
    const service = createSiteService();
    expect(service).toBeInstanceOf(SiteService);
    expect(service.getConfig().defaultTemplate).toBe("blog");
  });

  it("should create service with custom config", () => {
    const service = createSiteService({
      defaultTemplate: "episode",
      siteUrl: "https://mysite.squarespace.com",
    });

    const config = service.getConfig();
    expect(config.defaultTemplate).toBe("episode");
    expect(config.siteUrl).toBe("https://mysite.squarespace.com");
  });
});

// =============================================================================
// Draft Operations Tests
// =============================================================================

describe("SiteService - Draft Operations", () => {
  it("should return error if Notion service not configured", async () => {
    const service = createSiteService();

    const result = await service.createDraft("Test Post");

    expect(result.success).toBe(false);
    expect(result.message).toContain("Notion service not configured");
  });

  it("should create draft in Notion", async () => {
    const mockService = createMockNotionService();
    const service = createSiteService();
    service.setNotionService(mockService);

    const result = await service.createDraft("Episode 42: AI in Healthcare", "episode");

    expect(result.success).toBe(true);
    expect(result.notionPageId).toBe("new-post-id");
    expect(mockService.createPostEntry).toHaveBeenCalledWith({
      title: "Episode 42: AI in Healthcare",
      status: "Draft",
      template: "episode",
    });
  });

  it("should use default template if not specified", async () => {
    const mockService = createMockNotionService();
    const service = createSiteService({ defaultTemplate: "blog" });
    service.setNotionService(mockService);

    await service.createDraft("New Blog Post");

    expect(mockService.createPostEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "blog",
      }),
    );
  });

  it("should link Squarespace draft ID to Notion page", async () => {
    const mockService = createMockNotionService();
    const service = createSiteService();
    service.setNotionService(mockService);

    const result = await service.linkSquarespaceDraft("notion-page-123", "ss-draft-456");

    expect(result).toBe(true);
    expect(mockService.updatePostEntry).toHaveBeenCalledWith("notion-page-123", {
      squarespaceDraftId: "ss-draft-456",
    });
  });
});

// =============================================================================
// Content Idempotency Tests
// =============================================================================

describe("SiteService - Content Idempotency", () => {
  it("should detect unchanged content by hash", async () => {
    const existingHash = computeContentHash("Existing content");
    const mockService = createMockNotionService({
      client: {
        getPage: vi.fn().mockResolvedValue({
          id: "page-id",
          properties: {
            ContentHash: {
              type: "rich_text",
              rich_text: [{ plain_text: existingHash }],
            },
          },
        }),
      } as unknown,
    });

    const service = createSiteService();
    service.setNotionService(mockService);

    const result = await service.checkContentChanged("page-id", "Existing content");

    expect(result.changed).toBe(false);
    expect(result.oldHash).toBe(existingHash);
    expect(result.newHash).toBe(existingHash);
  });

  it("should detect changed content by hash", async () => {
    const oldHash = computeContentHash("Old content");
    const mockService = createMockNotionService({
      client: {
        getPage: vi.fn().mockResolvedValue({
          id: "page-id",
          properties: {
            ContentHash: {
              type: "rich_text",
              rich_text: [{ plain_text: oldHash }],
            },
          },
        }),
      } as unknown,
    });

    const service = createSiteService();
    service.setNotionService(mockService);

    const result = await service.checkContentChanged("page-id", "New content");

    expect(result.changed).toBe(true);
    expect(result.oldHash).toBe(oldHash);
    expect(result.newHash).not.toBe(oldHash);
  });

  it("should assume changed if no previous hash exists", async () => {
    const mockService = createMockNotionService({
      client: {
        getPage: vi.fn().mockResolvedValue({
          id: "page-id",
          properties: {
            ContentHash: {
              type: "rich_text",
              rich_text: [], // Empty - no previous hash
            },
          },
        }),
      } as unknown,
    });

    const service = createSiteService();
    service.setNotionService(mockService);

    const result = await service.checkContentChanged("page-id", "Any content");

    expect(result.changed).toBe(true);
    expect(result.oldHash).toBeUndefined();
  });

  it("should assume changed on error (fail safe)", async () => {
    const mockService = createMockNotionService({
      client: {
        getPage: vi.fn().mockRejectedValue(new Error("Network error")),
      } as unknown,
    });

    const service = createSiteService();
    service.setNotionService(mockService);

    const result = await service.checkContentChanged("page-id", "Any content");

    expect(result.changed).toBe(true);
  });
});

// =============================================================================
// Content Fetch Tests
// =============================================================================

describe("SiteService - Content Fetch", () => {
  it("should return error if Notion service not configured", async () => {
    const service = createSiteService();

    const result = await service.fetchContent("page-123");

    expect(result.success).toBe(false);
    expect(result.source).toBe("none");
    expect(result.message).toContain("not configured");
  });

  it("should fetch content from Notion page", async () => {
    const mockService = createMockNotionService({
      fetchPageContent: vi.fn().mockResolvedValue({
        content: "# Hello World\n\nThis is content.",
        hash: "abc123",
      }),
    });

    const service = createSiteService();
    service.setNotionService(mockService);

    const result = await service.fetchContent("page-123");

    expect(result.success).toBe(true);
    expect(result.content).toBe("# Hello World\n\nThis is content.");
    expect(result.contentHash).toBe("abc123");
  });

  it("should parse notion:// URLs", async () => {
    const mockService = createMockNotionService();
    const service = createSiteService();
    service.setNotionService(mockService);

    await service.fetchContent("notion://page/abc123def456");

    expect(mockService.fetchPageContent).toHaveBeenCalledWith("abc123def456");
  });

  it("should return error for empty content", async () => {
    const mockService = createMockNotionService({
      fetchPageContent: vi.fn().mockResolvedValue({
        content: "   ", // Whitespace only
        hash: "empty",
      }),
    });

    const service = createSiteService();
    service.setNotionService(mockService);

    const result = await service.fetchContent("page-123");

    expect(result.success).toBe(false);
    expect(result.message).toContain("No content");
  });
});

// =============================================================================
// Sync Recording Tests
// =============================================================================

describe("SiteService - Sync Recording", () => {
  it("should record sync success", async () => {
    const mockService = createMockNotionService();
    const service = createSiteService();
    service.setNotionService(mockService);

    const result = await service.recordSyncSuccess("page-123", "newhash456");

    expect(result).toBe(true);
    expect(mockService.updatePostEntry).toHaveBeenCalledWith("page-123", {
      contentHash: "newhash456",
      lastSyncedAt: expect.any(String),
      lastError: "", // Cleared
    });
  });

  it("should record sync error", async () => {
    const mockService = createMockNotionService();
    const service = createSiteService();
    service.setNotionService(mockService);

    const result = await service.recordSyncError("page-123", "Browser navigation failed");

    expect(result).toBe(true);
    expect(mockService.updatePostEntry).toHaveBeenCalledWith("page-123", {
      lastError: "Browser navigation failed",
    });
  });
});

// =============================================================================
// Publish Recording Tests
// =============================================================================

describe("SiteService - Publish Recording", () => {
  it("should record publish success", async () => {
    const mockService = createMockNotionService();
    const service = createSiteService();
    service.setNotionService(mockService);

    const result = await service.recordPublishSuccess(
      "page-123",
      "https://mysite.com/blog/episode-42",
    );

    expect(result).toBe(true);
    expect(mockService.updatePostEntry).toHaveBeenCalledWith("page-123", {
      status: "Published",
      publishedAt: expect.any(String),
      publishedUrl: "https://mysite.com/blog/episode-42",
      lastError: "",
    });
  });

  it("should record publish error", async () => {
    const mockService = createMockNotionService();
    const service = createSiteService();
    service.setNotionService(mockService);

    const result = await service.recordPublishError("page-123", "Publish button not found");

    expect(result).toBe(true);
    expect(mockService.updatePostEntry).toHaveBeenCalledWith("page-123", {
      lastError: "Publish button not found",
    });
  });
});

// =============================================================================
// Editor URL Tests
// =============================================================================

describe("SiteService - Editor URL", () => {
  it("should generate editor URL when configured", () => {
    const service = createSiteService({
      editorUrl: "https://mysite.squarespace.com/config/pages",
    });

    const url = service.getEditorUrl("draft-123");

    expect(url).toBe("https://mysite.squarespace.com/config/pages/draft-123");
  });

  it("should return null if editor URL not configured", () => {
    const service = createSiteService();

    const url = service.getEditorUrl("draft-123");

    expect(url).toBeNull();
  });
});

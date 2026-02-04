/**
 * Tests for Notion Service
 */

import { describe, expect, it, vi } from "vitest";
import type { NotionClient } from "./notion-client.js";
import type { NotionBlock, NotionRichTextItem, WebOpsLogEntry } from "./types.js";
import {
  blocksToMarkdown,
  computeContentHash,
  extractPlainText,
  NotionService,
} from "./notion-service.js";

// =============================================================================
// Mock Client Factory
// =============================================================================

function createMockClient(overrides: Partial<NotionClient> = {}): NotionClient {
  return {
    queryDataSource: vi.fn().mockResolvedValue({ results: [], has_more: false }),
    queryDataSourceAll: vi.fn().mockResolvedValue([]),
    createPage: vi.fn().mockResolvedValue({ id: "new-page-id", url: "https://notion.so/new" }),
    updatePage: vi.fn().mockResolvedValue({ id: "updated-page-id" }),
    getPage: vi.fn().mockResolvedValue({ id: "page-id", properties: {} }),
    listBlockChildren: vi.fn().mockResolvedValue({ results: [], has_more: false }),
    listBlockChildrenAll: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as NotionClient;
}

// =============================================================================
// WebOps Log Tests
// =============================================================================

describe("NotionService - WebOps Log", () => {
  it("should skip write if webOpsDbId not configured", async () => {
    const mockClient = createMockClient();
    const service = new NotionService(mockClient, {});

    const entry: WebOpsLogEntry = {
      workflowId: "wf-123",
      task: "Test task",
      startedAt: "2024-01-01T00:00:00Z",
      finishedAt: "2024-01-01T00:01:00Z",
      outcome: "success",
      domainsVisited: ["example.com"],
      actionClasses: ["READ_ONLY"],
      approvedCount: 0,
      autoSubmitCount: 0,
      profile: "normal",
      localLogPath: "/tmp/log.jsonl",
    };

    const result = await service.createWebOpsLogEntry(entry);

    expect(result).toBeNull();
    expect(mockClient.createPage).not.toHaveBeenCalled();
  });

  it("should create WebOps log entry with correct properties", async () => {
    const mockClient = createMockClient();
    const service = new NotionService(mockClient, {
      webOpsDbId: "webops-db-123",
    });

    const entry: WebOpsLogEntry = {
      workflowId: "wf-456",
      task: "Subscribe to newsletter",
      startedAt: "2024-01-01T10:00:00Z",
      finishedAt: "2024-01-01T10:01:30Z",
      outcome: "success",
      domainsVisited: ["example.com", "mail.example.com"],
      actionClasses: ["READ_ONLY", "SUBMIT_LOW_RISK"],
      approvedCount: 1,
      autoSubmitCount: 1,
      profile: "normal",
      localLogPath: "/home/user/.openclaw/logs/dj-web-2024-01-01.jsonl",
    };

    await service.createWebOpsLogEntry(entry);

    expect(mockClient.createPage).toHaveBeenCalledWith({
      parent: { database_id: "webops-db-123" },
      properties: expect.objectContaining({
        Name: expect.objectContaining({
          title: expect.arrayContaining([
            expect.objectContaining({
              text: { content: "wf-456" },
            }),
          ]),
        }),
        Task: expect.objectContaining({
          rich_text: expect.arrayContaining([
            expect.objectContaining({
              text: { content: "Subscribe to newsletter" },
            }),
          ]),
        }),
        Outcome: expect.objectContaining({
          select: { name: "success" },
        }),
        Profile: expect.objectContaining({
          select: { name: "normal" },
        }),
        ActionClasses: expect.objectContaining({
          multi_select: expect.arrayContaining([
            { name: "READ_ONLY" },
            { name: "SUBMIT_LOW_RISK" },
          ]),
        }),
        ApprovedCount: expect.objectContaining({
          number: 1,
        }),
        AutoSubmitCount: expect.objectContaining({
          number: 1,
        }),
      }),
    });
  });

  it("should NOT include field values in WebOps log (privacy)", async () => {
    const mockClient = createMockClient();
    const service = new NotionService(mockClient, {
      webOpsDbId: "webops-db-123",
    });

    const entry: WebOpsLogEntry = {
      workflowId: "wf-789",
      task: "Fill form with email user@example.com",
      startedAt: "2024-01-01T00:00:00Z",
      finishedAt: "2024-01-01T00:00:30Z",
      outcome: "success",
      domainsVisited: ["example.com"],
      actionClasses: ["SUBMIT_LOW_RISK"],
      approvedCount: 0,
      autoSubmitCount: 1,
      profile: "normal",
      localLogPath: "/tmp/log.jsonl",
    };

    await service.createWebOpsLogEntry(entry);

    // Verify that the call was made
    expect(mockClient.createPage).toHaveBeenCalled();

    // Get the call arguments
    const callArgs = (mockClient.createPage as ReturnType<typeof vi.fn>).mock.calls[0][0];

    // Verify there's no "FieldValues" property
    expect(callArgs.properties).not.toHaveProperty("FieldValues");
    expect(callArgs.properties).not.toHaveProperty("fieldValues");

    // Verify the task is stored but doesn't contain a separate values property
    const taskContent = callArgs.properties.Task.rich_text[0].text.content;
    expect(taskContent).toBe("Fill form with email user@example.com");
  });

  it("should handle write errors gracefully", async () => {
    const mockClient = createMockClient({
      createPage: vi.fn().mockRejectedValue(new Error("Network error")),
    });
    const service = new NotionService(mockClient, {
      webOpsDbId: "webops-db-123",
    });

    const entry: WebOpsLogEntry = {
      workflowId: "wf-error",
      task: "Test",
      startedAt: "2024-01-01T00:00:00Z",
      finishedAt: "2024-01-01T00:00:30Z",
      outcome: "success",
      domainsVisited: [],
      actionClasses: [],
      approvedCount: 0,
      autoSubmitCount: 0,
      profile: "normal",
      localLogPath: "/tmp/log.jsonl",
    };

    // Should not throw, returns null instead
    const result = await service.createWebOpsLogEntry(entry);
    expect(result).toBeNull();
  });
});

// =============================================================================
// Research Radar Tests
// =============================================================================

describe("NotionService - Research Radar", () => {
  it("should dedupe by cacheKey - find existing", async () => {
    const existingPage = { id: "existing-123", url: "https://notion.so/existing" };
    const mockClient = createMockClient({
      queryDataSource: vi.fn().mockResolvedValue({
        results: [existingPage],
        has_more: false,
      }),
    });

    const service = new NotionService(mockClient, {
      researchRadarDbId: "research-db-123",
    });

    const result = await service.findResearchByCacheKey("abc123hash");

    expect(result).toEqual(existingPage);
    expect(mockClient.queryDataSource).toHaveBeenCalledWith(
      "research-db-123",
      expect.objectContaining({
        filter: {
          property: "CacheKey",
          rich_text: { equals: "abc123hash" },
        },
      }),
    );
  });

  it("should update existing entry when saving duplicate", async () => {
    const existingPage = { id: "existing-456" };
    const mockClient = createMockClient({
      queryDataSource: vi.fn().mockResolvedValue({
        results: [existingPage],
        has_more: false,
      }),
      updatePage: vi
        .fn()
        .mockResolvedValue({ id: "existing-456", url: "https://notion.so/updated" }),
    });

    const service = new NotionService(mockClient, {
      researchRadarDbId: "research-db-123",
    });

    const result = await service.saveResearchEntry({
      title: "Test Query",
      query: "test query",
      summary: ["Finding 1", "Finding 2"],
      citations: [{ title: "Source 1", url: "https://example.com" }],
      nextActions: ["Action 1"],
      cacheKey: "existing-cache-key",
      profile: "normal",
      searchCount: 2,
      fetchCount: 3,
    });

    expect(mockClient.updatePage).toHaveBeenCalledWith("existing-456", expect.anything());
    expect(mockClient.createPage).not.toHaveBeenCalled();
  });

  it("should create new entry when no duplicate exists", async () => {
    const mockClient = createMockClient({
      queryDataSource: vi.fn().mockResolvedValue({
        results: [],
        has_more: false,
      }),
    });

    const service = new NotionService(mockClient, {
      researchRadarDbId: "research-db-123",
    });

    await service.saveResearchEntry({
      title: "New Query",
      query: "new query",
      summary: ["Finding"],
      citations: [],
      nextActions: [],
      cacheKey: "new-cache-key",
      profile: "cheap",
      searchCount: 1,
      fetchCount: 1,
    });

    expect(mockClient.createPage).toHaveBeenCalledWith(
      expect.objectContaining({
        parent: { database_id: "research-db-123" },
      }),
    );
  });

  it("should generate consistent cache keys", () => {
    const key1 = NotionService.generateResearchCacheKey("Test Query");
    const key2 = NotionService.generateResearchCacheKey("test query");
    const key3 = NotionService.generateResearchCacheKey("  TEST QUERY  ");

    // All should be the same (case-insensitive, trimmed)
    expect(key1).toBe(key2);
    expect(key2).toBe(key3);

    // Different query should be different key
    const key4 = NotionService.generateResearchCacheKey("Different Query");
    expect(key1).not.toBe(key4);
  });
});

// =============================================================================
// Content Conversion Tests
// =============================================================================

describe("extractPlainText", () => {
  it("should extract text from rich text items", () => {
    const richText: NotionRichTextItem[] = [
      { type: "text", text: { content: "Hello " }, plain_text: "Hello " },
      { type: "text", text: { content: "World" }, plain_text: "World" },
    ];

    expect(extractPlainText(richText)).toBe("Hello World");
  });

  it("should handle empty rich text", () => {
    expect(extractPlainText([])).toBe("");
  });

  it("should use plain_text if available", () => {
    const richText: NotionRichTextItem[] = [{ type: "text", plain_text: "Plain text version" }];

    expect(extractPlainText(richText)).toBe("Plain text version");
  });
});

describe("blocksToMarkdown", () => {
  it("should convert paragraph blocks", () => {
    const blocks: NotionBlock[] = [
      {
        object: "block",
        id: "1",
        type: "paragraph",
        created_time: "",
        last_edited_time: "",
        has_children: false,
        archived: false,
        paragraph: {
          rich_text: [
            { type: "text", text: { content: "Hello world" }, plain_text: "Hello world" },
          ],
        },
      },
    ];

    expect(blocksToMarkdown(blocks)).toBe("Hello world");
  });

  it("should convert heading blocks", () => {
    const blocks: NotionBlock[] = [
      {
        object: "block",
        id: "1",
        type: "heading_1",
        created_time: "",
        last_edited_time: "",
        has_children: false,
        archived: false,
        heading_1: {
          rich_text: [{ type: "text", text: { content: "Title" }, plain_text: "Title" }],
        },
      },
      {
        object: "block",
        id: "2",
        type: "heading_2",
        created_time: "",
        last_edited_time: "",
        has_children: false,
        archived: false,
        heading_2: {
          rich_text: [{ type: "text", text: { content: "Subtitle" }, plain_text: "Subtitle" }],
        },
      },
      {
        object: "block",
        id: "3",
        type: "heading_3",
        created_time: "",
        last_edited_time: "",
        has_children: false,
        archived: false,
        heading_3: {
          rich_text: [{ type: "text", text: { content: "Section" }, plain_text: "Section" }],
        },
      },
    ];

    const md = blocksToMarkdown(blocks);
    expect(md).toContain("# Title");
    expect(md).toContain("## Subtitle");
    expect(md).toContain("### Section");
  });

  it("should convert list blocks", () => {
    const blocks: NotionBlock[] = [
      {
        object: "block",
        id: "1",
        type: "bulleted_list_item",
        created_time: "",
        last_edited_time: "",
        has_children: false,
        archived: false,
        bulleted_list_item: {
          rich_text: [{ type: "text", text: { content: "Item 1" }, plain_text: "Item 1" }],
        },
      },
      {
        object: "block",
        id: "2",
        type: "bulleted_list_item",
        created_time: "",
        last_edited_time: "",
        has_children: false,
        archived: false,
        bulleted_list_item: {
          rich_text: [{ type: "text", text: { content: "Item 2" }, plain_text: "Item 2" }],
        },
      },
    ];

    const md = blocksToMarkdown(blocks);
    expect(md).toContain("- Item 1");
    expect(md).toContain("- Item 2");
  });

  it("should convert numbered list with correct indices", () => {
    const blocks: NotionBlock[] = [
      {
        object: "block",
        id: "1",
        type: "numbered_list_item",
        created_time: "",
        last_edited_time: "",
        has_children: false,
        archived: false,
        numbered_list_item: {
          rich_text: [{ type: "text", text: { content: "First" }, plain_text: "First" }],
        },
      },
      {
        object: "block",
        id: "2",
        type: "numbered_list_item",
        created_time: "",
        last_edited_time: "",
        has_children: false,
        archived: false,
        numbered_list_item: {
          rich_text: [{ type: "text", text: { content: "Second" }, plain_text: "Second" }],
        },
      },
      {
        object: "block",
        id: "3",
        type: "paragraph",
        created_time: "",
        last_edited_time: "",
        has_children: false,
        archived: false,
        paragraph: {
          rich_text: [{ type: "text", text: { content: "Break" }, plain_text: "Break" }],
        },
      },
      {
        object: "block",
        id: "4",
        type: "numbered_list_item",
        created_time: "",
        last_edited_time: "",
        has_children: false,
        archived: false,
        numbered_list_item: {
          rich_text: [{ type: "text", text: { content: "New list" }, plain_text: "New list" }],
        },
      },
    ];

    const md = blocksToMarkdown(blocks);
    expect(md).toContain("1. First");
    expect(md).toContain("2. Second");
    expect(md).toContain("1. New list"); // Reset after paragraph
  });

  it("should convert quote blocks", () => {
    const blocks: NotionBlock[] = [
      {
        object: "block",
        id: "1",
        type: "quote",
        created_time: "",
        last_edited_time: "",
        has_children: false,
        archived: false,
        quote: {
          rich_text: [
            { type: "text", text: { content: "Famous quote" }, plain_text: "Famous quote" },
          ],
        },
      },
    ];

    expect(blocksToMarkdown(blocks)).toBe("> Famous quote");
  });

  it("should convert code blocks", () => {
    const blocks: NotionBlock[] = [
      {
        object: "block",
        id: "1",
        type: "code",
        created_time: "",
        last_edited_time: "",
        has_children: false,
        archived: false,
        code: {
          rich_text: [
            { type: "text", text: { content: "const x = 1;" }, plain_text: "const x = 1;" },
          ],
          language: "javascript",
        },
      },
    ];

    const md = blocksToMarkdown(blocks);
    expect(md).toContain("```javascript");
    expect(md).toContain("const x = 1;");
    expect(md).toContain("```");
  });

  it("should convert to-do blocks", () => {
    const blocks: NotionBlock[] = [
      {
        object: "block",
        id: "1",
        type: "to_do",
        created_time: "",
        last_edited_time: "",
        has_children: false,
        archived: false,
        to_do: {
          rich_text: [{ type: "text", text: { content: "Unchecked" }, plain_text: "Unchecked" }],
          checked: false,
        },
      },
      {
        object: "block",
        id: "2",
        type: "to_do",
        created_time: "",
        last_edited_time: "",
        has_children: false,
        archived: false,
        to_do: {
          rich_text: [{ type: "text", text: { content: "Checked" }, plain_text: "Checked" }],
          checked: true,
        },
      },
    ];

    const md = blocksToMarkdown(blocks);
    expect(md).toContain("- [ ] Unchecked");
    expect(md).toContain("- [x] Checked");
  });

  it("should convert divider blocks", () => {
    const blocks: NotionBlock[] = [
      {
        object: "block",
        id: "1",
        type: "divider",
        created_time: "",
        last_edited_time: "",
        has_children: false,
        archived: false,
        divider: {},
      },
    ];

    expect(blocksToMarkdown(blocks)).toBe("---");
  });
});

describe("computeContentHash", () => {
  it("should generate consistent hashes", () => {
    const content = "Hello World";
    const hash1 = computeContentHash(content);
    const hash2 = computeContentHash(content);

    expect(hash1).toBe(hash2);
  });

  it("should generate different hashes for different content", () => {
    const hash1 = computeContentHash("Content A");
    const hash2 = computeContentHash("Content B");

    expect(hash1).not.toBe(hash2);
  });

  it("should return 16-character hash", () => {
    const hash = computeContentHash("Test content");
    expect(hash).toHaveLength(16);
  });
});

// =============================================================================
// URL Parsing Tests
// =============================================================================

describe("NotionService.parseNotionUrl", () => {
  it("should parse notion:// URLs", () => {
    expect(NotionService.parseNotionUrl("notion://page/abc123def456")).toBe("abc123def456");
  });

  it("should parse full Notion URLs", () => {
    // 32-char hex ID
    expect(
      NotionService.parseNotionUrl(
        "https://www.notion.so/workspace/Page-Title-abc123def456789012345678901234ab",
      ),
    ).toBe("abc123def456789012345678901234ab");
  });

  it("should parse bare page IDs", () => {
    // 32-char hex ID
    expect(NotionService.parseNotionUrl("abc123def456789012345678901234ab")).toBe(
      "abc123def456789012345678901234ab",
    );
  });

  it("should parse UUIDs with dashes", () => {
    expect(NotionService.parseNotionUrl("abc123de-f456-7890-1234-567890123456")).toBe(
      "abc123de-f456-7890-1234-567890123456",
    );
  });

  it("should return null for invalid URLs", () => {
    expect(NotionService.parseNotionUrl("https://example.com/page")).toBeNull();
    expect(NotionService.parseNotionUrl("invalid")).toBeNull();
    expect(NotionService.parseNotionUrl("")).toBeNull();
  });
});

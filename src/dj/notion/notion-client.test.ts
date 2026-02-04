/**
 * Tests for Notion HTTP Client
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNotionClient, NotionClient } from "./notion-client.js";
import {
  NotionApiError,
  NotionNotFoundError,
  NotionRateLimitError,
  NotionValidationError,
} from "./types.js";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("NotionClient", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Factory Tests
  // ===========================================================================

  describe("createNotionClient", () => {
    it("should throw if API key is missing", () => {
      const originalEnv = process.env.NOTION_API_KEY;
      delete process.env.NOTION_API_KEY;

      expect(() => createNotionClient()).toThrow("NOTION_API_KEY");

      process.env.NOTION_API_KEY = originalEnv;
    });

    it("should create client with config API key", () => {
      const client = createNotionClient({ apiKey: "test-key" });
      expect(client).toBeInstanceOf(NotionClient);
    });
  });

  // ===========================================================================
  // Request Headers Tests
  // ===========================================================================

  describe("request headers", () => {
    it("should set correct Authorization header", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ object: "page", id: "test-id" }),
      });

      const client = new NotionClient({ apiKey: "secret_test123" });
      await client.getPage("test-page-id");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer secret_test123",
          }),
        }),
      );
    });

    it("should set Notion-Version header", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ object: "page", id: "test-id" }),
      });

      const client = new NotionClient({ apiKey: "test-key" });
      await client.getPage("test-page-id");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Notion-Version": "2025-09-03",
          }),
        }),
      );
    });

    it("should use custom API version", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ object: "page", id: "test-id" }),
      });

      const client = new NotionClient({
        apiKey: "test-key",
        apiVersion: "2023-01-01",
      });
      await client.getPage("test-page-id");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Notion-Version": "2023-01-01",
          }),
        }),
      );
    });

    it("should set Content-Type header", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ object: "page", id: "test-id" }),
      });

      const client = new NotionClient({ apiKey: "test-key" });
      await client.getPage("test-page-id");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });
  });

  // ===========================================================================
  // Endpoint Tests
  // ===========================================================================

  describe("endpoints", () => {
    it("should call correct URL for getPage", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ object: "page", id: "abc123" }),
      });

      const client = new NotionClient({ apiKey: "test-key" });
      await client.getPage("abc123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.notion.com/v1/pages/abc123",
        expect.anything(),
      );
    });

    it("should call correct URL for createPage", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ object: "page", id: "new-page" }),
      });

      const client = new NotionClient({ apiKey: "test-key" });
      await client.createPage({
        parent: { database_id: "db-id" },
        properties: {},
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.notion.com/v1/pages",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("should call correct URL for updatePage", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ object: "page", id: "page-id" }),
      });

      const client = new NotionClient({ apiKey: "test-key" });
      await client.updatePage("page-id", { properties: {} });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.notion.com/v1/pages/page-id",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    it("should call correct URL for queryDataSource", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ object: "list", results: [], has_more: false }),
      });

      const client = new NotionClient({ apiKey: "test-key" });
      await client.queryDataSource("db-id", {});

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.notion.com/v1/databases/db-id/query",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("should call correct URL for listBlockChildren", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ object: "list", results: [], has_more: false }),
      });

      const client = new NotionClient({ apiKey: "test-key" });
      await client.listBlockChildren("block-id");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://api.notion.com/v1/blocks/block-id/children"),
        expect.objectContaining({ method: "GET" }),
      );
    });
  });

  // ===========================================================================
  // Pagination Tests
  // ===========================================================================

  describe("pagination", () => {
    it("should handle pagination for queryDataSourceAll", async () => {
      // First page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            object: "list",
            results: [{ id: "page1" }],
            has_more: true,
            next_cursor: "cursor1",
          }),
      });

      // Second page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            object: "list",
            results: [{ id: "page2" }],
            has_more: false,
            next_cursor: null,
          }),
      });

      const client = new NotionClient({ apiKey: "test-key" });
      const results = await client.queryDataSourceAll("db-id");

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("page1");
      expect(results[1].id).toBe("page2");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should respect maxResults limit", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            object: "list",
            results: [{ id: "page1" }, { id: "page2" }],
            has_more: true,
            next_cursor: "cursor1",
          }),
      });

      const client = new NotionClient({ apiKey: "test-key" });
      const results = await client.queryDataSourceAll("db-id", {}, 2);

      expect(results).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should handle pagination for listBlockChildrenAll", async () => {
      // First page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            object: "list",
            results: [{ id: "block1", type: "paragraph" }],
            has_more: true,
            next_cursor: "cursor1",
          }),
      });

      // Second page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            object: "list",
            results: [{ id: "block2", type: "paragraph" }],
            has_more: false,
            next_cursor: null,
          }),
      });

      const client = new NotionClient({ apiKey: "test-key" });
      const blocks = await client.listBlockChildrenAll("page-id");

      expect(blocks).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe("error handling", () => {
    it("should throw NotionValidationError for 400", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: { get: () => null },
        json: () =>
          Promise.resolve({
            object: "error",
            status: 400,
            code: "validation_error",
            message: "Invalid request",
          }),
      });

      const client = new NotionClient({ apiKey: "test-key" });

      await expect(client.getPage("invalid")).rejects.toThrow(NotionValidationError);
    });

    it("should throw NotionNotFoundError for 404", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: { get: () => null },
        json: () =>
          Promise.resolve({
            object: "error",
            status: 404,
            code: "object_not_found",
            message: "Page not found",
          }),
      });

      const client = new NotionClient({ apiKey: "test-key" });

      await expect(client.getPage("missing")).rejects.toThrow(NotionNotFoundError);
    });

    it("should throw NotionApiError for other errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: { get: () => null },
        json: () =>
          Promise.resolve({
            object: "error",
            status: 403,
            code: "forbidden",
            message: "Access denied",
          }),
      });

      const client = new NotionClient({
        apiKey: "test-key",
        maxRetries: 0, // No retries for this test
      });

      await expect(client.getPage("forbidden")).rejects.toThrow(NotionApiError);
    });
  });

  // ===========================================================================
  // Retry Tests
  // ===========================================================================

  describe("retries", () => {
    it("should retry on 429 rate limit", async () => {
      // First call: rate limited
      const mockHeaders = new Map([["Retry-After", "1"]]);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: (key: string) => mockHeaders.get(key) },
        json: () =>
          Promise.resolve({
            object: "error",
            status: 429,
            code: "rate_limited",
            message: "Rate limited",
          }),
      });

      // Second call: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: () => Promise.resolve({ object: "page", id: "test-id" }),
      });

      const client = new NotionClient({
        apiKey: "test-key",
        maxRetries: 3,
        retryBaseDelayMs: 10, // Fast for testing
      });

      const result = await client.getPage("test-id");

      expect(result.id).toBe("test-id");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should retry on 5xx server errors", async () => {
      // First call: server error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Map(),
        json: () =>
          Promise.resolve({
            object: "error",
            status: 500,
            message: "Internal server error",
          }),
      });

      // Second call: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: () => Promise.resolve({ object: "page", id: "test-id" }),
      });

      const client = new NotionClient({
        apiKey: "test-key",
        maxRetries: 3,
        retryBaseDelayMs: 10,
      });

      const result = await client.getPage("test-id");

      expect(result.id).toBe("test-id");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should throw after max retries", async () => {
      // All calls fail
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: { get: () => null },
        json: () =>
          Promise.resolve({
            object: "error",
            status: 500,
            message: "Internal server error",
          }),
      });

      const client = new NotionClient({
        apiKey: "test-key",
        maxRetries: 2,
        retryBaseDelayMs: 10,
      });

      await expect(client.getPage("test-id")).rejects.toThrow(NotionApiError);
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it("should NOT retry on validation errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: { get: () => null },
        json: () =>
          Promise.resolve({
            object: "error",
            status: 400,
            code: "validation_error",
            message: "Invalid request",
          }),
      });

      const client = new NotionClient({
        apiKey: "test-key",
        maxRetries: 3,
        retryBaseDelayMs: 10,
      });

      await expect(client.getPage("invalid")).rejects.toThrow(NotionValidationError);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });

    it("should NOT retry on 404 not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: { get: () => null },
        json: () =>
          Promise.resolve({
            object: "error",
            status: 404,
            code: "object_not_found",
            message: "Not found",
          }),
      });

      const client = new NotionClient({
        apiKey: "test-key",
        maxRetries: 3,
        retryBaseDelayMs: 10,
      });

      await expect(client.getPage("missing")).rejects.toThrow(NotionNotFoundError);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });
  });
});

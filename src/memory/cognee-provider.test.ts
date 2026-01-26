import { describe, expect, it, vi, beforeEach } from "vitest";
import { CogneeMemoryProvider } from "./cognee-provider.js";
import type { ClawdbotConfig } from "../config/config.js";

vi.mock("./cognee-client.js", () =&gt; ({
  CogneeClient: vi.fn().mockImplementation(() =&gt; ({
    healthCheck: vi.fn().mockResolvedValue(true),
    add: vi.fn().mockResolvedValue({
      datasetId: "test-dataset-id",
      datasetName: "test-dataset",
      message: "Success",
    }),
    cognify: vi.fn().mockResolvedValue({
      status: "success",
      message: "Cognify completed",
    }),
    search: vi.fn().mockResolvedValue({
      results: [
        {
          id: "result-1",
          text: "Test result text",
          score: 0.85,
          metadata: {
            path: "test.md",
            source: "memory",
          },
        },
      ],
      query: "test query",
      searchType: "insights",
    }),
    status: vi.fn().mockResolvedValue({
      status: "healthy",
      version: "1.0.0",
      datasets: [
        {
          id: "test-dataset-id",
          name: "clawdbot",
          documentCount: 5,
        },
      ],
    }),
  })),
}));

vi.mock("./internal.js", () =&gt; ({
  listMemoryFiles: vi.fn().mockResolvedValue([]),
  buildFileEntry: vi.fn(),
  hashText: vi.fn().mockReturnValue("test-hash"),
}));

vi.mock("node:fs/promises", () =&gt; ({
  default: {
    readdir: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockResolvedValue("Test file content"),
    stat: vi.fn().mockResolvedValue({ mtimeMs: 1234567890, size: 100 }),
  },
}));

describe("CogneeMemoryProvider", () =&gt; {
  const mockConfig: ClawdbotConfig = {
    agents: {
      defaults: {
        workspace: "/tmp/test-workspace",
      },
    },
  };

  beforeEach(() =&gt; {
    vi.clearAllMocks();
  });

  describe("constructor", () =&gt; {
    it("should initialize with default configuration", () =&gt; {
      const provider = new CogneeMemoryProvider(mockConfig, "test-agent", ["memory"]);

      expect(provider).toBeDefined();
    });

    it("should initialize with custom configuration", () =&gt; {
      const provider = new CogneeMemoryProvider(mockConfig, "test-agent", ["memory"], {
        baseUrl: "http://custom:8000",
        apiKey: "custom-key",
        datasetName: "custom-dataset",
        searchType: "chunks",
        maxResults: 10,
      });

      expect(provider).toBeDefined();
    });
  });

  describe("healthCheck", () =&gt; {
    it("should perform health check", async () =&gt; {
      const provider = new CogneeMemoryProvider(mockConfig, "test-agent", ["memory"]);

      const healthy = await provider.healthCheck();

      expect(healthy).toBe(true);
    });
  });

  describe("search", () =&gt; {
    it("should search and transform results", async () =&gt; {
      const provider = new CogneeMemoryProvider(mockConfig, "test-agent", ["memory"]);

      const results = await provider.search("test query");

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        path: "test.md",
        source: "memory",
        score: 0.85,
        snippet: "Test result text",
      });
    });

    it("should respect maxResults setting", async () =&gt; {
      const provider = new CogneeMemoryProvider(
        mockConfig,
        "test-agent",
        ["memory"],
        { maxResults: 5 },
      );

      const results = await provider.search("test query");

      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe("cognify", () =&gt; {
    it("should run cognify", async () =&gt; {
      const provider = new CogneeMemoryProvider(mockConfig, "test-agent", ["memory"]);

      await expect(provider.cognify()).resolves.not.toThrow();
    });
  });

  describe("getStatus", () =&gt; {
    it("should return status information", async () =&gt; {
      const provider = new CogneeMemoryProvider(mockConfig, "test-agent", ["memory"]);

      const status = await provider.getStatus();

      expect(status).toMatchObject({
        connected: true,
        datasetName: "clawdbot",
        syncedFileCount: 0,
      });
    });
  });
});

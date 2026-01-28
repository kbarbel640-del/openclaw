import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CogneeClient } from "./cognee-client.js";
import { request } from "undici";

vi.mock("undici", async () => {
  const actual = await vi.importActual<typeof import("undici")>("undici");
  return {
    ...actual,
    request: vi.fn(),
  };
});

describe("CogneeClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("add", () => {
    it("should add data successfully", async () => {
      const mockResponse = {
        statusCode: 200,
        body: {
          json: vi.fn().mockResolvedValue({
            dataset_id: "test-dataset-id",
            dataset_name: "test-dataset",
            message: "Data added successfully",
          }),
          text: vi.fn(),
        },
      };
      vi.mocked(request).mockResolvedValue(mockResponse as any);

      const client = new CogneeClient({
        baseUrl: "http://localhost:8000",
        apiKey: "test-key",
      });

      const result = await client.add({
        data: "Test data",
        datasetName: "test-dataset",
      });

      expect(result).toEqual({
        datasetId: "test-dataset-id",
        datasetName: "test-dataset",
        message: "Data added successfully",
      });
      expect(request).toHaveBeenCalledWith(
        "http://localhost:8000/api/v1/add",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-key",
            "X-Api-Key": "test-key",
          }),
        }),
      );
    });

    it("should handle errors", async () => {
      const mockResponse = {
        statusCode: 500,
        body: {
          text: vi.fn().mockResolvedValue("Internal server error"),
        },
      };
      vi.mocked(request).mockResolvedValue(mockResponse as any);

      const client = new CogneeClient();

      await expect(
        client.add({
          data: "Test data",
          datasetName: "test-dataset",
        }),
      ).rejects.toThrow(
        "Cognee add request failed: Cognee add failed with status 500: Internal server error",
      );
    });
  });

  describe("cognify", () => {
    it("should run cognify successfully", async () => {
      const mockResponse = {
        statusCode: 200,
        body: {
          json: vi.fn().mockResolvedValue({
            status: "success",
            message: "Cognify completed",
          }),
          text: vi.fn(),
        },
      };
      vi.mocked(request).mockResolvedValue(mockResponse as any);

      const client = new CogneeClient({
        baseUrl: "http://localhost:8000",
      });

      const result = await client.cognify({
        datasetIds: ["dataset-1"],
      });

      expect(result).toEqual({
        status: "success",
        message: "Cognify completed",
      });
    });
  });

  describe("search", () => {
    it("should search successfully", async () => {
      const mockResponse = {
        statusCode: 200,
        body: {
          json: vi.fn().mockResolvedValue({
            results: [
              {
                id: "result-1",
                text: "Test result",
                score: 0.9,
                metadata: { path: "test.md" },
              },
            ],
            query: "test query",
            search_type: "GRAPH_COMPLETION",
          }),
          text: vi.fn(),
        },
      };
      vi.mocked(request).mockResolvedValue(mockResponse as any);

      const client = new CogneeClient();

      const result = await client.search({
        queryText: "test query",
        searchType: "GRAPH_COMPLETION",
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({
        id: "result-1",
        text: "Test result",
        score: 0.9,
        metadata: { path: "test.md" },
      });
      expect(result.query).toBe("test query");
    });

    it("should use default search type", async () => {
      const mockResponse = {
        statusCode: 200,
        body: {
          json: vi.fn().mockResolvedValue({
            results: [],
            query: "test",
            search_type: "GRAPH_COMPLETION",
          }),
          text: vi.fn(),
        },
      };
      vi.mocked(request).mockResolvedValue(mockResponse as any);

      const client = new CogneeClient();
      await client.search({ queryText: "test" });

      expect(request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"searchType":"GRAPH_COMPLETION"'),
        }),
      );
    });
  });

  describe("status", () => {
    it("should get status successfully", async () => {
      const mockResponse = {
        statusCode: 200,
        body: {
          json: vi.fn().mockResolvedValue({ status: "healthy" }),
          text: vi.fn(),
        },
      };
      vi.mocked(request).mockResolvedValue(mockResponse as any);

      const client = new CogneeClient();

      const result = await client.status();

      expect(result).toEqual({
        status: "healthy",
      });
    });
  });

  describe("healthCheck", () => {
    it("should return true when status is successful", async () => {
      const mockResponse = {
        statusCode: 200,
        body: {
          json: vi.fn().mockResolvedValue({ status: "healthy" }),
          text: vi.fn(),
        },
      };
      vi.mocked(request).mockResolvedValue(mockResponse as any);

      const client = new CogneeClient();
      const result = await client.healthCheck();

      expect(result).toBe(true);
    });

    it("should return false when status fails", async () => {
      vi.mocked(request).mockRejectedValue(new Error("Connection failed"));

      const client = new CogneeClient();
      const result = await client.healthCheck();

      expect(result).toBe(false);
    });
  });
});

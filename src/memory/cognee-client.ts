import { Blob } from "buffer";
import { FormData, request } from "undici";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("cognee");

const DEFAULT_BASE_URL = "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 30_000;
const API_PREFIX = "/api/v1";

export type CogneeClientConfig = {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
};

export type CogneeAddRequest = {
  data: string;
  datasetName?: string;
  datasetId?: string;
};

export type CogneeAddResponse = {
  datasetId: string;
  datasetName: string;
  message: string;
};

export type CogneeCognifyRequest = {
  datasetIds?: string[];
};

export type CogneeCognifyResponse = {
  status: string;
  message: string;
};

export type CogneeSearchRequest = {
  queryText: string;
  searchType?: "GRAPH_COMPLETION" | "chunks" | "summaries";
  datasetIds?: string[];
};

export type CogneeSearchResult = {
  id: string;
  text: string;
  score: number;
  metadata?: Record<string, unknown>;
};

export type CogneeSearchResponse = {
  results: CogneeSearchResult[];
  query: string;
  searchType: string;
};

export type CogneeStatusResponse = {
  status: string;
  version?: string;
  datasets?: Array<{
    id: string;
    name: string;
    documentCount?: number;
  }>;
};

type CogneeSearchApiType = "SUMMARIES" | "CHUNKS" | "GRAPH_COMPLETION";

export class CogneeClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(config: CogneeClientConfig = {}) {
    this.baseUrl = config.baseUrl?.replace(/\/$/, "") || DEFAULT_BASE_URL;
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
  }

  async add(req: CogneeAddRequest): Promise<CogneeAddResponse> {
    const url = `${this.baseUrl}${API_PREFIX}/add`;
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
      headers["X-Api-Key"] = this.apiKey;
    }

    log.debug("Adding data to Cognee", {
      url,
      datasetName: req.datasetName,
      dataLength: req.data.length,
    });

    try {
      const formData = new FormData();
      const blob = new Blob([req.data], { type: "text/plain" });
      formData.append("data", blob, "clawdbot-memory.txt");
      if (req.datasetName) {
        formData.append("datasetName", req.datasetName);
      }
      if (req.datasetId) {
        formData.append("datasetId", req.datasetId);
      }

      const response = await request(url, {
        method: "POST",
        headers,
        body: formData,
        bodyTimeout: this.timeoutMs,
        headersTimeout: this.timeoutMs,
      });

      if (response.statusCode !== 200) {
        const errorText = await response.body.text();
        throw new Error(`Cognee add failed with status ${response.statusCode}: ${errorText}`);
      }

      const data = (await response.body.json()) as {
        dataset_id: string;
        dataset_name: string;
        message: string;
      };

      return {
        datasetId: data.dataset_id,
        datasetName: data.dataset_name,
        message: data.message,
      };
    } catch (error) {
      log.error("Failed to add data to Cognee", { error });
      throw new Error(
        `Cognee add request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async cognify(req: CogneeCognifyRequest = {}): Promise<CogneeCognifyResponse> {
    const url = `${this.baseUrl}${API_PREFIX}/cognify`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
      headers["X-Api-Key"] = this.apiKey;
    }

    log.debug("Running cognify", { url, datasetIds: req.datasetIds });

    try {
      const response = await request(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          datasetIds: req.datasetIds,
        }),
        bodyTimeout: this.timeoutMs,
        headersTimeout: this.timeoutMs,
      });

      if (response.statusCode !== 200) {
        const errorText = await response.body.text();
        throw new Error(`Cognee cognify failed with status ${response.statusCode}: ${errorText}`);
      }

      const data = (await response.body.json()) as {
        status: string;
        message: string;
      };

      return {
        status: data.status,
        message: data.message,
      };
    } catch (error) {
      log.error("Failed to cognify", { error });
      throw new Error(
        `Cognee cognify request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async search(req: CogneeSearchRequest): Promise<CogneeSearchResponse> {
    const url = `${this.baseUrl}${API_PREFIX}/search`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
      headers["X-Api-Key"] = this.apiKey;
    }

    log.debug("Searching Cognee", {
      url,
      query: req.queryText,
      searchType: req.searchType,
    });

    try {
      const response = await request(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: req.queryText,
          searchType: this.mapSearchType(req.searchType),
          datasetIds: req.datasetIds,
        }),
        bodyTimeout: this.timeoutMs,
        headersTimeout: this.timeoutMs,
      });

      if (response.statusCode !== 200) {
        const errorText = await response.body.text();
        throw new Error(`Cognee search failed with status ${response.statusCode}: ${errorText}`);
      }

      const data = (await response.body.json()) as unknown;
      const results = this.normalizeSearchResults(data);

      return {
        results,
        query: req.queryText,
        searchType: req.searchType || "GRAPH_COMPLETION",
      };
    } catch (error) {
      log.error("Failed to search Cognee", { error });
      throw new Error(
        `Cognee search request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async status(): Promise<CogneeStatusResponse> {
    const url = `${this.baseUrl}/health`;
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
      headers["X-Api-Key"] = this.apiKey;
    }

    log.debug("Checking Cognee status", { url });

    try {
      const response = await request(url, {
        method: "GET",
        headers,
        bodyTimeout: this.timeoutMs,
        headersTimeout: this.timeoutMs,
      });

      if (response.statusCode !== 200) {
        const errorText = await response.body.text();
        throw new Error(`Cognee status failed with status ${response.statusCode}: ${errorText}`);
      }

      const data = (await response.body.json()) as { status?: string };

      return {
        status: data.status || "healthy",
      };
    } catch (error) {
      log.error("Failed to get Cognee status", { error });
      throw new Error(
        `Cognee status request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.status();
      return true;
    } catch {
      return false;
    }
  }

  private mapSearchType(type?: CogneeSearchRequest["searchType"]): CogneeSearchApiType {
    switch (type) {
      case "chunks":
        return "CHUNKS";
      case "summaries":
        return "SUMMARIES";
      case "GRAPH_COMPLETION":
      default:
        return "GRAPH_COMPLETION";
    }
  }

  private normalizeSearchResults(data: unknown): CogneeSearchResult[] {
    if (Array.isArray(data)) {
      return data.map((item, index) => {
        if (typeof item === "string") {
          return { id: `result-${index}`, text: item, score: 0 };
        }

        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const hasStructuredFields =
            "id" in record || "text" in record || "score" in record || "metadata" in record;
          const raw =
            record.search_result ?? record.result ?? record.context ?? record.text ?? record;
          const text = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
          const datasetMetadata =
            record.dataset_name || record.dataset_id
              ? {
                  datasetName: record.dataset_name,
                  datasetId: record.dataset_id,
                }
              : undefined;
          const recordMetadata =
            record.metadata && typeof record.metadata === "object"
              ? (record.metadata as Record<string, unknown>)
              : undefined;
          const metadata = recordMetadata
            ? datasetMetadata
              ? { ...datasetMetadata, ...recordMetadata }
              : recordMetadata
            : datasetMetadata;

          if (hasStructuredFields) {
            return {
              id: typeof record.id === "string" ? record.id : `result-${index}`,
              text,
              score: typeof record.score === "number" ? record.score : 0,
              metadata,
            };
          }

          return { id: `result-${index}`, text, score: 0, metadata };
        }

        return {
          id: `result-${index}`,
          text: String(item),
          score: 0,
        };
      });
    }

    if (data && typeof data === "object" && "results" in data) {
      const results = (data as { results?: unknown }).results;
      if (Array.isArray(results)) {
        return this.normalizeSearchResults(results);
      }
    }

    return [];
  }
}

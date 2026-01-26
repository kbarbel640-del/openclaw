import { request } from "undici";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("cognee");

const DEFAULT_BASE_URL = "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 30_000;

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
  searchType?: "insights" | "chunks" | "summaries";
  datasetIds?: string[];
};

export type CogneeSearchResult = {
  id: string;
  text: string;
  score: number;
  metadata?: Record&lt;string, unknown&gt;;
};

export type CogneeSearchResponse = {
  results: CogneeSearchResult[];
  query: string;
  searchType: string;
};

export type CogneeStatusResponse = {
  status: string;
  version?: string;
  datasets?: Array&lt;{
    id: string;
    name: string;
    documentCount?: number;
  }&gt;;
};

export class CogneeClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(config: CogneeClientConfig = {}) {
    this.baseUrl = config.baseUrl?.replace(/\/$/, "") || DEFAULT_BASE_URL;
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
  }

  async add(req: CogneeAddRequest): Promise&lt;CogneeAddResponse&gt; {
    const url = `${this.baseUrl}/add`;
    const headers: Record&lt;string, string&gt; = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["X-Api-Key"] = this.apiKey;
    }

    log.debug("Adding data to Cognee", {
      url,
      datasetName: req.datasetName,
      dataLength: req.data.length,
    });

    try {
      const response = await request(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          data: req.data,
          dataset_name: req.datasetName,
          dataset_id: req.datasetId,
        }),
        bodyTimeout: this.timeoutMs,
        headersTimeout: this.timeoutMs,
      });

      if (response.statusCode !== 200) {
        const errorText = await response.body.text();
        throw new Error(
          `Cognee add failed with status ${response.statusCode}: ${errorText}`,
        );
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

  async cognify(req: CogneeCognifyRequest = {}): Promise&lt;CogneeCognifyResponse&gt; {
    const url = `${this.baseUrl}/cognify`;
    const headers: Record&lt;string, string&gt; = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["X-Api-Key"] = this.apiKey;
    }

    log.debug("Running cognify", { url, datasetIds: req.datasetIds });

    try {
      const response = await request(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          dataset_ids: req.datasetIds,
        }),
        bodyTimeout: this.timeoutMs,
        headersTimeout: this.timeoutMs,
      });

      if (response.statusCode !== 200) {
        const errorText = await response.body.text();
        throw new Error(
          `Cognee cognify failed with status ${response.statusCode}: ${errorText}`,
        );
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

  async search(req: CogneeSearchRequest): Promise&lt;CogneeSearchResponse&gt; {
    const url = `${this.baseUrl}/search`;
    const headers: Record&lt;string, string&gt; = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
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
          query_text: req.queryText,
          search_type: req.searchType || "insights",
          dataset_ids: req.datasetIds,
        }),
        bodyTimeout: this.timeoutMs,
        headersTimeout: this.timeoutMs,
      });

      if (response.statusCode !== 200) {
        const errorText = await response.body.text();
        throw new Error(
          `Cognee search failed with status ${response.statusCode}: ${errorText}`,
        );
      }

      const data = (await response.body.json()) as {
        results: Array&lt;{
          id: string;
          text: string;
          score: number;
          metadata?: Record&lt;string, unknown&gt;;
        }&gt;;
        query: string;
        search_type: string;
      };

      return {
        results: data.results.map((r) =&gt; ({
          id: r.id,
          text: r.text,
          score: r.score,
          metadata: r.metadata,
        })),
        query: data.query,
        searchType: data.search_type,
      };
    } catch (error) {
      log.error("Failed to search Cognee", { error });
      throw new Error(
        `Cognee search request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async status(): Promise&lt;CogneeStatusResponse&gt; {
    const url = `${this.baseUrl}/status`;
    const headers: Record&lt;string, string&gt; = {};
    if (this.apiKey) {
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
        throw new Error(
          `Cognee status failed with status ${response.statusCode}: ${errorText}`,
        );
      }

      const data = (await response.body.json()) as {
        status: string;
        version?: string;
        datasets?: Array&lt;{
          id: string;
          name: string;
          document_count?: number;
        }&gt;;
      };

      return {
        status: data.status,
        version: data.version,
        datasets: data.datasets?.map((d) =&gt; ({
          id: d.id,
          name: d.name,
          documentCount: d.document_count,
        })),
      };
    } catch (error) {
      log.error("Failed to get Cognee status", { error });
      throw new Error(
        `Cognee status request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async healthCheck(): Promise&lt;boolean&gt; {
    try {
      await this.status();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Notion HTTP Client
 *
 * Raw HTTP fetch wrapper for Notion API (not using @notionhq/client SDK).
 * Supports data_sources endpoints and custom API usage with retries/backoff.
 */

import type {
  NotionBlock,
  NotionClientConfig,
  NotionCreatePageRequest,
  NotionDatabaseQueryRequest,
  NotionErrorResponse,
  NotionPage,
  NotionPaginatedResponse,
  NotionUpdatePageRequest,
} from "./types.js";
import {
  NotionApiError,
  NotionNotFoundError,
  NotionRateLimitError,
  NotionValidationError,
} from "./types.js";

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_API_VERSION = "2025-09-03";
const DEFAULT_BASE_URL = "https://api.notion.com";
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 1000;

// =============================================================================
// Notion Client
// =============================================================================

export class NotionClient {
  private readonly apiKey: string;
  private readonly apiVersion: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;

  constructor(config: NotionClientConfig) {
    this.apiKey = config.apiKey;
    this.apiVersion = config.apiVersion ?? DEFAULT_API_VERSION;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs = config.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  }

  // ===========================================================================
  // Data Source Endpoints
  // ===========================================================================

  /**
   * Query a data source (database).
   * POST /v1/data_sources/{id}/query
   *
   * Note: This is an alias for databases/{id}/query for compatibility.
   */
  async queryDataSource(
    dataSourceId: string,
    body: NotionDatabaseQueryRequest = {},
  ): Promise<NotionPaginatedResponse<NotionPage>> {
    return this.request<NotionPaginatedResponse<NotionPage>>(
      "POST",
      `/v1/databases/${dataSourceId}/query`,
      body,
    );
  }

  /**
   * Query a data source with automatic pagination.
   * Returns all results up to maxResults.
   */
  async queryDataSourceAll(
    dataSourceId: string,
    body: NotionDatabaseQueryRequest = {},
    maxResults: number = 1000,
  ): Promise<NotionPage[]> {
    const results: NotionPage[] = [];
    let cursor: string | null = null;

    do {
      const response = await this.queryDataSource(dataSourceId, {
        ...body,
        start_cursor: cursor ?? undefined,
        page_size: Math.min(100, maxResults - results.length),
      });

      results.push(...response.results);
      cursor = response.has_more ? response.next_cursor : null;
    } while (cursor && results.length < maxResults);

    return results;
  }

  // ===========================================================================
  // Page Endpoints
  // ===========================================================================

  /**
   * Create a new page.
   * POST /v1/pages
   */
  async createPage(body: NotionCreatePageRequest): Promise<NotionPage> {
    return this.request<NotionPage>("POST", "/v1/pages", body);
  }

  /**
   * Update an existing page.
   * PATCH /v1/pages/{id}
   */
  async updatePage(pageId: string, body: NotionUpdatePageRequest): Promise<NotionPage> {
    return this.request<NotionPage>("PATCH", `/v1/pages/${pageId}`, body);
  }

  /**
   * Get a page by ID.
   * GET /v1/pages/{id}
   */
  async getPage(pageId: string): Promise<NotionPage> {
    return this.request<NotionPage>("GET", `/v1/pages/${pageId}`);
  }

  // ===========================================================================
  // Block Endpoints
  // ===========================================================================

  /**
   * List children blocks of a block/page.
   * GET /v1/blocks/{id}/children
   */
  async listBlockChildren(
    blockId: string,
    cursor?: string,
    pageSize: number = 100,
  ): Promise<NotionPaginatedResponse<NotionBlock>> {
    const params = new URLSearchParams();
    if (cursor) params.set("start_cursor", cursor);
    params.set("page_size", String(Math.min(100, pageSize)));

    const queryString = params.toString();
    const path = `/v1/blocks/${blockId}/children${queryString ? `?${queryString}` : ""}`;

    return this.request<NotionPaginatedResponse<NotionBlock>>("GET", path);
  }

  /**
   * List all children blocks with automatic pagination.
   * Returns all blocks up to maxBlocks.
   */
  async listBlockChildrenAll(blockId: string, maxBlocks: number = 500): Promise<NotionBlock[]> {
    const blocks: NotionBlock[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.listBlockChildren(
        blockId,
        cursor,
        Math.min(100, maxBlocks - blocks.length),
      );

      blocks.push(...response.results);
      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor && blocks.length < maxBlocks);

    return blocks;
  }

  // ===========================================================================
  // Internal Request Handler
  // ===========================================================================

  /**
   * Make an HTTP request to the Notion API with retries.
   */
  private async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Notion-Version": this.apiVersion,
      "Content-Type": "application/json",
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
          const errorBody = (await response.json().catch(() => ({}))) as NotionErrorResponse;

          if (attempt < this.maxRetries) {
            const delay = retryAfterMs ?? this.calculateBackoff(attempt);
            await this.sleep(delay);
            continue;
          }

          throw new NotionRateLimitError(
            errorBody.message ?? "Rate limit exceeded",
            retryAfterMs,
            errorBody.request_id,
          );
        }

        // Handle server errors (5xx) with retry
        if (response.status >= 500 && attempt < this.maxRetries) {
          const delay = this.calculateBackoff(attempt);
          await this.sleep(delay);
          continue;
        }

        // Parse response body
        const responseBody = await response.json().catch(() => null);

        // Handle errors
        if (!response.ok) {
          const errorResponse = responseBody as NotionErrorResponse | null;
          const message = errorResponse?.message ?? `HTTP ${response.status}`;
          const code = errorResponse?.code;
          const requestId = errorResponse?.request_id;

          if (response.status === 400) {
            throw new NotionValidationError(message, requestId);
          }
          if (response.status === 404) {
            throw new NotionNotFoundError(message, requestId);
          }
          throw new NotionApiError(message, response.status, code, requestId);
        }

        return responseBody as T;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on validation/not found errors
        if (error instanceof NotionValidationError || error instanceof NotionNotFoundError) {
          throw error;
        }

        // Don't retry on abort (timeout)
        if ((error as Error).name === "AbortError") {
          throw new NotionApiError(`Request timeout after ${this.timeoutMs}ms`, 408, "timeout");
        }

        // Retry on network errors
        if (attempt < this.maxRetries) {
          const delay = this.calculateBackoff(attempt);
          await this.sleep(delay);
          continue;
        }
      }
    }

    throw lastError ?? new NotionApiError("Unknown error", 500);
  }

  /**
   * Calculate exponential backoff delay.
   */
  private calculateBackoff(attempt: number): number {
    // Exponential backoff with jitter: base * 2^attempt + random(0-500ms)
    const exponentialDelay = this.retryBaseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * 500;
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30s
  }

  /**
   * Sleep for a given duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a Notion client from environment variables.
 */
export function createNotionClient(config?: Partial<NotionClientConfig>): NotionClient {
  const apiKey = config?.apiKey ?? process.env.NOTION_API_KEY;

  if (!apiKey) {
    throw new Error(
      "NOTION_API_KEY environment variable is required. " +
        "Get your API key from https://www.notion.so/my-integrations",
    );
  }

  return new NotionClient({
    apiKey,
    ...config,
  });
}

/**
 * Create a Notion client if API key is available, otherwise return null.
 * Use this for optional Notion integration.
 */
export function createNotionClientOptional(
  config?: Partial<NotionClientConfig>,
): NotionClient | null {
  const apiKey = config?.apiKey ?? process.env.NOTION_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new NotionClient({
    apiKey,
    ...config,
  });
}

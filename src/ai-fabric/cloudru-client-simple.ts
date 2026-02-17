/**
 * Cloud.ru AI Fabric — Simple Bearer-Token Client
 *
 * Lightweight HTTP client for the Cloud.ru AI Agents API that uses
 * a raw API key as a Bearer token directly (no IAM token exchange).
 *
 * Use this for onboarding/wizard flows where only CLOUDRU_API_KEY
 * is available and the full IAM dance is unnecessary.
 */

import type {
  CloudruApiErrorPayload,
  PaginatedResult,
  McpServer,
  ListMcpServersParams,
} from "./types.js";
import { resolveFetch } from "../infra/fetch.js";
import { resolveRetryConfig, retryAsync } from "../infra/retry.js";
import { CloudruApiError } from "./cloudru-client.js";
import {
  CLOUDRU_AI_AGENTS_BASE_URL,
  CLOUDRU_DEFAULT_TIMEOUT_MS,
  CLOUDRU_RETRY_DEFAULTS,
  CLOUDRU_DEFAULT_PAGE_SIZE,
} from "./constants.js";

export type CloudruSimpleClientConfig = {
  /** Cloud.ru AI Fabric project ID. */
  projectId: string;
  /** Raw API key (used as Bearer token directly). */
  apiKey: string;
  /** Override AI Agents base URL (for testing). */
  baseUrl?: string;
  /** HTTP request timeout in ms. */
  timeoutMs?: number;
  /** Custom fetch implementation (for testing). */
  fetchImpl?: typeof fetch;
};

export class CloudruSimpleClient {
  readonly projectId: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: CloudruSimpleClientConfig) {
    this.projectId = config.projectId;
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? CLOUDRU_AI_AGENTS_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = config.timeoutMs ?? CLOUDRU_DEFAULT_TIMEOUT_MS;
    this.fetchImpl = resolveFetch(config.fetchImpl) ?? fetch;
  }

  private url(path: string): string {
    return `${this.baseUrl}/${this.projectId}${path}`;
  }

  async get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    const retryConfig = resolveRetryConfig(CLOUDRU_RETRY_DEFAULTS);

    return retryAsync(
      async () => {
        let fullUrl = this.url(path);
        if (query) {
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries(query)) {
            if (value !== undefined) {
              params.set(key, String(value));
            }
          }
          const qs = params.toString();
          if (qs) {
            fullUrl += `?${qs}`;
          }
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
          const res = await this.fetchImpl(fullUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          });

          if (!res.ok) {
            const text = await res.text().catch(() => "");
            const payload = parseErrorPayload(text);
            const detail = payload?.message ?? (text || `HTTP ${res.status}`);

            throw new CloudruApiError(
              `Cloud.ru API GET ${path} failed (${res.status}): ${detail}`,
              res.status,
              payload?.code,
            );
          }

          return (await res.json()) as T;
        } finally {
          clearTimeout(timer);
        }
      },
      {
        ...retryConfig,
        label: `GET ${path}`,
        shouldRetry: (err) => {
          if (!(err instanceof CloudruApiError)) {
            return false;
          }
          return err.status === 429 || err.status >= 500;
        },
      },
    );
  }

  /** List MCP servers available in the project. */
  async listMcpServers(params?: ListMcpServersParams): Promise<PaginatedResult<McpServer>> {
    return this.get<PaginatedResult<McpServer>>("/mcpServers", {
      search: params?.search,
      limit: params?.limit ?? CLOUDRU_DEFAULT_PAGE_SIZE,
      offset: params?.offset ?? 0,
    });
  }
}

function parseErrorPayload(text: string): CloudruApiErrorPayload | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }
  try {
    return JSON.parse(trimmed) as CloudruApiErrorPayload;
  } catch {
    return null;
  }
}

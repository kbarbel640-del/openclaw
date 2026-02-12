import type { MatrixError } from "../types.js";

export class MatrixApiError extends Error {
  constructor(
    public readonly errcode: string,
    message: string,
    public readonly statusCode: number,
    public readonly softLogout?: boolean
  ) {
    super(`${errcode}: ${message}`);
    this.name = "MatrixApiError";
  }
}

export interface MatrixHttpClient {
  homeserver: string;
  accessToken: string;
}

let _client: MatrixHttpClient | null = null;

export function initHttpClient(homeserver: string, accessToken: string): void {
  _client = {
    homeserver: homeserver.replace(/\/+$/, ""),
    accessToken,
  };
}

export function updateAccessToken(token: string): void {
  if (_client) _client.accessToken = token;
}

export function getClient(): MatrixHttpClient {
  if (!_client) throw new Error("Matrix HTTP client not initialized");
  return _client;
}

/**
 * Make an authenticated request to the Matrix homeserver.
 * Auth via Authorization header (never query param — deprecated v1.11).
 */
export async function matrixFetch<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  opts?: { timeoutMs?: number; noAuth?: boolean; checkEventSize?: boolean }
): Promise<T> {
  const client = getClient();
  const url = `${client.homeserver}${path}`;
  const headers: Record<string, string> = {};

  if (!opts?.noAuth) {
    headers["Authorization"] = `Bearer ${client.accessToken}`;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const jsonBody = body !== undefined ? JSON.stringify(body) : undefined;

  // Event size check (spec §6.1: 65536 bytes max) — only for event sends
  // Other endpoints (filters, login, key uploads, member queries) may exceed this
  if (opts?.checkEventSize && jsonBody && Buffer.byteLength(jsonBody) >= 65536) {
    throw new Error(
      `Event too large: ${Buffer.byteLength(jsonBody)} bytes (max 65536)`
    );
  }

  const controller = new AbortController();
  const timeout = opts?.timeoutMs ?? 30_000;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: jsonBody,
      signal: controller.signal,
    });

    const responseText = await response.text();
    let responseJson: any;

    try {
      responseJson = JSON.parse(responseText);
    } catch {
      if (!response.ok) {
        throw new MatrixApiError(
          "M_UNKNOWN",
          `HTTP ${response.status}: ${responseText.slice(0, 200)}`,
          response.status
        );
      }
      return responseText as unknown as T;
    }

    if (!response.ok) {
      const err = responseJson as MatrixError;
      throw new MatrixApiError(
        err.errcode ?? "M_UNKNOWN",
        err.error ?? `HTTP ${response.status}`,
        response.status,
        err.soft_logout
      );
    }

    return responseJson as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generate a transaction ID for PUT sends (device-scoped per v1.7).
 */
export function txnId(): string {
  return crypto.randomUUID();
}

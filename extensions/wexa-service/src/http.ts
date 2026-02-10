/**
 * HTTP helpers for Wexa-Service API calls.
 */

import type { WexaServiceConfig } from "./config.js";
import { getEffectiveUserContext } from "./request-context.js";

/** Standard API response wrapper */
export type ApiResult = {
  success: boolean;
  data?: unknown;
  error?: string;
  status?: number;
};

/** Make an authenticated request to the Data-Service API. */
export async function makeDataServiceRequest(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    config: WexaServiceConfig;
  },
): Promise<ApiResult> {
  const { method = "GET", body, config } = options;

  const userCtx = getEffectiveUserContext();

  const url = `${config.url}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.serverKey) {
    headers["x-server-key"] = config.serverKey;
  }
  if (userCtx.apiKey) {
    headers["Authorization"] = `Bearer ${userCtx.apiKey}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs ?? 30000);

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }

    if (!response.ok) {
      const errorMsg =
        typeof data === "object" && data && "error" in data
          ? String((data as { error: unknown }).error)
          : `HTTP ${response.status}: ${responseText.slice(0, 200)}`;
      console.error(`[wexa-service] Request failed: ${method} ${url} - ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
        status: response.status,
      };
    }

    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorMsg = message.includes("abort")
      ? `Request timed out: ${method} ${url}`
      : `fetch failed (${method} ${url}): ${message}`;
    console.error(`[wexa-service] ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/** Make an authenticated request to the Identity-Service API. */
export async function makeIdentityServiceRequest(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    config: WexaServiceConfig;
  },
): Promise<ApiResult> {
  const { method = "GET", body, config } = options;

  const url = `${config.identityServiceUrl}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.identityServiceServerKey) {
    headers["x-server-key"] = config.identityServiceServerKey;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs ?? 30000);

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }

    if (!response.ok) {
      const errorMsg =
        typeof data === "object" && data && "error" in data
          ? String((data as { error: unknown }).error)
          : `HTTP ${response.status}: ${responseText.slice(0, 200)}`;
      console.error(`[wexa-service] Request failed: ${method} ${url} - ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
        status: response.status,
      };
    }

    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorMsg = message.includes("abort")
      ? `Request timed out: ${method} ${url}`
      : `fetch failed (${method} ${url}): ${message}`;
    console.error(`[wexa-service] ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

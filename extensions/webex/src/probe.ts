import type { WebexProbeResult } from "./types.js";

/**
 * Test connectivity to the Webex API using a bot token
 * 
 * This function verifies that:
 * 1. The bot token is valid
 * 2. The Webex API is reachable
 * 3. The bot has the necessary permissions
 * 
 * @param token - Webex bot access token
 * @param timeoutMs - Request timeout in milliseconds (default: 5000)
 * @returns Promise resolving to probe result
 */
export async function probeWebex(
  token: string,
  timeoutMs = 5000,
): Promise<WebexProbeResult> {
  if (!token?.trim()) {
    return {
      ok: false,
      error: "Bot token is required",
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch("https://webexapis.com/v1/people/me", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        statusCode: response.status,
      };
    }
    
    const bot = await response.json();
    
    return {
      ok: true,
      bot,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return {
          ok: false,
          error: `Request timeout after ${timeoutMs}ms`,
        };
      }
      return {
        ok: false,
        error: error.message,
      };
    }
    return {
      ok: false,
      error: String(error),
    };
  }
}
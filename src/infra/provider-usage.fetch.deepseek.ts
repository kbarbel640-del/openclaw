import type { ProviderUsageSnapshot } from "./provider-usage.types.js";

export async function fetchDeepSeekUsage(
  _token: string,
  _timeoutMs: number,
  _fetchFn: typeof fetch,
): Promise<ProviderUsageSnapshot> {
  // DeepSeek API currently does not provide a standard usage/subscription endpoint
  // that matches the OpenAI format or similar.
  // We return a placeholder to satisfy the interface.
  return {
    provider: "deepseek",
    displayName: "DeepSeek",
    windows: [],
    // error: "Usage API not supported", // Optional: hide error if we don't want it to show up as failed
  };
}

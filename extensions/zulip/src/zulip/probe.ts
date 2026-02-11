import { zulipGetMe, type ZulipClient } from "./client.js";

type ZulipProbeResult = { ok: boolean; error?: string };

export async function probeZulip(
  client: ZulipClient,
  timeoutMs = 10_000,
): Promise<ZulipProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    // Use an authenticated endpoint to validate baseUrls + credentials.
    await zulipGetMe(client, { signal: controller.signal });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (controller.signal.aborted) {
      return { ok: false, error: `timeout after ${timeoutMs}ms` };
    }
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

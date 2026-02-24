import { describe, expect, it, vi } from "vitest";
import { fetchCodexUsage } from "./provider-usage.fetch.codex.js";

const makeResponse = (status: number, body: unknown): Response => {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  const headers = typeof body === "string" ? undefined : { "Content-Type": "application/json" };
  return new Response(payload, { status, headers });
};

describe("fetchCodexUsage", () => {
  it("labels a weekly secondary quota window as Week", async () => {
    const mockFetch = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(async () =>
      makeResponse(200, {
        rate_limit: {
          primary_window: {
            limit_window_seconds: 5 * 3600,
            used_percent: 40,
            reset_at: 1_700_000_000,
          },
          secondary_window: {
            limit_window_seconds: 7 * 24 * 3600,
            used_percent: 55,
            reset_at: 1_700_500_000,
          },
        },
        plan_type: "Plus",
      }),
    );

    const snapshot = await fetchCodexUsage("token", undefined, 5000, mockFetch);

    expect(snapshot.provider).toBe("openai-codex");
    expect(snapshot.windows).toHaveLength(2);
    expect(snapshot.windows[0]?.label).toBe("5h");
    expect(snapshot.windows[1]?.label).toBe("Week");
    expect(snapshot.windows[1]?.usedPercent).toBe(55);
  });
});

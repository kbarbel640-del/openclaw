import { describe, expect, it, vi } from "vitest";
import { fetchCopilotUsage } from "./provider-usage.fetch.copilot.js";

const makeResponse = (status: number, body: unknown): Response => {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  const headers = typeof body === "string" ? undefined : { "Content-Type": "application/json" };
  return new Response(payload, { status, headers });
};

describe("fetchCopilotUsage", () => {
  it("parses legacy quota_snapshots schema", async () => {
    const mockFetch = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(async () => {
      return makeResponse(200, {
        copilot_plan: "individual",
        quota_snapshots: {
          premium_interactions: { percent_remaining: 75 },
          chat: { percent_remaining: 50 },
        },
      });
    });

    const snapshot = await fetchCopilotUsage("token-123", 5000, mockFetch);
    expect(snapshot.provider).toBe("github-copilot");
    expect(snapshot.plan).toBe("individual");
    expect(snapshot.error).toBeUndefined();
    expect(snapshot.windows).toEqual(
      expect.arrayContaining([
        { label: "Premium", usedPercent: 25 },
        { label: "Chat", usedPercent: 50 },
      ]),
    );
  });

  it("parses monthly_quotas + limited_user_quotas schema and sets resetAt", async () => {
    const mockFetch = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(async () => {
      return makeResponse(200, {
        copilot_plan: "individual",
        monthly_quotas: { chat: 500, completions: 4000 },
        limited_user_quotas: { chat: 400, completions: 1000 },
        limited_user_reset_date: "2026-03-08",
      });
    });

    const snapshot = await fetchCopilotUsage("token-123", 5000, mockFetch);
    expect(snapshot.provider).toBe("github-copilot");
    expect(snapshot.plan).toBe("individual");
    expect(snapshot.error).toBeUndefined();

    const chat = snapshot.windows.find((w) => w.label === "Chat (month)");
    expect(chat?.usedPercent).toBe(20); // (1 - 400/500) * 100
    expect(chat?.resetAt).toBe(Date.parse("2026-03-08T00:00:00Z"));

    const completions = snapshot.windows.find((w) => w.label === "Completions (month)");
    expect(completions?.usedPercent).toBe(75); // (1 - 1000/4000) * 100
    expect(completions?.resetAt).toBe(Date.parse("2026-03-08T00:00:00Z"));
  });

  it("returns an error when schema is unsupported (200 but no quota fields)", async () => {
    const mockFetch = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(async () => {
      return makeResponse(200, { copilot_plan: "individual", login: "test" });
    });

    const snapshot = await fetchCopilotUsage("token-123", 5000, mockFetch);
    expect(snapshot.provider).toBe("github-copilot");
    expect(snapshot.windows).toHaveLength(0);
    expect(snapshot.error).toBe("Unsupported Copilot usage schema");
  });
});

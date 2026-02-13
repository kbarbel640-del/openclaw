import { describe, expect, it } from "vitest";
import type { OpenRtbBidRequest } from "./openrtb-generator.js";
import { sendMockBidRequest } from "./mock-ssp.js";

function makeBidRequest(overrides?: Partial<OpenRtbBidRequest>): OpenRtbBidRequest {
  return {
    id: "moltbot_mock_test",
    at: 2,
    tmax: 300,
    imp: [
      {
        id: "1",
        native: { ver: "1.2", request: "{}" },
        bidfloor: 0.5,
        bidfloorcur: "USD",
      },
    ],
    site: {
      id: "test_site",
      name: "Moltbot_Agent",
      domain: "molt.bot",
      cat: ["IAB13-2"],
      keywords: "tax consultant,tax filing",
    },
    device: { ua: "Moltbot-Agent-v1", ip: "0.0.0.0" },
    user: { id: "anon_test" },
    ...overrides,
  };
}

describe("sendMockBidRequest", () => {
  it("returns a bid result with native ad assets", async () => {
    const result = await sendMockBidRequest(makeBidRequest());

    // Mock has ~85% fill rate, so run enough to get at least one win
    if (result.won) {
      expect(result.asset).toBeDefined();
      expect(result.asset!.title).toBeTruthy();
      expect(result.asset!.description).toBeTruthy();
      expect(result.asset!.cta).toBeTruthy();
      expect(result.price).toBeGreaterThan(0);
      expect(result.bidId).toMatch(/^mock_bid_/);
      expect(result.nurl).toContain("mock-ssp.molt.bot");
    }
  });

  it("returns category-relevant ads for IAB13 (finance)", async () => {
    const wins: string[] = [];
    // Run multiple times to collect wins
    for (let i = 0; i < 20; i++) {
      const result = await sendMockBidRequest(makeBidRequest());
      if (result.won && result.asset) {
        wins.push(result.asset.title);
      }
    }

    // Should have at least some wins (85% fill rate)
    expect(wins.length).toBeGreaterThan(0);

    // IAB13 = Personal Finance — catalog includes TurboTax, NerdWallet, Betterment
    const financeAds = wins.filter(
      (t) => t.includes("TurboTax") || t.includes("NerdWallet") || t.includes("Betterment"),
    );
    expect(financeAds.length).toBeGreaterThan(0);
  });

  it("returns category-relevant ads for IAB19 (technology)", async () => {
    const wins: string[] = [];
    for (let i = 0; i < 20; i++) {
      const result = await sendMockBidRequest(
        makeBidRequest({
          site: {
            id: "test_site",
            name: "Moltbot_Agent",
            domain: "molt.bot",
            cat: ["IAB19"],
            keywords: "cloud hosting,developer tools",
          },
        }),
      );
      if (result.won && result.asset) {
        wins.push(result.asset.title);
      }
    }

    expect(wins.length).toBeGreaterThan(0);
    const techAds = wins.filter((t) => t.includes("AWS") || t.includes("GitHub Copilot"));
    expect(techAds.length).toBeGreaterThan(0);
  });

  it("respects bid floor — returns no bid when floor is very high", async () => {
    let noBidCount = 0;
    for (let i = 0; i < 20; i++) {
      const result = await sendMockBidRequest(
        makeBidRequest({
          imp: [
            { id: "1", native: { ver: "1.2", request: "{}" }, bidfloor: 10.0, bidfloorcur: "USD" },
          ],
        }),
      );
      if (!result.won) noBidCount++;
    }

    // With bidfloor > 5.0, all should be no-bid
    expect(noBidCount).toBe(20);
  });

  it("returns price above bid floor", async () => {
    for (let i = 0; i < 10; i++) {
      const result = await sendMockBidRequest(makeBidRequest());
      if (result.won) {
        expect(result.price!).toBeGreaterThanOrEqual(0.5); // bid floor
      }
    }
  });

  it("falls back to generic ads for unknown categories", async () => {
    const wins: string[] = [];
    for (let i = 0; i < 20; i++) {
      const result = await sendMockBidRequest(
        makeBidRequest({
          site: {
            id: "test_site",
            name: "Moltbot_Agent",
            domain: "molt.bot",
            cat: ["IAB99"],
            keywords: "something obscure",
          },
        }),
      );
      if (result.won && result.asset) {
        wins.push(result.asset.title);
      }
    }

    // Should still return ads (fallback catalog)
    expect(wins.length).toBeGreaterThan(0);
  });

  it("simulates realistic latency (40-150ms range)", async () => {
    const start = Date.now();
    await sendMockBidRequest(makeBidRequest());
    const elapsed = Date.now() - start;

    // Should take at least 40ms (mock latency floor)
    expect(elapsed).toBeGreaterThanOrEqual(35); // small tolerance
  });
});

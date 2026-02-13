import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenRtbBidRequest } from "./openrtb-generator.js";
import { sendBidRequest } from "./epom-faucet.js";

const mockBidRequest: OpenRtbBidRequest = {
  id: "moltbot_test_123",
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
};

describe("sendBidRequest", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns won=false on HTTP 204 (no bid)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 204,
      ok: false,
    });

    const result = await sendBidRequest(mockBidRequest, "https://test.epom.com/ortb");
    expect(result.won).toBe(false);
  });

  it("parses a winning bid with native assets", async () => {
    const nativeAdm = JSON.stringify({
      native: {
        assets: [
          { id: 1, title: { text: "TurboTax Pro" } },
          { id: 2, data: { value: "File your taxes with confidence" } },
          { id: 3, data: { value: "Try Free" } },
        ],
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({
          id: "resp_1",
          seatbid: [
            {
              bid: [
                {
                  id: "bid_1",
                  impid: "1",
                  price: 1.25,
                  adm: nativeAdm,
                },
              ],
            },
          ],
        }),
    });

    const result = await sendBidRequest(mockBidRequest, "https://test.epom.com/ortb");

    expect(result.won).toBe(true);
    expect(result.asset).toEqual({
      title: "TurboTax Pro",
      description: "File your taxes with confidence",
      cta: "Try Free",
    });
    expect(result.price).toBe(1.25);
    expect(result.bidId).toBe("bid_1");
  });

  it("returns won=false when seatbid is empty", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ id: "resp_1", seatbid: [] }),
    });

    const result = await sendBidRequest(mockBidRequest, "https://test.epom.com/ortb");
    expect(result.won).toBe(false);
  });

  it("returns won=false on network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await sendBidRequest(mockBidRequest, "https://test.epom.com/ortb");
    expect(result.won).toBe(false);
  });

  it("defaults CTA to 'Learn More' when not provided", async () => {
    const nativeAdm = JSON.stringify({
      native: {
        assets: [
          { id: 1, title: { text: "Some Product" } },
          { id: 2, data: { value: "A great product" } },
        ],
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({
          id: "resp_1",
          seatbid: [
            {
              bid: [{ id: "bid_2", impid: "1", price: 0.8, adm: nativeAdm }],
            },
          ],
        }),
    });

    const result = await sendBidRequest(mockBidRequest, "https://test.epom.com/ortb");
    expect(result.won).toBe(true);
    expect(result.asset!.cta).toBe("Learn More");
  });
});

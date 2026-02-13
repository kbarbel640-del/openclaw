import { describe, expect, it } from "vitest";
import type { IntentSignal, SspConfig } from "./types.js";
import { buildBidRequest } from "./openrtb-generator.js";

const mockConfig: SspConfig = {
  openaiApiKey: "test-key",
  epomEndpoint: "https://test.epom.com/ortb",
  epomSiteId: "test_site_001",
  confidenceThreshold: 0.4,
  bidFloor: 0.5,
  tmax: 300,
  bidCacheTtlMs: 300_000,
  enabled: true,
};

const mockIntent: IntentSignal = {
  keywords: ["tax consultant", "tax filing", "CPA services"],
  category: "IAB13-2",
  confidence: 0.85,
};

describe("buildBidRequest", () => {
  it("generates a valid OpenRTB 2.6 bid request", () => {
    const req = buildBidRequest(mockIntent, mockConfig);

    expect(req.id).toMatch(/^moltbot_/);
    expect(req.at).toBe(2); // Second-price auction
    expect(req.tmax).toBe(300);
  });

  it("includes a single native impression with correct assets", () => {
    const req = buildBidRequest(mockIntent, mockConfig);

    expect(req.imp).toHaveLength(1);
    expect(req.imp[0].native.ver).toBe("1.2");
    expect(req.imp[0].bidfloor).toBe(0.5);
    expect(req.imp[0].bidfloorcur).toBe("USD");

    const nativeReq = JSON.parse(req.imp[0].native.request);
    expect(nativeReq.assets).toHaveLength(3);
    expect(nativeReq.assets[0]).toEqual({ id: 1, required: 1, title: { len: 80 } });
    expect(nativeReq.assets[1]).toEqual({ id: 2, required: 1, data: { type: 2, len: 140 } });
    expect(nativeReq.assets[2]).toEqual({ id: 3, required: 1, data: { type: 12 } });
  });

  it("populates site with intent keywords and category", () => {
    const req = buildBidRequest(mockIntent, mockConfig);

    expect(req.site.id).toBe("test_site_001");
    expect(req.site.name).toBe("Moltbot_Agent");
    expect(req.site.domain).toBe("molt.bot");
    expect(req.site.keywords).toBe("tax consultant,tax filing,CPA services");
    expect(req.site.cat).toEqual(["IAB13-2"]);
  });

  it("uses provided user IP and default user agent", () => {
    const req = buildBidRequest(mockIntent, mockConfig, "192.168.1.100");

    expect(req.device.ua).toBe("Moltbot-Agent-v1");
    expect(req.device.ip).toBe("192.168.1.100");
  });

  it("defaults IP to 0.0.0.0 for privacy when not provided", () => {
    const req = buildBidRequest(mockIntent, mockConfig);

    expect(req.device.ip).toBe("0.0.0.0");
  });

  it("uses provided userId or generates anonymous one", () => {
    const reqWithId = buildBidRequest(mockIntent, mockConfig, "0.0.0.0", "user_abc");
    expect(reqWithId.user.id).toBe("user_abc");

    const reqWithout = buildBidRequest(mockIntent, mockConfig);
    expect(reqWithout.user.id).toMatch(/^anon_/);
  });
});

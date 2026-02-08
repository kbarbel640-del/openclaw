import { describe, expect, it } from "vitest";
import { checkBrowserOrigin } from "./origin-check.js";

describe("checkBrowserOrigin", () => {
  it("accepts same-origin host matches", () => {
    const result = checkBrowserOrigin({
      requestHost: "127.0.0.1:18789",
      origin: "http://127.0.0.1:18789",
    });
    expect(result.ok).toBe(true);
  });

  it("accepts loopback host mismatches for dev", () => {
    const result = checkBrowserOrigin({
      requestHost: "127.0.0.1:18789",
      origin: "http://localhost:5173",
    });
    expect(result.ok).toBe(true);
  });

  it("accepts allowlisted origins", () => {
    const result = checkBrowserOrigin({
      requestHost: "gateway.example.com:18789",
      origin: "https://control.example.com",
      allowedOrigins: ["https://control.example.com"],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects missing origin", () => {
    const result = checkBrowserOrigin({
      requestHost: "gateway.example.com:18789",
      origin: "",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects mismatched origins", () => {
    const result = checkBrowserOrigin({
      requestHost: "gateway.example.com:18789",
      origin: "https://attacker.example.com",
    });
    expect(result.ok).toBe(false);
  });

  describe("DNS rebinding protection", () => {
    it("rejects attacker domain in Host header resolving to loopback", () => {
      // DNS rebinding: evil.com DNS → 127.0.0.1, browser sends Host: evil.com
      const result = checkBrowserOrigin({
        requestHost: "evil.com:18789",
        origin: "http://evil.com:18789",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain("DNS rebinding");
      }
    });

    it("rejects subdomain rebinding attack", () => {
      // Attacker uses a subdomain that resolves to 127.0.0.1
      const result = checkBrowserOrigin({
        requestHost: "localhost.attacker.com:18789",
        origin: "http://localhost.attacker.com:18789",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain("DNS rebinding");
      }
    });

    it("rejects rebinding even when origin and host match", () => {
      // Both Origin and Host are the attacker's domain — same-origin check
      // would pass without Host validation
      const result = checkBrowserOrigin({
        requestHost: "rebind.attacker.io:18789",
        origin: "http://rebind.attacker.io:18789",
      });
      expect(result.ok).toBe(false);
    });

    it("accepts non-loopback host when explicitly allowed", () => {
      const result = checkBrowserOrigin({
        requestHost: "gateway.internal.lan:18789",
        origin: "http://gateway.internal.lan:18789",
        allowedHosts: ["gateway.internal.lan"],
      });
      expect(result.ok).toBe(true);
    });

    it("accepts localhost Host header (not a rebinding attack)", () => {
      const result = checkBrowserOrigin({
        requestHost: "localhost:18789",
        origin: "http://localhost:18789",
      });
      expect(result.ok).toBe(true);
    });

    it("accepts ::1 Host header", () => {
      const result = checkBrowserOrigin({
        requestHost: "[::1]:18789",
        origin: "http://[::1]:18789",
      });
      expect(result.ok).toBe(true);
    });
  });
});

import { describe, expect, it } from "vitest";

import { AuthRateLimiter, authorizeGatewayConnect } from "./auth.js";
import { isAllowedWsOrigin } from "./server-http.js";

describe("gateway auth", () => {
  it("does not throw when req is missing socket", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: false },
      connectAuth: { token: "secret" },
      // Regression: avoid crashing on req.socket.remoteAddress when callers pass a non-IncomingMessage.
      req: {} as never,
    });
    expect(res.ok).toBe(true);
  });

  it("reports missing and mismatched token reasons", async () => {
    const missing = await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: false },
      connectAuth: null,
    });
    expect(missing.ok).toBe(false);
    expect(missing.reason).toBe("token_missing");

    const mismatch = await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: false },
      connectAuth: { token: "wrong" },
    });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.reason).toBe("token_mismatch");
  });

  it("reports missing token config reason", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", allowTailscale: false },
      connectAuth: { token: "anything" },
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("token_missing_config");
  });

  it("reports missing and mismatched password reasons", async () => {
    const missing = await authorizeGatewayConnect({
      auth: { mode: "password", password: "secret", allowTailscale: false },
      connectAuth: null,
    });
    expect(missing.ok).toBe(false);
    expect(missing.reason).toBe("password_missing");

    const mismatch = await authorizeGatewayConnect({
      auth: { mode: "password", password: "secret", allowTailscale: false },
      connectAuth: { password: "wrong" },
    });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.reason).toBe("password_mismatch");
  });

  it("reports missing password config reason", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "password", allowTailscale: false },
      connectAuth: { password: "secret" },
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("password_missing_config");
  });

  it("treats local tailscale serve hostnames as direct", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: true },
      connectAuth: { token: "secret" },
      req: {
        socket: { remoteAddress: "127.0.0.1" },
        headers: { host: "gateway.tailnet-1234.ts.net:443" },
      } as never,
    });

    expect(res.ok).toBe(true);
    expect(res.method).toBe("token");
  });

  it("allows tailscale identity to satisfy token mode auth", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: true },
      connectAuth: null,
      tailscaleWhois: async () => ({ login: "peter", name: "Peter" }),
      req: {
        socket: { remoteAddress: "127.0.0.1" },
        headers: {
          host: "gateway.local",
          "x-forwarded-for": "100.64.0.1",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "ai-hub.bone-egret.ts.net",
          "tailscale-user-login": "peter",
          "tailscale-user-name": "Peter",
        },
      } as never,
    });

    expect(res.ok).toBe(true);
    expect(res.method).toBe("tailscale");
    expect(res.user).toBe("peter");
  });
});

describe("AuthRateLimiter", () => {
  it("allows first attempt", () => {
    const limiter = new AuthRateLimiter();
    expect(limiter.check("1.2.3.4").allowed).toBe(true);
  });

  it("allows attempts below threshold", () => {
    const limiter = new AuthRateLimiter({ maxFailures: 5 });
    for (let i = 0; i < 4; i++) {
      limiter.recordFailure("1.2.3.4");
    }
    expect(limiter.check("1.2.3.4").allowed).toBe(true);
  });

  it("blocks after reaching maxFailures", () => {
    const limiter = new AuthRateLimiter({ maxFailures: 3, baseDelayMs: 1000 });
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      limiter.recordFailure("1.2.3.4", now);
    }
    const result = limiter.check("1.2.3.4", now + 100);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("unblocks after delay expires", () => {
    const limiter = new AuthRateLimiter({ maxFailures: 3, baseDelayMs: 1000, maxDelayMs: 2000 });
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      limiter.recordFailure("1.2.3.4", now);
    }
    // After baseDelayMs (1000ms) should be allowed again
    const result = limiter.check("1.2.3.4", now + 1001);
    expect(result.allowed).toBe(true);
  });

  it("resets on success", () => {
    const limiter = new AuthRateLimiter({ maxFailures: 3 });
    for (let i = 0; i < 5; i++) {
      limiter.recordFailure("1.2.3.4");
    }
    limiter.recordSuccess("1.2.3.4");
    expect(limiter.check("1.2.3.4").allowed).toBe(true);
    expect(limiter.size).toBe(0);
  });

  it("expires entries after window", () => {
    const limiter = new AuthRateLimiter({ maxFailures: 3, windowMs: 5000 });
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      limiter.recordFailure("1.2.3.4", now);
    }
    // After window expires
    const result = limiter.check("1.2.3.4", now + 6000);
    expect(result.allowed).toBe(true);
  });

  it("tracks IPs independently", () => {
    const limiter = new AuthRateLimiter({ maxFailures: 2, baseDelayMs: 1000 });
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      limiter.recordFailure("1.1.1.1", now);
    }
    expect(limiter.check("1.1.1.1", now + 100).allowed).toBe(false);
    expect(limiter.check("2.2.2.2", now + 100).allowed).toBe(true);
  });

  it("applies exponential backoff on repeated failures", () => {
    const limiter = new AuthRateLimiter({ maxFailures: 2, baseDelayMs: 1000, maxDelayMs: 8000 });
    const now = Date.now();
    // 2 failures -> blocked with 1s delay (base * 2^0)
    for (let i = 0; i < 2; i++) limiter.recordFailure("1.2.3.4", now);
    const r1 = limiter.check("1.2.3.4", now + 1);
    expect(r1.allowed).toBe(false);
    expect(r1.retryAfterMs).toBeLessThanOrEqual(1000);

    // 3rd failure -> 2s delay (base * 2^1)
    limiter.recordFailure("1.2.3.4", now + 1001);
    const r2 = limiter.check("1.2.3.4", now + 1002);
    expect(r2.allowed).toBe(false);
    expect(r2.retryAfterMs).toBeLessThanOrEqual(2000);

    // 4th failure -> 4s delay (base * 2^2)
    limiter.recordFailure("1.2.3.4", now + 3003);
    const r3 = limiter.check("1.2.3.4", now + 3004);
    expect(r3.allowed).toBe(false);
    expect(r3.retryAfterMs).toBeLessThanOrEqual(4000);
  });

  it("caps delay at maxDelayMs", () => {
    const limiter = new AuthRateLimiter({ maxFailures: 1, baseDelayMs: 1000, maxDelayMs: 2000 });
    const now = Date.now();
    for (let i = 0; i < 10; i++) limiter.recordFailure("1.2.3.4", now);
    const result = limiter.check("1.2.3.4", now + 1);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeLessThanOrEqual(2000);
  });

  it("prunes expired entries", () => {
    const limiter = new AuthRateLimiter({ windowMs: 1000 });
    const now = Date.now();
    limiter.recordFailure("1.1.1.1", now);
    limiter.recordFailure("2.2.2.2", now);
    expect(limiter.size).toBe(2);
    limiter.prune(now + 2000);
    expect(limiter.size).toBe(0);
  });
});

describe("isAllowedWsOrigin (DNS rebinding defense)", () => {
  it("allows requests with no Origin header (non-browser)", () => {
    expect(isAllowedWsOrigin(undefined)).toBe(true);
  });

  it("allows localhost origin", () => {
    expect(isAllowedWsOrigin("http://localhost:3000")).toBe(true);
  });

  it("allows 127.0.0.1 origin", () => {
    expect(isAllowedWsOrigin("http://127.0.0.1:8080")).toBe(true);
  });

  it("allows ::1 origin", () => {
    expect(isAllowedWsOrigin("http://[::1]:8080")).toBe(true);
  });

  it("allows *.ts.net (Tailscale) origin", () => {
    expect(isAllowedWsOrigin("https://myhost.tail1234.ts.net")).toBe(true);
  });

  it("rejects unknown external origin", () => {
    expect(isAllowedWsOrigin("https://evil.com")).toBe(false);
  });

  it("rejects DNS rebinding origin", () => {
    expect(isAllowedWsOrigin("http://rebind.attacker.com")).toBe(false);
  });

  it("supports custom allowedHosts", () => {
    const custom = new Set(["myapp.local"]);
    expect(isAllowedWsOrigin("http://myapp.local:3000", custom)).toBe(true);
    expect(isAllowedWsOrigin("http://localhost:3000", custom)).toBe(false);
  });
});

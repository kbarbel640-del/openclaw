import { describe, expect, it } from "vitest";
import { resolveGatewayAuthRateLimitConfig } from "./auth-rate-limit-config.js";
import type { ResolvedGatewayAuth } from "./auth.js";

describe("resolveGatewayAuthRateLimitConfig", () => {
  it("enables defaults for token auth when token is configured", () => {
    const auth: ResolvedGatewayAuth = {
      mode: "token",
      token: "secret",
      password: undefined,
      allowTailscale: false,
    };

    const out = resolveGatewayAuthRateLimitConfig({ auth });
    expect(out).toEqual({
      maxAttempts: undefined,
      windowMs: undefined,
      lockoutMs: undefined,
      exemptLoopback: undefined,
    });
  });

  it("enables defaults for password auth when password is configured", () => {
    const auth: ResolvedGatewayAuth = {
      mode: "password",
      token: undefined,
      password: "secret",
      allowTailscale: false,
    };

    const out = resolveGatewayAuthRateLimitConfig({ auth });
    expect(out).toEqual({
      maxAttempts: undefined,
      windowMs: undefined,
      lockoutMs: undefined,
      exemptLoopback: undefined,
    });
  });

  it("returns undefined when shared secret auth is not configured", () => {
    const auth: ResolvedGatewayAuth = {
      mode: "token",
      token: undefined,
      password: undefined,
      allowTailscale: true,
    };

    const out = resolveGatewayAuthRateLimitConfig({ auth });
    expect(out).toBeUndefined();
  });

  it("preserves explicit gateway.auth.rateLimit values", () => {
    const auth: ResolvedGatewayAuth = {
      mode: "token",
      token: "secret",
      password: undefined,
      allowTailscale: false,
    };

    const out = resolveGatewayAuthRateLimitConfig({
      auth,
      config: {
        maxAttempts: 3,
        windowMs: 15_000,
        lockoutMs: 120_000,
        exemptLoopback: false,
      },
    });

    expect(out).toEqual({
      maxAttempts: 3,
      windowMs: 15_000,
      lockoutMs: 120_000,
      exemptLoopback: false,
    });
  });
});

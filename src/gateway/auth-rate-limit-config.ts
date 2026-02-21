import type { GatewayAuthRateLimitConfig } from "../config/types.gateway.js";
import type { RateLimitConfig } from "./auth-rate-limit.js";
import type { ResolvedGatewayAuth } from "./auth.js";

/**
 * Resolve gateway auth rate-limit settings.
 *
 * Security default: whenever shared-secret gateway auth is configured
 * (token/password), rate limiting is enabled even when gateway.auth.rateLimit
 * is omitted. In that case createAuthRateLimiter() applies safe defaults.
 */
export function resolveGatewayAuthRateLimitConfig(params: {
  auth: ResolvedGatewayAuth;
  config?: GatewayAuthRateLimitConfig;
}): RateLimitConfig | undefined {
  const { auth, config } = params;

  const hasSharedSecretAuth =
    (auth.mode === "token" && Boolean(auth.token)) ||
    (auth.mode === "password" && Boolean(auth.password));

  if (!hasSharedSecretAuth) {
    return undefined;
  }

  return {
    maxAttempts: config?.maxAttempts,
    windowMs: config?.windowMs,
    lockoutMs: config?.lockoutMs,
    exemptLoopback: config?.exemptLoopback,
  };
}

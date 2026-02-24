import { createRemoteJWKSet, jwtVerify } from "jose";
import type { SupabaseAuthConfig } from "../config/types.gateway.js";
import type { SupabaseUser } from "./auth.js";

export type SupabaseAuthResult = { ok: true; user: SupabaseUser } | { ok: false; reason: string };

// Cache JWKS keySets per URL to avoid re-fetching on every request.
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwksKeySet(url: string): ReturnType<typeof createRemoteJWKSet> {
  const cached = jwksCache.get(url);
  if (cached) {
    return cached;
  }
  const jwksUrl = new URL("/.well-known/jwks.json", url);
  const keySet = createRemoteJWKSet(jwksUrl);
  jwksCache.set(url, keySet);
  return keySet;
}

/**
 * Verify a Supabase JWT and extract user info.
 * Supports HS256 (with jwtSecret) or RS256 (via JWKS at {url}/.well-known/jwks.json).
 */
export async function verifySupabaseJwt(params: {
  jwt: string;
  config: SupabaseAuthConfig;
}): Promise<SupabaseAuthResult> {
  const { jwt, config } = params;

  try {
    const verifyOptions = {
      audience: "authenticated",
    };

    let payload: Record<string, unknown>;

    if (config.jwtSecret) {
      const secret = new TextEncoder().encode(config.jwtSecret);
      const result = await jwtVerify(jwt, secret, verifyOptions);
      payload = result.payload as Record<string, unknown>;
    } else {
      const keySet = getJwksKeySet(config.url);
      const result = await jwtVerify(jwt, keySet, verifyOptions);
      payload = result.payload as Record<string, unknown>;
    }

    // Extract user fields from claims
    const sub = typeof payload.sub === "string" ? payload.sub : undefined;
    if (!sub) {
      return { ok: false, reason: "jwt_missing_sub" };
    }

    const email = typeof payload.email === "string" ? payload.email : undefined;
    if (!email) {
      return { ok: false, reason: "jwt_missing_email" };
    }

    // Check allowed domains
    if (config.allowedDomains && config.allowedDomains.length > 0) {
      const domain = email.split("@")[1]?.toLowerCase();
      const allowed = config.allowedDomains.some((d) => d.toLowerCase() === domain);
      if (!allowed) {
        return { ok: false, reason: "email_domain_not_allowed" };
      }
    }

    const role = typeof payload.role === "string" ? payload.role : undefined;

    return {
      ok: true,
      user: { id: sub, email, role },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("exp")) {
      return { ok: false, reason: "jwt_expired" };
    }
    if (message.includes("audience")) {
      return { ok: false, reason: "jwt_invalid_audience" };
    }
    return { ok: false, reason: `jwt_verification_failed: ${message}` };
  }
}

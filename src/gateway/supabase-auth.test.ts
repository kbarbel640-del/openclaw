import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import type { SupabaseAuthConfig } from "../config/types.gateway.js";
import { verifySupabaseJwt } from "./supabase-auth.js";

const TEST_JWT_SECRET = "super-secret-jwt-token-for-testing-only-1234567890";

function makeConfig(overrides?: Partial<SupabaseAuthConfig>): SupabaseAuthConfig {
  return {
    url: "https://test.supabase.co",
    anonKey: "anon-key",
    jwtSecret: TEST_JWT_SECRET,
    ...overrides,
  };
}

async function signJwt(
  claims: Record<string, unknown>,
  secret = TEST_JWT_SECRET,
  expiresIn = "1h",
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  let builder = new SignJWT(claims).setProtectedHeader({ alg: "HS256" });
  if (expiresIn) {
    builder = builder.setExpirationTime(expiresIn);
  }
  return builder.sign(key);
}

describe("verifySupabaseJwt", () => {
  it("should verify a valid JWT and extract user info", async () => {
    const jwt = await signJwt({
      sub: "user-123",
      email: "test@example.com",
      role: "authenticated",
      aud: "authenticated",
    });

    const result = await verifySupabaseJwt({ jwt, config: makeConfig() });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.id).toBe("user-123");
      expect(result.user.email).toBe("test@example.com");
      expect(result.user.role).toBe("authenticated");
    }
  });

  it("should reject an expired JWT", async () => {
    const jwt = await signJwt(
      {
        sub: "user-123",
        email: "test@example.com",
        aud: "authenticated",
      },
      TEST_JWT_SECRET,
      "-1h", // already expired
    );

    const result = await verifySupabaseJwt({ jwt, config: makeConfig() });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("jwt_");
    }
  });

  it("should reject a JWT with wrong audience", async () => {
    const jwt = await signJwt({
      sub: "user-123",
      email: "test@example.com",
      aud: "wrong-audience",
    });

    const result = await verifySupabaseJwt({ jwt, config: makeConfig() });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("jwt_");
    }
  });

  it("should reject a JWT with missing sub claim", async () => {
    const jwt = await signJwt({
      email: "test@example.com",
      aud: "authenticated",
    });

    const result = await verifySupabaseJwt({ jwt, config: makeConfig() });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("jwt_missing_sub");
    }
  });

  it("should reject a JWT with missing email claim", async () => {
    const jwt = await signJwt({
      sub: "user-123",
      aud: "authenticated",
    });

    const result = await verifySupabaseJwt({ jwt, config: makeConfig() });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("jwt_missing_email");
    }
  });

  it("should reject a JWT signed with wrong secret", async () => {
    const jwt = await signJwt(
      {
        sub: "user-123",
        email: "test@example.com",
        aud: "authenticated",
      },
      "wrong-secret-key-1234567890123456",
    );

    const result = await verifySupabaseJwt({ jwt, config: makeConfig() });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("jwt_verification_failed");
    }
  });

  it("should allow emails from allowed domains", async () => {
    const jwt = await signJwt({
      sub: "user-123",
      email: "user@company.com",
      aud: "authenticated",
    });

    const result = await verifySupabaseJwt({
      jwt,
      config: makeConfig({ allowedDomains: ["company.com"] }),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.email).toBe("user@company.com");
    }
  });

  it("should reject emails from disallowed domains", async () => {
    const jwt = await signJwt({
      sub: "user-123",
      email: "user@other.com",
      aud: "authenticated",
    });

    const result = await verifySupabaseJwt({
      jwt,
      config: makeConfig({ allowedDomains: ["company.com"] }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("email_domain_not_allowed");
    }
  });

  it("should do case-insensitive domain matching", async () => {
    const jwt = await signJwt({
      sub: "user-123",
      email: "user@Company.COM",
      aud: "authenticated",
    });

    const result = await verifySupabaseJwt({
      jwt,
      config: makeConfig({ allowedDomains: ["company.com"] }),
    });

    expect(result.ok).toBe(true);
  });

  it("should skip domain check when allowedDomains is empty", async () => {
    const jwt = await signJwt({
      sub: "user-123",
      email: "user@any-domain.com",
      aud: "authenticated",
    });

    const result = await verifySupabaseJwt({
      jwt,
      config: makeConfig({ allowedDomains: [] }),
    });

    expect(result.ok).toBe(true);
  });

  it("should reject malformed JWT strings", async () => {
    const result = await verifySupabaseJwt({
      jwt: "not-a-jwt",
      config: makeConfig(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("jwt_verification_failed");
    }
  });
});

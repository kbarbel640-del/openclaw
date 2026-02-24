/**
 * Unit tests for IPC auth guards and config validation.
 *
 * These functions form the security boundary between the renderer and the
 * main process — every IPC handler that mutates state calls one of them.
 */

import { describe, it, expect, vi } from "vitest";
import {
  requireSession,
  requireElevatedSession,
  validateStackConfig,
} from "../src/main/ipc-guards.js";
import type { SessionManager } from "../src/main/auth/session-manager.js";
import type { AuthSession } from "../src/shared/ipc-types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    userId: "user-1",
    role: "admin",
    authenticatedAt: Date.now(),
    expiresAt: Date.now() + 3_600_000,
    elevated: false,
    ...overrides,
  };
}

function makeMockSessions(resolved: AuthSession | null = makeSession()): SessionManager {
  return { resolve: vi.fn().mockReturnValue(resolved) } as unknown as SessionManager;
}

// ─── requireSession() ─────────────────────────────────────────────────────────

describe("requireSession()", () => {
  it("passes for a valid token that resolves a session", () => {
    const sessions = makeMockSessions(makeSession());
    expect(() => requireSession("valid-token", sessions)).not.toThrow();
  });

  it("throws Unauthorized when token is not a string", () => {
    const sessions = makeMockSessions();
    expect(() => requireSession(null, sessions)).toThrow("Unauthorized");
    expect(() => requireSession(undefined, sessions)).toThrow("Unauthorized");
    expect(() => requireSession(42, sessions)).toThrow("Unauthorized");
    expect(() => requireSession({}, sessions)).toThrow("Unauthorized");
  });

  it("throws Unauthorized when session resolve returns null (expired/missing)", () => {
    const sessions = makeMockSessions(null);
    expect(() => requireSession("expired-token", sessions)).toThrow("Unauthorized");
  });

  it("calls sessions.resolve() with the token to refresh idle timeout", () => {
    // Use a standalone fn ref to avoid unbound-method lint rule
    const resolveFn = vi.fn().mockReturnValue(makeSession());
    const sessions = { resolve: resolveFn } as unknown as SessionManager;
    requireSession("tok-123", sessions);
    expect(resolveFn).toHaveBeenCalledWith("tok-123");
  });
});

// ─── requireElevatedSession() ─────────────────────────────────────────────────

describe("requireElevatedSession()", () => {
  it("passes for a valid elevated session", () => {
    const sessions = makeMockSessions(makeSession({ elevated: true }));
    expect(() => requireElevatedSession("tok", sessions)).not.toThrow();
  });

  it("throws Unauthorized when token is not a string", () => {
    const sessions = makeMockSessions();
    expect(() => requireElevatedSession(null, sessions)).toThrow("Unauthorized");
    expect(() => requireElevatedSession(undefined, sessions)).toThrow("Unauthorized");
    expect(() => requireElevatedSession(123, sessions)).toThrow("Unauthorized");
  });

  it("throws Unauthorized when session resolve returns null (missing/expired)", () => {
    const sessions = makeMockSessions(null);
    expect(() => requireElevatedSession("expired", sessions)).toThrow("Unauthorized");
  });

  it("throws Elevated session required when session is not elevated", () => {
    const sessions = makeMockSessions(makeSession({ elevated: false }));
    expect(() => requireElevatedSession("tok", sessions)).toThrow("Elevated session required");
  });

  it("elevation supersedes role — viewer-role elevated session is accepted", () => {
    const sessions = makeMockSessions(makeSession({ role: "viewer", elevated: true }));
    expect(() => requireElevatedSession("tok", sessions)).not.toThrow();
  });
});

// ─── validateStackConfig() ────────────────────────────────────────────────────

describe("validateStackConfig()", () => {
  const VALID = {
    configDir: "/home/user/.openclaw",
    workspaceDir: "/home/user/workspace",
    gatewayToken: "tok-abc123",
  };

  it("accepts a valid config and returns a StackConfig", () => {
    const result = validateStackConfig(VALID);
    expect(result.configDir).toBe("/home/user/.openclaw");
    expect(result.workspaceDir).toBe("/home/user/workspace");
    expect(result.gatewayToken).toBe("tok-abc123");
  });

  it("throws when raw is not an object", () => {
    expect(() => validateStackConfig(null)).toThrow("expected object");
    expect(() => validateStackConfig("string")).toThrow("expected object");
    expect(() => validateStackConfig(42)).toThrow("expected object");
  });

  it("throws when configDir is missing", () => {
    const { configDir: _, ...rest } = VALID;
    expect(() => validateStackConfig(rest)).toThrow("configDir");
  });

  it("throws when configDir is an empty string", () => {
    expect(() => validateStackConfig({ ...VALID, configDir: "" })).toThrow("configDir");
  });

  it("throws when configDir is a relative path", () => {
    expect(() => validateStackConfig({ ...VALID, configDir: "relative/path" })).toThrow(
      "absolute path",
    );
  });

  it("throws when configDir contains a null byte", () => {
    expect(() => validateStackConfig({ ...VALID, configDir: "/valid\0path" })).toThrow(
      "null bytes",
    );
  });

  it("throws when workspaceDir is a relative path", () => {
    expect(() => validateStackConfig({ ...VALID, workspaceDir: "./relative" })).toThrow(
      "absolute path",
    );
  });

  it("throws when workspaceDir contains a null byte", () => {
    expect(() => validateStackConfig({ ...VALID, workspaceDir: "/valid\0ws" })).toThrow(
      "null bytes",
    );
  });

  it("throws when gatewayToken is missing", () => {
    const { gatewayToken: _, ...rest } = VALID;
    expect(() => validateStackConfig(rest)).toThrow("gatewayToken");
  });

  it("throws when gatewayToken is an empty string", () => {
    expect(() => validateStackConfig({ ...VALID, gatewayToken: "" })).toThrow("gatewayToken");
  });

  it("throws when gatewayToken exceeds 512 chars", () => {
    expect(() =>
      validateStackConfig({ ...VALID, gatewayToken: "x".repeat(513) }),
    ).toThrow("gatewayToken is invalid");
  });

  it("accepts gatewayToken of exactly 512 chars (boundary)", () => {
    expect(() =>
      validateStackConfig({ ...VALID, gatewayToken: "x".repeat(512) }),
    ).not.toThrow();
  });

  it("throws when gatewayToken contains a null byte", () => {
    expect(() =>
      validateStackConfig({ ...VALID, gatewayToken: "tok\0bad" }),
    ).toThrow("gatewayToken is invalid");
  });

  it("normalizes paths via path.resolve (removes ./ and ../ segments)", () => {
    const result = validateStackConfig({
      ...VALID,
      configDir: "/foo/../home/.openclaw",
      workspaceDir: "/bar/../home/workspace",
    });
    expect(result.configDir).toBe("/home/.openclaw");
    expect(result.workspaceDir).toBe("/home/workspace");
  });

  it("includes optional gatewayPort and bridgePort when provided", () => {
    const result = validateStackConfig({ ...VALID, gatewayPort: 9000, bridgePort: 9001 });
    expect(result.gatewayPort).toBe(9000);
    expect(result.bridgePort).toBe(9001);
  });

  it("omits optional fields when not provided", () => {
    const result = validateStackConfig(VALID);
    expect(result.gatewayPort).toBeUndefined();
    expect(result.bridgePort).toBeUndefined();
    expect(result.image).toBeUndefined();
  });

  it("accepts a custom image string", () => {
    const result = validateStackConfig({ ...VALID, image: "openclaw:dev" });
    expect(result.image).toBe("openclaw:dev");
  });

  it("omits image when it is an empty string", () => {
    const result = validateStackConfig({ ...VALID, image: "" });
    expect(result.image).toBeUndefined();
  });
});

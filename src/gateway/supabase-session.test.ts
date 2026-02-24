import { describe, expect, it } from "vitest";
import {
  scopeSessionKeyToUser,
  isUserScopedSessionKey,
  extractUserIdFromSessionKey,
} from "./supabase-session.js";

describe("scopeSessionKeyToUser", () => {
  it("should scope a canonical agent session key", () => {
    const result = scopeSessionKeyToUser("agent:main:main", "user-abc-123");
    expect(result).toBe("agent:main:webchat:user:user-abc-123:main");
  });

  it("should scope a bare 'main' key", () => {
    const result = scopeSessionKeyToUser("main", "user-abc-123");
    expect(result).toBe("agent:main:webchat:user:user-abc-123:main");
  });

  it("should scope a custom session name", () => {
    const result = scopeSessionKeyToUser("agent:main:my-session", "user-456");
    expect(result).toBe("agent:main:webchat:user:user-456:my-session");
  });

  it("should scope a different agent id", () => {
    const result = scopeSessionKeyToUser("agent:finance:main", "user-789");
    expect(result).toBe("agent:finance:webchat:user:user-789:main");
  });

  it("should handle a bare custom key", () => {
    const result = scopeSessionKeyToUser("custom-session", "uid");
    expect(result).toBe("agent:main:webchat:user:uid:custom-session");
  });
});

describe("isUserScopedSessionKey", () => {
  it("should return true for user-scoped keys", () => {
    expect(isUserScopedSessionKey("agent:main:webchat:user:abc:main")).toBe(true);
  });

  it("should return false for unscoped keys", () => {
    expect(isUserScopedSessionKey("agent:main:main")).toBe(false);
    expect(isUserScopedSessionKey("main")).toBe(false);
  });
});

describe("extractUserIdFromSessionKey", () => {
  it("should extract userId from a scoped key", () => {
    expect(extractUserIdFromSessionKey("agent:main:webchat:user:user-abc-123:main")).toBe(
      "user-abc-123",
    );
  });

  it("should extract userId from a scoped key with different agent", () => {
    expect(extractUserIdFromSessionKey("agent:finance:webchat:user:xyz:session-1")).toBe("xyz");
  });

  it("should return null for unscoped keys", () => {
    expect(extractUserIdFromSessionKey("agent:main:main")).toBeNull();
    expect(extractUserIdFromSessionKey("main")).toBeNull();
  });

  it("should handle edge case of empty userId", () => {
    expect(extractUserIdFromSessionKey("agent:main:webchat:user::main")).toBeNull();
  });

  it("should round-trip with scopeSessionKeyToUser", () => {
    const userId = "test-user-id-456";
    const scoped = scopeSessionKeyToUser("agent:main:main", userId);
    const extracted = extractUserIdFromSessionKey(scoped);
    expect(extracted).toBe(userId);
  });

  it("should round-trip with various session keys", () => {
    const userId = "uuid-test";
    const keys = ["main", "agent:main:main", "agent:finance:my-chat", "custom-name"];
    for (const key of keys) {
      const scoped = scopeSessionKeyToUser(key, userId);
      expect(extractUserIdFromSessionKey(scoped)).toBe(userId);
      expect(isUserScopedSessionKey(scoped)).toBe(true);
    }
  });
});

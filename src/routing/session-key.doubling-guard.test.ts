/**
 * Unit tests for the buildAgentMainSessionKey defensive guard against
 * session key doubling (#27289, #27282).
 *
 * buildAgentMainSessionKey now checks whether mainKey is already a
 * fully-qualified agent session key and returns it as-is to prevent
 * producing malformed doubled keys like "agent:main:agent:main:main".
 */
import { describe, expect, it } from "vitest";
import { buildAgentMainSessionKey } from "./session-key.js";

describe("buildAgentMainSessionKey doubling guard (#27289)", () => {
  it("returns an already-qualified agent:main:main key unchanged", () => {
    const result = buildAgentMainSessionKey({
      agentId: "main",
      mainKey: "agent:main:main",
    });
    expect(result).toBe("agent:main:main");
  });

  it("returns an already-qualified agent:main:hook:uuid key unchanged", () => {
    const result = buildAgentMainSessionKey({
      agentId: "main",
      mainKey: "agent:main:hook:abc-123",
    });
    expect(result).toBe("agent:main:hook:abc-123");
  });

  it("returns an already-qualified agent:research:main key unchanged", () => {
    const result = buildAgentMainSessionKey({
      agentId: "main",
      mainKey: "agent:research:main",
    });
    expect(result).toBe("agent:research:main");
  });

  it("still wraps a bare main key correctly", () => {
    const result = buildAgentMainSessionKey({
      agentId: "main",
      mainKey: "main",
    });
    expect(result).toBe("agent:main:main");
  });

  it("still wraps a bare hook key correctly", () => {
    const result = buildAgentMainSessionKey({
      agentId: "main",
      mainKey: "hook:abc-123",
    });
    expect(result).toBe("agent:main:hook:abc-123");
  });

  it("still wraps a bare cron key correctly", () => {
    const result = buildAgentMainSessionKey({
      agentId: "main",
      mainKey: "cron:job-1",
    });
    expect(result).toBe("agent:main:cron:job-1");
  });

  it("uses default main key when mainKey is undefined", () => {
    const result = buildAgentMainSessionKey({
      agentId: "main",
    });
    expect(result).toBe("agent:main:main");
  });

  it("normalizes case for already-qualified keys", () => {
    const result = buildAgentMainSessionKey({
      agentId: "main",
      mainKey: "agent:Main:Main",
    });
    // normalizeMainKey lowercases, so parseAgentSessionKey should still match
    expect(result).toBe("agent:main:main");
  });
});

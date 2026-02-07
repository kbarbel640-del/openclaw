import { describe, expect, it } from "vitest";
import {
  isAcpSessionKey,
  isSubagentSessionKey,
  parseAgentSessionKey,
  resolveThreadParentSessionKey,
} from "./session-key-utils.js";

describe("parseAgentSessionKey", () => {
  it("parses a valid agent session key", () => {
    const result = parseAgentSessionKey("agent:mybot:main");
    expect(result).toEqual({ agentId: "mybot", rest: "main" });
  });

  it("preserves colons in the rest segment", () => {
    const result = parseAgentSessionKey("agent:mybot:telegram:12345");
    expect(result).toEqual({ agentId: "mybot", rest: "telegram:12345" });
  });

  it("returns null for undefined input", () => {
    expect(parseAgentSessionKey(undefined)).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseAgentSessionKey(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseAgentSessionKey("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(parseAgentSessionKey("   ")).toBeNull();
  });

  it("returns null when prefix is not 'agent'", () => {
    expect(parseAgentSessionKey("session:mybot:main")).toBeNull();
  });

  it("returns null when there are fewer than 3 parts", () => {
    expect(parseAgentSessionKey("agent:mybot")).toBeNull();
  });

  it("returns null for a single word", () => {
    expect(parseAgentSessionKey("agent")).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    const result = parseAgentSessionKey("  agent:mybot:main  ");
    expect(result).toEqual({ agentId: "mybot", rest: "main" });
  });
});

describe("isSubagentSessionKey", () => {
  it("returns true for bare subagent prefix", () => {
    expect(isSubagentSessionKey("subagent:task-123")).toBe(true);
  });

  it("returns true for agent-scoped subagent key", () => {
    expect(isSubagentSessionKey("agent:mybot:subagent:task-123")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isSubagentSessionKey("Subagent:task-123")).toBe(true);
    expect(isSubagentSessionKey("agent:mybot:SUBAGENT:task-123")).toBe(true);
  });

  it("returns false for a regular session key", () => {
    expect(isSubagentSessionKey("agent:mybot:main")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isSubagentSessionKey(undefined)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isSubagentSessionKey(null)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isSubagentSessionKey("")).toBe(false);
  });
});

describe("isAcpSessionKey", () => {
  it("returns true for bare acp prefix", () => {
    expect(isAcpSessionKey("acp:session-1")).toBe(true);
  });

  it("returns true for agent-scoped acp key", () => {
    expect(isAcpSessionKey("agent:mybot:acp:session-1")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isAcpSessionKey("ACP:session-1")).toBe(true);
    expect(isAcpSessionKey("agent:mybot:ACP:session-1")).toBe(true);
  });

  it("returns false for a regular session key", () => {
    expect(isAcpSessionKey("agent:mybot:main")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isAcpSessionKey(undefined)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isAcpSessionKey(null)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isAcpSessionKey("")).toBe(false);
  });
});

describe("resolveThreadParentSessionKey", () => {
  it("extracts parent from a :thread: session key", () => {
    expect(resolveThreadParentSessionKey("telegram:12345:thread:99")).toBe("telegram:12345");
  });

  it("extracts parent from a :topic: session key", () => {
    expect(resolveThreadParentSessionKey("telegram:12345:topic:99")).toBe("telegram:12345");
  });

  it("uses the last marker when multiple exist", () => {
    expect(resolveThreadParentSessionKey("a:thread:b:topic:c")).toBe("a:thread:b");
  });

  it("is case-insensitive for markers", () => {
    expect(resolveThreadParentSessionKey("telegram:12345:THREAD:99")).toBe("telegram:12345");
    expect(resolveThreadParentSessionKey("telegram:12345:Topic:99")).toBe("telegram:12345");
  });

  it("returns null when no thread/topic marker is found", () => {
    expect(resolveThreadParentSessionKey("telegram:12345")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(resolveThreadParentSessionKey(undefined)).toBeNull();
  });

  it("returns null for null", () => {
    expect(resolveThreadParentSessionKey(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(resolveThreadParentSessionKey("")).toBeNull();
  });

  it("returns null when marker is at position 0", () => {
    expect(resolveThreadParentSessionKey(":thread:something")).toBeNull();
  });
});

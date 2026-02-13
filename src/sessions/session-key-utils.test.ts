import { describe, expect, it } from "vitest";
import {
  isAcpSessionKey,
  isSubagentSessionKey,
  parseAgentSessionKey,
  resolveThreadParentSessionKey,
} from "./session-key-utils.js";

// ---------------------------------------------------------------------------
// parseAgentSessionKey
// ---------------------------------------------------------------------------

describe("parseAgentSessionKey", () => {
  it("returns null for empty/null/undefined", () => {
    expect(parseAgentSessionKey("")).toBeNull();
    expect(parseAgentSessionKey(null)).toBeNull();
    expect(parseAgentSessionKey(undefined)).toBeNull();
  });

  it("returns null for keys with < 3 parts", () => {
    expect(parseAgentSessionKey("agent:dofu")).toBeNull();
    expect(parseAgentSessionKey("agent")).toBeNull();
  });

  it("returns null for non-agent prefix", () => {
    expect(parseAgentSessionKey("user:dofu:main")).toBeNull();
  });

  it("parses valid agent session key", () => {
    const result = parseAgentSessionKey("agent:dofu:main");
    expect(result).toEqual({ agentId: "dofu", rest: "main" });
  });

  it("parses complex session key with multiple colons", () => {
    const result = parseAgentSessionKey("agent:dofu:telegram:dm:user123");
    expect(result).toEqual({ agentId: "dofu", rest: "telegram:dm:user123" });
  });

  it("trims whitespace", () => {
    const result = parseAgentSessionKey("  agent:dofu:main  ");
    expect(result).toEqual({ agentId: "dofu", rest: "main" });
  });
});

// ---------------------------------------------------------------------------
// isSubagentSessionKey
// ---------------------------------------------------------------------------

describe("isSubagentSessionKey", () => {
  it("returns false for empty", () => {
    expect(isSubagentSessionKey("")).toBe(false);
    expect(isSubagentSessionKey(null)).toBe(false);
  });

  it("returns true for direct subagent: prefix", () => {
    expect(isSubagentSessionKey("subagent:task1")).toBe(true);
  });

  it("returns true for agent-wrapped subagent key", () => {
    expect(isSubagentSessionKey("agent:dofu:subagent:task1")).toBe(true);
  });

  it("returns false for regular session key", () => {
    expect(isSubagentSessionKey("agent:dofu:main")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isSubagentSessionKey("SUBAGENT:task")).toBe(true);
    expect(isSubagentSessionKey("agent:dofu:SUBAGENT:task")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isAcpSessionKey
// ---------------------------------------------------------------------------

describe("isAcpSessionKey", () => {
  it("returns false for empty", () => {
    expect(isAcpSessionKey("")).toBe(false);
    expect(isAcpSessionKey(null)).toBe(false);
  });

  it("returns true for direct acp: prefix", () => {
    expect(isAcpSessionKey("acp:session1")).toBe(true);
  });

  it("returns true for agent-wrapped acp key", () => {
    expect(isAcpSessionKey("agent:dofu:acp:session1")).toBe(true);
  });

  it("returns false for regular session key", () => {
    expect(isAcpSessionKey("agent:dofu:main")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isAcpSessionKey("ACP:session")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveThreadParentSessionKey
// ---------------------------------------------------------------------------

describe("resolveThreadParentSessionKey", () => {
  it("returns null for empty/null/undefined", () => {
    expect(resolveThreadParentSessionKey("")).toBeNull();
    expect(resolveThreadParentSessionKey(null)).toBeNull();
    expect(resolveThreadParentSessionKey(undefined)).toBeNull();
  });

  it("returns null for non-thread session key", () => {
    expect(resolveThreadParentSessionKey("agent:dofu:main")).toBeNull();
  });

  it("extracts parent from :thread: marker", () => {
    const result = resolveThreadParentSessionKey(
      "agent:dofu:discord:channel:ch1:thread:thread-123",
    );
    expect(result).toBe("agent:dofu:discord:channel:ch1");
  });

  it("extracts parent from :topic: marker", () => {
    const result = resolveThreadParentSessionKey("agent:dofu:slack:channel:ch1:topic:topic-1");
    expect(result).toBe("agent:dofu:slack:channel:ch1");
  });

  it("uses last marker when multiple exist", () => {
    const result = resolveThreadParentSessionKey("agent:dofu:thread:old:thread:new");
    // lastIndexOf finds the last :thread: marker
    expect(result).toBe("agent:dofu:thread:old");
  });

  it("returns null when marker is at position 0", () => {
    expect(resolveThreadParentSessionKey(":thread:123")).toBeNull();
  });
});

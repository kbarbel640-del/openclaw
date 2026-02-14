import { describe, expect, it } from "vitest";
import {
  buildAgentMainSessionKey,
  classifySessionKeyShape,
  buildAgentPeerSessionKey,
  buildGroupHistoryKey,
  DEFAULT_ACCOUNT_ID,
  DEFAULT_AGENT_ID,
  DEFAULT_MAIN_KEY,
  normalizeAccountId,
  normalizeAgentId,
  normalizeMainKey,
  resolveAgentIdFromSessionKey,
  resolveThreadSessionKeys,
  sanitizeAgentId,
  toAgentRequestSessionKey,
  toAgentStoreSessionKey,
} from "./session-key.js";

// ---------------------------------------------------------------------------
// normalizeAgentId
// ---------------------------------------------------------------------------

describe("normalizeAgentId", () => {
  it("returns DEFAULT_AGENT_ID for empty/null/undefined", () => {
    expect(normalizeAgentId("")).toBe(DEFAULT_AGENT_ID);
    expect(normalizeAgentId(null)).toBe(DEFAULT_AGENT_ID);
    expect(normalizeAgentId(undefined)).toBe(DEFAULT_AGENT_ID);
  });

  it("lowercases valid ids", () => {
    expect(normalizeAgentId("MyAgent")).toBe("myagent");
    expect(normalizeAgentId("dofu")).toBe("dofu");
  });

  it("keeps hyphens and underscores", () => {
    expect(normalizeAgentId("my-agent_1")).toBe("my-agent_1");
  });

  it("replaces invalid characters with hyphens", () => {
    expect(normalizeAgentId("my agent!")).toBe("my-agent");
  });

  it("strips leading/trailing hyphens after normalization", () => {
    expect(normalizeAgentId("---agent---")).toBe("agent");
  });

  it("truncates to 64 characters", () => {
    const longId = "a".repeat(100);
    expect(normalizeAgentId(longId).length).toBeLessThanOrEqual(64);
  });

  it("trims whitespace", () => {
    expect(normalizeAgentId("  dofu  ")).toBe("dofu");
  });
});

// ---------------------------------------------------------------------------
// sanitizeAgentId
// ---------------------------------------------------------------------------

describe("sanitizeAgentId", () => {
  it("returns DEFAULT_AGENT_ID for empty", () => {
    expect(sanitizeAgentId("")).toBe(DEFAULT_AGENT_ID);
    expect(sanitizeAgentId(null)).toBe(DEFAULT_AGENT_ID);
  });

  it("lowercases valid ids", () => {
    expect(sanitizeAgentId("MyBot")).toBe("mybot");
  });

  it("replaces invalid characters", () => {
    expect(sanitizeAgentId("bot@home!")).toBe("bot-home");
  });
});

// ---------------------------------------------------------------------------
// normalizeAccountId
// ---------------------------------------------------------------------------

describe("normalizeAccountId", () => {
  it("returns DEFAULT_ACCOUNT_ID for empty/null/undefined", () => {
    expect(normalizeAccountId("")).toBe(DEFAULT_ACCOUNT_ID);
    expect(normalizeAccountId(null)).toBe(DEFAULT_ACCOUNT_ID);
    expect(normalizeAccountId(undefined)).toBe(DEFAULT_ACCOUNT_ID);
  });

  it("lowercases valid ids", () => {
    expect(normalizeAccountId("Business")).toBe("business");
  });
});

// ---------------------------------------------------------------------------
// normalizeMainKey
// ---------------------------------------------------------------------------

describe("normalizeMainKey", () => {
  it("returns DEFAULT_MAIN_KEY for empty/null/undefined", () => {
    expect(normalizeMainKey("")).toBe(DEFAULT_MAIN_KEY);
    expect(normalizeMainKey(null)).toBe(DEFAULT_MAIN_KEY);
    expect(normalizeMainKey(undefined)).toBe(DEFAULT_MAIN_KEY);
  });

  it("lowercases provided key", () => {
    expect(normalizeMainKey("Session1")).toBe("session1");
  });
});

// ---------------------------------------------------------------------------
// buildAgentMainSessionKey
// ---------------------------------------------------------------------------

describe("buildAgentMainSessionKey", () => {
  it("builds default key", () => {
    expect(buildAgentMainSessionKey({ agentId: "dofu" })).toBe("agent:dofu:main");
  });

  it("builds with custom mainKey", () => {
    expect(buildAgentMainSessionKey({ agentId: "dofu", mainKey: "custom" })).toBe(
      "agent:dofu:custom",
    );
  });

  it("normalizes agent id", () => {
    expect(buildAgentMainSessionKey({ agentId: "My Agent" })).toBe("agent:my-agent:main");
  });
});

// ---------------------------------------------------------------------------
// buildAgentPeerSessionKey
// ---------------------------------------------------------------------------

describe("buildAgentPeerSessionKey", () => {
  it("returns main key for DM with scope=main", () => {
    const key = buildAgentPeerSessionKey({
      agentId: "dofu",
      channel: "telegram",
      peerKind: "dm",
      peerId: "user123",
      dmScope: "main",
    });
    expect(key).toBe("agent:dofu:main");
  });

  it("includes peer for DM with scope=per-peer", () => {
    const key = buildAgentPeerSessionKey({
      agentId: "dofu",
      channel: "telegram",
      peerKind: "dm",
      peerId: "user123",
      dmScope: "per-peer",
    });
    expect(key).toBe("agent:dofu:dm:user123");
  });

  it("includes channel for DM with scope=per-channel-peer", () => {
    const key = buildAgentPeerSessionKey({
      agentId: "dofu",
      channel: "telegram",
      peerKind: "dm",
      peerId: "user123",
      dmScope: "per-channel-peer",
    });
    expect(key).toBe("agent:dofu:telegram:dm:user123");
  });

  it("includes account for DM with scope=per-account-channel-peer", () => {
    const key = buildAgentPeerSessionKey({
      agentId: "dofu",
      channel: "telegram",
      accountId: "biz",
      peerKind: "dm",
      peerId: "user123",
      dmScope: "per-account-channel-peer",
    });
    expect(key).toBe("agent:dofu:telegram:biz:dm:user123");
  });

  it("builds group session key", () => {
    const key = buildAgentPeerSessionKey({
      agentId: "dofu",
      channel: "telegram",
      peerKind: "group",
      peerId: "-100123",
    });
    expect(key).toBe("agent:dofu:telegram:group:-100123");
  });

  it("builds channel session key", () => {
    const key = buildAgentPeerSessionKey({
      agentId: "dofu",
      channel: "discord",
      peerKind: "channel",
      peerId: "ch-456",
    });
    expect(key).toBe("agent:dofu:discord:channel:ch-456");
  });

  it("uses 'unknown' for missing channel in group/channel mode", () => {
    const key = buildAgentPeerSessionKey({
      agentId: "dofu",
      channel: "",
      peerKind: "group",
      peerId: "grp1",
    });
    expect(key).toBe("agent:dofu:unknown:group:grp1");
  });

  it("uses 'unknown' for missing peerId in group mode", () => {
    const key = buildAgentPeerSessionKey({
      agentId: "dofu",
      channel: "telegram",
      peerKind: "group",
      peerId: "",
    });
    expect(key).toBe("agent:dofu:telegram:group:unknown");
  });

  it("resolves identity links for per-peer scope", () => {
    const key = buildAgentPeerSessionKey({
      agentId: "dofu",
      channel: "telegram",
      peerKind: "dm",
      peerId: "111111111",
      dmScope: "per-peer",
      identityLinks: {
        alice: ["telegram:111111111", "discord:222222222222222222"],
      },
    });
    expect(key).toBe("agent:dofu:dm:alice");
  });
});

// ---------------------------------------------------------------------------
// toAgentStoreSessionKey
// ---------------------------------------------------------------------------

describe("toAgentStoreSessionKey", () => {
  it("returns main key for empty requestKey", () => {
    const key = toAgentStoreSessionKey({ agentId: "dofu", requestKey: "" });
    expect(key).toBe("agent:dofu:main");
  });

  it("returns main key for 'main' requestKey", () => {
    const key = toAgentStoreSessionKey({ agentId: "dofu", requestKey: "main" });
    expect(key).toBe("agent:dofu:main");
  });

  it("preserves agent: prefix", () => {
    const key = toAgentStoreSessionKey({ agentId: "dofu", requestKey: "agent:other:session" });
    expect(key).toBe("agent:other:session");
  });

  it("prefixes subagent: with agent:", () => {
    const key = toAgentStoreSessionKey({ agentId: "dofu", requestKey: "subagent:task1" });
    expect(key).toBe("agent:dofu:subagent:task1");
  });

  it("prefixes arbitrary key with agent:", () => {
    const key = toAgentStoreSessionKey({ agentId: "dofu", requestKey: "telegram:dm:user1" });
    expect(key).toBe("agent:dofu:telegram:dm:user1");
  });
});

// ---------------------------------------------------------------------------
// toAgentRequestSessionKey
// ---------------------------------------------------------------------------

describe("toAgentRequestSessionKey", () => {
  it("returns undefined for empty key", () => {
    expect(toAgentRequestSessionKey("")).toBeUndefined();
    expect(toAgentRequestSessionKey(null)).toBeUndefined();
  });

  it("strips agent: prefix and returns rest", () => {
    const result = toAgentRequestSessionKey("agent:dofu:telegram:dm:user1");
    expect(result).toBe("telegram:dm:user1");
  });
});

// ---------------------------------------------------------------------------
// resolveAgentIdFromSessionKey
// ---------------------------------------------------------------------------

describe("resolveAgentIdFromSessionKey", () => {
  it("extracts agent id from session key", () => {
    expect(resolveAgentIdFromSessionKey("agent:dofu:main")).toBe("dofu");
  });

  it("returns DEFAULT_AGENT_ID for non-parseable key", () => {
    expect(resolveAgentIdFromSessionKey("invalid")).toBe(DEFAULT_AGENT_ID);
  });

  it("returns DEFAULT_AGENT_ID for null/undefined", () => {
    expect(resolveAgentIdFromSessionKey(null)).toBe(DEFAULT_AGENT_ID);
    expect(resolveAgentIdFromSessionKey(undefined)).toBe(DEFAULT_AGENT_ID);
  });
});

// ---------------------------------------------------------------------------
// buildGroupHistoryKey
// ---------------------------------------------------------------------------

describe("buildGroupHistoryKey", () => {
  it("builds key with all parts", () => {
    const key = buildGroupHistoryKey({
      channel: "telegram",
      accountId: "default",
      peerKind: "group",
      peerId: "-100123",
    });
    expect(key).toBe("telegram:default:group:-100123");
  });

  it("uses default account when not provided", () => {
    const key = buildGroupHistoryKey({
      channel: "discord",
      peerKind: "channel",
      peerId: "ch-1",
    });
    expect(key).toBe("discord:default:channel:ch-1");
  });
});

// ---------------------------------------------------------------------------
// resolveThreadSessionKeys
// ---------------------------------------------------------------------------

describe("resolveThreadSessionKeys", () => {
  it("returns base key when no threadId", () => {
    const result = resolveThreadSessionKeys({
      baseSessionKey: "agent:dofu:main",
      threadId: null,
    });
    expect(result.sessionKey).toBe("agent:dofu:main");
    expect(result.parentSessionKey).toBeUndefined();
  });

  it("appends thread suffix by default", () => {
    const result = resolveThreadSessionKeys({
      baseSessionKey: "agent:dofu:discord:channel:ch1",
      threadId: "thread-123",
    });
    expect(result.sessionKey).toBe("agent:dofu:discord:channel:ch1:thread:thread-123");
  });

  it("skips thread suffix when useSuffix=false", () => {
    const result = resolveThreadSessionKeys({
      baseSessionKey: "agent:dofu:main",
      threadId: "thread-123",
      useSuffix: false,
    });
    expect(result.sessionKey).toBe("agent:dofu:main");
  });

  it("passes parentSessionKey through", () => {
    const result = resolveThreadSessionKeys({
      baseSessionKey: "agent:dofu:main",
      threadId: "thread-123",
      parentSessionKey: "agent:dofu:discord:channel:parent",
    });
    expect(result.parentSessionKey).toBe("agent:dofu:discord:channel:parent");
  });

  it("lowercases threadId", () => {
    const result = resolveThreadSessionKeys({
      baseSessionKey: "agent:dofu:main",
      threadId: "THREAD-ABC",
    });
    expect(result.sessionKey).toBe("agent:dofu:main:thread:thread-abc");
  });
});

describe("classifySessionKeyShape", () => {
  it("classifies empty keys as missing", () => {
    expect(classifySessionKeyShape(undefined)).toBe("missing");
    expect(classifySessionKeyShape("   ")).toBe("missing");
  });

  it("classifies valid agent keys", () => {
    expect(classifySessionKeyShape("agent:main:main")).toBe("agent");
    expect(classifySessionKeyShape("agent:research:subagent:worker")).toBe("agent");
  });

  it("classifies malformed agent keys", () => {
    expect(classifySessionKeyShape("agent::broken")).toBe("malformed_agent");
    expect(classifySessionKeyShape("agent:main")).toBe("malformed_agent");
  });

  it("treats non-agent legacy or alias keys as non-malformed", () => {
    expect(classifySessionKeyShape("main")).toBe("legacy_or_alias");
    expect(classifySessionKeyShape("custom-main")).toBe("legacy_or_alias");
    expect(classifySessionKeyShape("subagent:worker")).toBe("legacy_or_alias");
  });
});

describe("session key backward compatibility", () => {
  it("classifies legacy :dm: session keys as valid agent keys", () => {
    // Legacy session keys use :dm: instead of :direct:
    // Both should be recognized as valid agent keys
    expect(classifySessionKeyShape("agent:main:telegram:dm:123456")).toBe("agent");
    expect(classifySessionKeyShape("agent:main:whatsapp:dm:+15551234567")).toBe("agent");
    expect(classifySessionKeyShape("agent:main:discord:dm:user123")).toBe("agent");
  });

  it("classifies new :direct: session keys as valid agent keys", () => {
    expect(classifySessionKeyShape("agent:main:telegram:direct:123456")).toBe("agent");
    expect(classifySessionKeyShape("agent:main:whatsapp:direct:+15551234567")).toBe("agent");
    expect(classifySessionKeyShape("agent:main:discord:direct:user123")).toBe("agent");
  });
});

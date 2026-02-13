import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "./config.js";
import {
  resolveToolsBySender,
  resolveChannelGroupPolicy,
  resolveChannelGroupRequireMention,
} from "./group-policy.js";

function makeCfg(channels?: Record<string, unknown>): OpenClawConfig {
  return { channels } as unknown as OpenClawConfig;
}

// ---------------------------------------------------------------------------
// resolveToolsBySender
// ---------------------------------------------------------------------------

describe("resolveToolsBySender", () => {
  it("returns undefined when no toolsBySender", () => {
    expect(resolveToolsBySender({ toolsBySender: undefined })).toBeUndefined();
  });

  it("returns undefined for empty toolsBySender", () => {
    expect(resolveToolsBySender({ toolsBySender: {} })).toBeUndefined();
  });

  it("matches by senderId", () => {
    const policy = { mode: "allow" };
    const result = resolveToolsBySender({
      toolsBySender: { user123: policy },
      senderId: "user123",
    });
    expect(result).toBe(policy);
  });

  it("matches case-insensitively", () => {
    const policy = { mode: "deny" };
    const result = resolveToolsBySender({
      toolsBySender: { alice: policy },
      senderId: "Alice",
    });
    expect(result).toBe(policy);
  });

  it("strips @ prefix when matching", () => {
    const policy = { mode: "allow" };
    const result = resolveToolsBySender({
      toolsBySender: { alice: policy },
      senderUsername: "@Alice",
    });
    expect(result).toBe(policy);
  });

  it("falls back to wildcard when no specific match", () => {
    const wildcard = { mode: "limited" };
    const result = resolveToolsBySender({
      toolsBySender: { "*": wildcard, bob: { mode: "full" } },
      senderId: "unknown-user",
    });
    expect(result).toBe(wildcard);
  });

  it("prefers specific match over wildcard", () => {
    const specific = { mode: "full" };
    const wildcard = { mode: "limited" };
    const result = resolveToolsBySender({
      toolsBySender: { "*": wildcard, alice: specific },
      senderId: "alice",
    });
    expect(result).toBe(specific);
  });

  it("matches by senderName when senderId doesn't match", () => {
    const policy = { mode: "allow" };
    const result = resolveToolsBySender({
      toolsBySender: { bob: policy },
      senderId: "id-999",
      senderName: "Bob",
    });
    expect(result).toBe(policy);
  });

  it("returns undefined when no match and no wildcard", () => {
    const result = resolveToolsBySender({
      toolsBySender: { alice: { mode: "allow" } },
      senderId: "bob",
    });
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveChannelGroupPolicy
// ---------------------------------------------------------------------------

describe("resolveChannelGroupPolicy", () => {
  it("returns allowlistEnabled=false when no groups configured", () => {
    const result = resolveChannelGroupPolicy({
      cfg: makeCfg({}),
      channel: "telegram",
      groupId: "123",
    });
    expect(result.allowlistEnabled).toBe(false);
    expect(result.allowed).toBe(true);
  });

  it("returns allowed=true for allowlisted group", () => {
    const cfg = makeCfg({ telegram: { groups: { "123": {} } } });
    const result = resolveChannelGroupPolicy({ cfg, channel: "telegram", groupId: "123" });
    expect(result.allowlistEnabled).toBe(true);
    expect(result.allowed).toBe(true);
  });

  it("returns allowed=false for non-allowlisted group", () => {
    const cfg = makeCfg({ telegram: { groups: { "123": {} } } });
    const result = resolveChannelGroupPolicy({ cfg, channel: "telegram", groupId: "999" });
    expect(result.allowlistEnabled).toBe(true);
    expect(result.allowed).toBe(false);
  });

  it("returns allowed=true when wildcard * exists", () => {
    const cfg = makeCfg({ telegram: { groups: { "*": {} } } });
    const result = resolveChannelGroupPolicy({ cfg, channel: "telegram", groupId: "any-group" });
    expect(result.allowed).toBe(true);
  });

  it("provides groupConfig for matching group", () => {
    const groupCfg = { requireMention: false };
    const cfg = makeCfg({ telegram: { groups: { "123": groupCfg } } });
    const result = resolveChannelGroupPolicy({ cfg, channel: "telegram", groupId: "123" });
    expect(result.groupConfig).toEqual(groupCfg);
  });

  it("provides defaultConfig from wildcard", () => {
    const defaultCfg = { requireMention: true };
    const cfg = makeCfg({ telegram: { groups: { "*": defaultCfg } } });
    const result = resolveChannelGroupPolicy({ cfg, channel: "telegram", groupId: "123" });
    expect(result.defaultConfig).toEqual(defaultCfg);
  });
});

// ---------------------------------------------------------------------------
// resolveChannelGroupRequireMention
// ---------------------------------------------------------------------------

describe("resolveChannelGroupRequireMention", () => {
  it("defaults to true when no config", () => {
    expect(resolveChannelGroupRequireMention({ cfg: makeCfg({}), channel: "telegram" })).toBe(true);
  });

  it("uses group-specific requireMention", () => {
    const cfg = makeCfg({ telegram: { groups: { "123": { requireMention: false } } } });
    expect(resolveChannelGroupRequireMention({ cfg, channel: "telegram", groupId: "123" })).toBe(
      false,
    );
  });

  it("falls back to wildcard requireMention", () => {
    const cfg = makeCfg({ telegram: { groups: { "*": { requireMention: false } } } });
    expect(resolveChannelGroupRequireMention({ cfg, channel: "telegram", groupId: "999" })).toBe(
      false,
    );
  });

  it("group-specific overrides wildcard", () => {
    const cfg = makeCfg({
      telegram: { groups: { "*": { requireMention: true }, "123": { requireMention: false } } },
    });
    expect(resolveChannelGroupRequireMention({ cfg, channel: "telegram", groupId: "123" })).toBe(
      false,
    );
  });

  it("respects requireMentionOverride with after-config order", () => {
    expect(
      resolveChannelGroupRequireMention({
        cfg: makeCfg({}),
        channel: "telegram",
        requireMentionOverride: false,
      }),
    ).toBe(false);
  });

  it("respects requireMentionOverride with before-config order", () => {
    const cfg = makeCfg({ telegram: { groups: { "123": { requireMention: true } } } });
    expect(
      resolveChannelGroupRequireMention({
        cfg,
        channel: "telegram",
        groupId: "123",
        requireMentionOverride: false,
        overrideOrder: "before-config",
      }),
    ).toBe(false);
  });
});

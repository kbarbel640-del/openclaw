import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { resolveChannelMediaMaxBytes } from "./media-limits.js";

const MB = 1024 * 1024;

function makeCfg(overrides?: Partial<OpenClawConfig>): OpenClawConfig {
  return { agents: { defaults: {} }, ...overrides } as OpenClawConfig;
}

describe("resolveChannelMediaMaxBytes", () => {
  it("returns undefined when no limits configured", () => {
    const result = resolveChannelMediaMaxBytes({
      cfg: makeCfg(),
      resolveChannelLimitMb: () => undefined,
    });
    expect(result).toBeUndefined();
  });

  it("uses channel-specific limit when provided", () => {
    const result = resolveChannelMediaMaxBytes({
      cfg: makeCfg(),
      resolveChannelLimitMb: () => 25,
    });
    expect(result).toBe(25 * MB);
  });

  it("falls back to agents.defaults.mediaMaxMb", () => {
    const result = resolveChannelMediaMaxBytes({
      cfg: makeCfg({ agents: { defaults: { mediaMaxMb: 10 } } } as Partial<OpenClawConfig>),
      resolveChannelLimitMb: () => undefined,
    });
    expect(result).toBe(10 * MB);
  });

  it("channel limit takes priority over global default", () => {
    const result = resolveChannelMediaMaxBytes({
      cfg: makeCfg({ agents: { defaults: { mediaMaxMb: 10 } } } as Partial<OpenClawConfig>),
      resolveChannelLimitMb: () => 50,
    });
    expect(result).toBe(50 * MB);
  });

  it("passes normalized accountId to resolver", () => {
    let receivedAccountId = "";
    resolveChannelMediaMaxBytes({
      cfg: makeCfg(),
      resolveChannelLimitMb: ({ accountId }) => {
        receivedAccountId = accountId;
        return undefined;
      },
      accountId: "  MY-ACCOUNT  ",
    });
    // normalizeAccountId trims and lowercases
    expect(receivedAccountId).toBe("my-account");
  });

  it("handles null accountId", () => {
    let receivedAccountId = "";
    resolveChannelMediaMaxBytes({
      cfg: makeCfg(),
      resolveChannelLimitMb: ({ accountId }) => {
        receivedAccountId = accountId;
        return undefined;
      },
      accountId: null,
    });
    // normalizeAccountId returns "default" for null
    expect(receivedAccountId).toBe("default");
  });
});

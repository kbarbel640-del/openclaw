import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { resolveChannelMediaMaxBytes } from "./media-limits.js";

const MB = 1024 * 1024;

function makeCfg(globalMediaMaxMb?: number): OpenClawConfig {
  return {
    agents: globalMediaMaxMb != null ? { defaults: { mediaMaxMb: globalMediaMaxMb } } : undefined,
  } as OpenClawConfig;
}

describe("resolveChannelMediaMaxBytes", () => {
  it("returns channel limit when set", () => {
    const result = resolveChannelMediaMaxBytes({
      cfg: makeCfg(10),
      resolveChannelLimitMb: () => 5,
    });
    expect(result).toBe(5 * MB);
  });

  it("falls back to global mediaMaxMb when channel limit is undefined", () => {
    const result = resolveChannelMediaMaxBytes({
      cfg: makeCfg(3),
      resolveChannelLimitMb: () => undefined,
    });
    expect(result).toBe(3 * MB);
  });

  it("returns undefined when neither is set", () => {
    const result = resolveChannelMediaMaxBytes({
      cfg: makeCfg(),
      resolveChannelLimitMb: () => undefined,
    });
    expect(result).toBeUndefined();
  });

  it("returns 0 when channel limit is 0 (media disabled)", () => {
    const result = resolveChannelMediaMaxBytes({
      cfg: makeCfg(10),
      resolveChannelLimitMb: () => 0,
    });
    expect(result).toBe(0);
  });

  it("returns 0 when global mediaMaxMb is 0 (media disabled)", () => {
    const result = resolveChannelMediaMaxBytes({
      cfg: makeCfg(0),
      resolveChannelLimitMb: () => undefined,
    });
    expect(result).toBe(0);
  });

  it("channel limit of 0 takes precedence over global limit", () => {
    const result = resolveChannelMediaMaxBytes({
      cfg: makeCfg(5),
      resolveChannelLimitMb: () => 0,
    });
    expect(result).toBe(0);
  });
});

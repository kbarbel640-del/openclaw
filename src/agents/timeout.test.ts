import { describe, expect, it } from "vitest";
import { resolveAgentTimeoutMs, resolveSubagentAnnounceDeliveryTimeoutMs } from "./timeout.js";

describe("resolveAgentTimeoutMs", () => {
  it("uses a timer-safe sentinel for no-timeout overrides", () => {
    expect(resolveAgentTimeoutMs({ overrideSeconds: 0 })).toBe(2_147_000_000);
    expect(resolveAgentTimeoutMs({ overrideMs: 0 })).toBe(2_147_000_000);
  });

  it("clamps very large timeout overrides to timer-safe values", () => {
    expect(resolveAgentTimeoutMs({ overrideSeconds: 9_999_999 })).toBe(2_147_000_000);
    expect(resolveAgentTimeoutMs({ overrideMs: 9_999_999_999 })).toBe(2_147_000_000);
  });
});

describe("resolveSubagentAnnounceDeliveryTimeoutMs", () => {
  it("defaults to 60s when unset", () => {
    expect(resolveSubagentAnnounceDeliveryTimeoutMs({})).toBe(60_000);
  });

  it("reads configured timeout from agents.defaults.subagents.announceDeliveryTimeoutMs", () => {
    expect(
      resolveSubagentAnnounceDeliveryTimeoutMs({
        agents: { defaults: { subagents: { announceDeliveryTimeoutMs: 300_000 } } },
      }),
    ).toBe(300_000);
  });
});

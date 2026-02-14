import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "./types.js";
import {
  resolveAgentMaxConcurrent,
  resolveSubagentMaxConcurrent,
  DEFAULT_AGENT_MAX_CONCURRENT,
  DEFAULT_SUBAGENT_MAX_CONCURRENT,
} from "./agent-limits.js";

function makeCfg(overrides?: Record<string, unknown>): OpenClawConfig {
  return overrides as unknown as OpenClawConfig;
}

describe("resolveAgentMaxConcurrent", () => {
  it("returns default for undefined config", () => {
    expect(resolveAgentMaxConcurrent()).toBe(DEFAULT_AGENT_MAX_CONCURRENT);
    expect(resolveAgentMaxConcurrent(undefined)).toBe(DEFAULT_AGENT_MAX_CONCURRENT);
  });

  it("returns default when agents.defaults.maxConcurrent is missing", () => {
    expect(resolveAgentMaxConcurrent(makeCfg({}))).toBe(DEFAULT_AGENT_MAX_CONCURRENT);
    expect(resolveAgentMaxConcurrent(makeCfg({ agents: {} }))).toBe(DEFAULT_AGENT_MAX_CONCURRENT);
  });

  it("uses configured value", () => {
    expect(resolveAgentMaxConcurrent(makeCfg({ agents: { defaults: { maxConcurrent: 8 } } }))).toBe(
      8,
    );
  });

  it("floors fractional values", () => {
    expect(
      resolveAgentMaxConcurrent(makeCfg({ agents: { defaults: { maxConcurrent: 3.9 } } })),
    ).toBe(3);
  });

  it("clamps to minimum of 1", () => {
    expect(resolveAgentMaxConcurrent(makeCfg({ agents: { defaults: { maxConcurrent: 0 } } }))).toBe(
      1,
    );
    expect(
      resolveAgentMaxConcurrent(makeCfg({ agents: { defaults: { maxConcurrent: -5 } } })),
    ).toBe(1);
  });

  it("returns default for NaN/Infinity", () => {
    expect(
      resolveAgentMaxConcurrent(makeCfg({ agents: { defaults: { maxConcurrent: NaN } } })),
    ).toBe(DEFAULT_AGENT_MAX_CONCURRENT);
    expect(
      resolveAgentMaxConcurrent(makeCfg({ agents: { defaults: { maxConcurrent: Infinity } } })),
    ).toBe(DEFAULT_AGENT_MAX_CONCURRENT);
  });
});

describe("resolveSubagentMaxConcurrent", () => {
  it("returns default for undefined config", () => {
    expect(resolveSubagentMaxConcurrent()).toBe(DEFAULT_SUBAGENT_MAX_CONCURRENT);
  });

  it("uses configured value", () => {
    const cfg = makeCfg({ agents: { defaults: { subagents: { maxConcurrent: 16 } } } });
    expect(resolveSubagentMaxConcurrent(cfg)).toBe(16);
  });

  it("clamps to minimum of 1", () => {
    const cfg = makeCfg({ agents: { defaults: { subagents: { maxConcurrent: 0 } } } });
    expect(resolveSubagentMaxConcurrent(cfg)).toBe(1);
  });

  it("returns default for non-numeric", () => {
    const cfg = makeCfg({ agents: { defaults: { subagents: { maxConcurrent: "not a number" } } } });
    expect(resolveSubagentMaxConcurrent(cfg)).toBe(DEFAULT_SUBAGENT_MAX_CONCURRENT);
  });
});

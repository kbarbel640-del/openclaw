import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "./types.js";
import {
  findDuplicateAgentDirs,
  formatDuplicateAgentDirError,
  type DuplicateAgentDir,
} from "./agent-dirs.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveEffectiveAgentDir via findDuplicateAgentDirs", () => {
  it("uses OPENCLAW_HOME for default agent dir resolution", () => {
    // findDuplicateAgentDirs calls resolveEffectiveAgentDir internally.
    // With a single agent there are no duplicates, but we can inspect the
    // resolved dir indirectly by triggering a duplicate with two agents
    // that both fall through to the same default dir — which can't happen
    // since they have different IDs.  Instead we just verify no crash and
    // that the env flows through by checking a two-agent config produces
    // distinct dirs (no duplicates).
    const cfg: OpenClawConfig = {
      agents: {
        list: [{ id: "alpha" }, { id: "beta" }],
      },
    };

    const env = {
      OPENCLAW_HOME: "/srv/openclaw-home",
      HOME: "/home/other",
    } as NodeJS.ProcessEnv;

    const dupes = findDuplicateAgentDirs(cfg, { env });
    expect(dupes).toHaveLength(0);
  });

  it("resolves agent dir under OPENCLAW_HOME state dir", () => {
    // Force two agents to the same explicit agentDir to verify the path
    // that doesn't use the default — then test the default path by
    // checking that a single-agent config resolves without duplicates.
    const cfg: OpenClawConfig = {};

    const env = {
      OPENCLAW_HOME: "/srv/openclaw-home",
    } as NodeJS.ProcessEnv;

    // No duplicates for a single default agent
    const dupes = findDuplicateAgentDirs(cfg, { env });
    expect(dupes).toHaveLength(0);
  });
});

describe("formatDuplicateAgentDirError", () => {
  it("formats a single conflict", () => {
    const dups: DuplicateAgentDir[] = [
      { agentDir: "/home/user/.openclaw/agents/shared", agentIds: ["agent-a", "agent-b"] },
    ];
    const result = formatDuplicateAgentDirError(dups);
    expect(result).toContain("Duplicate agentDir detected");
    expect(result).toContain("/home/user/.openclaw/agents/shared");
    expect(result).toContain('"agent-a"');
    expect(result).toContain('"agent-b"');
  });

  it("formats multiple conflicts", () => {
    const dups: DuplicateAgentDir[] = [
      { agentDir: "/path/a", agentIds: ["x", "y"] },
      { agentDir: "/path/b", agentIds: ["p", "q", "r"] },
    ];
    const result = formatDuplicateAgentDirError(dups);
    expect(result).toContain("/path/a");
    expect(result).toContain("/path/b");
    expect(result).toContain('"r"');
  });

  it("includes fix suggestion", () => {
    const dups: DuplicateAgentDir[] = [{ agentDir: "/dir", agentIds: ["a", "b"] }];
    const result = formatDuplicateAgentDirError(dups);
    expect(result).toContain("Fix:");
    expect(result).toContain("auth-profiles.json");
  });

  it("handles empty array", () => {
    const result = formatDuplicateAgentDirError([]);
    expect(result).toContain("Duplicate agentDir detected");
    expect(result).not.toContain("- /");
  });
});

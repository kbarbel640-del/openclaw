import { afterEach, describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import {
  resolveImmediateSuperiorAgentId,
  resolveNextSuperiorByRole,
  resolvePreferredSuperior,
} from "./hierarchy-superior.js";
import { addSubagentRunForTests, resetSubagentRegistryForTests } from "./subagent-registry.js";

const cfg: OpenClawConfig = {
  agents: {
    list: [
      { id: "main", role: "orchestrator" },
      { id: "cto", role: "lead" },
      { id: "backend", role: "specialist" },
      { id: "junior", role: "worker" },
    ],
  },
};

describe("hierarchy-superior", () => {
  afterEach(() => {
    resetSubagentRegistryForTests();
  });

  it("resolves immediate superior from active run chain", () => {
    const now = Date.now();
    addSubagentRunForTests({
      runId: "r-1",
      childSessionKey: "agent:junior:main",
      requesterSessionKey: "agent:backend:main",
      requesterDisplayKey: "agent:backend:main",
      task: "Implement task",
      cleanup: "keep",
      createdAt: now - 2_000,
      startedAt: now - 1_500,
    });

    expect(resolveImmediateSuperiorAgentId(cfg, "junior")).toBe("backend");
  });

  it("falls back to role-based superior when immediate chain is unavailable", () => {
    expect(resolveNextSuperiorByRole(cfg, "junior")).toEqual({
      superiorId: "backend",
      superiorRole: "specialist",
    });
    expect(resolvePreferredSuperior(cfg, "junior")).toEqual({
      superiorId: "backend",
      superiorRole: "specialist",
      source: "role-fallback",
    });
  });
});

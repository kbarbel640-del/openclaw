import { afterEach, describe, expect, it } from "vitest";
import {
  addSubagentRunForTests,
  resetSubagentRegistryForTests,
} from "../../agents/subagent-registry.js";
import type { OpenClawConfig } from "../../config/config.js";
import { resolveDisputeEscalationSuperior } from "./collaboration.js";

const buildConfig = (): OpenClawConfig => ({
  agents: {
    list: [
      { id: "main", role: "orchestrator" },
      { id: "cto", role: "lead" },
      { id: "qa", role: "specialist" },
      { id: "backend", role: "specialist" },
      { id: "junior", role: "worker" },
    ],
  },
});

describe("resolveDisputeEscalationSuperior", () => {
  afterEach(() => {
    resetSubagentRegistryForTests();
  });

  it("prefers the immediate superior from the active hierarchy chain", () => {
    const now = Date.now();
    addSubagentRunForTests({
      runId: "run-1",
      childSessionKey: "agent:junior:main",
      requesterSessionKey: "agent:backend:main",
      requesterDisplayKey: "agent:backend:main",
      task: "Implement endpoint",
      cleanup: "keep",
      createdAt: now - 1_000,
      startedAt: now - 900,
    });

    const superior = resolveDisputeEscalationSuperior(buildConfig(), "junior");
    expect(superior).toEqual({
      superiorId: "backend",
      superiorRole: "specialist",
    });
  });

  it("falls back to the next role in hierarchy when no direct chain exists", () => {
    const superior = resolveDisputeEscalationSuperior(buildConfig(), "junior");
    expect(superior).toEqual({
      superiorId: "qa",
      superiorRole: "specialist",
    });
  });

  it("ignores non-superior requester and escalates to the next valid rank", () => {
    const now = Date.now();
    addSubagentRunForTests({
      runId: "run-2",
      childSessionKey: "agent:backend:main",
      requesterSessionKey: "agent:qa:main",
      requesterDisplayKey: "agent:qa:main",
      task: "Review plan",
      cleanup: "keep",
      createdAt: now - 1_000,
      startedAt: now - 900,
    });

    const superior = resolveDisputeEscalationSuperior(buildConfig(), "backend");
    expect(superior).toEqual({
      superiorId: "cto",
      superiorRole: "lead",
    });
  });
});

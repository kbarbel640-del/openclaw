import { afterEach, describe, expect, it } from "vitest";
import {
  addSubagentRunForTests,
  resetSubagentRegistryForTests,
} from "../../agents/subagent-registry.js";
import type { OpenClawConfig } from "../../config/config.js";
import { resolveDelegationCreateTarget } from "./delegation.js";

const cfg: OpenClawConfig = {
  agents: {
    list: [
      { id: "main", role: "orchestrator" },
      { id: "lead", role: "lead" },
      { id: "senior", role: "specialist" },
      { id: "junior", role: "worker" },
    ],
  },
};

describe("resolveDelegationCreateTarget", () => {
  afterEach(() => {
    resetSubagentRegistryForTests();
  });

  it("auto-routes request mode to immediate superior when target is omitted", () => {
    const now = Date.now();
    addSubagentRunForTests({
      runId: "run-1",
      childSessionKey: "agent:junior:main",
      requesterSessionKey: "agent:senior:main",
      requesterDisplayKey: "agent:senior:main",
      task: "Work item",
      cleanup: "keep",
      createdAt: now - 1_000,
      startedAt: now - 900,
    });

    const target = resolveDelegationCreateTarget({
      cfg,
      fromAgentId: "junior",
      mode: "request",
    });
    expect(target).toEqual({
      toAgentId: "senior",
      toRole: "specialist",
      rerouted: true,
    });
  });

  it("re-routes upward requests that try to skip the immediate superior", () => {
    const now = Date.now();
    addSubagentRunForTests({
      runId: "run-2",
      childSessionKey: "agent:junior:main",
      requesterSessionKey: "agent:senior:main",
      requesterDisplayKey: "agent:senior:main",
      task: "Work item",
      cleanup: "keep",
      createdAt: now - 1_000,
      startedAt: now - 900,
    });

    const target = resolveDelegationCreateTarget({
      cfg,
      fromAgentId: "junior",
      toAgentId: "lead",
      mode: "request",
    });
    expect(target).toEqual({
      toAgentId: "senior",
      toRole: "specialist",
      rerouted: true,
    });
  });
});

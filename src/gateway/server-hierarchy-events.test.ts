import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../agents/subagent-registry.js", () => ({
  listAllSubagentRuns: vi.fn(),
}));

vi.mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadConfig: vi.fn(),
  };
});

vi.mock("../agents/delegation-registry.js", () => ({
  getAllDelegations: vi.fn(() => []),
  getAgentDelegationMetrics: vi.fn(() => ({ sent: 0, received: 0 })),
}));

vi.mock("./server-methods/collaboration.js", () => ({
  getAllCollaborativeSessions: vi.fn(() => []),
}));

import { listAllSubagentRuns } from "../agents/subagent-registry.js";
import { loadConfig } from "../config/config.js";
import { getAllCollaborativeSessions } from "./server-methods/collaboration.js";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-02-09T00:00:00.000Z"));
  vi.mocked(listAllSubagentRuns).mockReset();
  vi.mocked(loadConfig).mockReset();
  vi.mocked(getAllCollaborativeSessions).mockReset();
});

describe("gateway hierarchy snapshot", () => {
  it("caches snapshots briefly to avoid excessive rebuilds", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      session: { scope: "agent", mainKey: "main" },
      agents: { list: [{ id: "lead", default: true }] },
    });
    vi.mocked(listAllSubagentRuns).mockReturnValue([]);
    vi.mocked(getAllCollaborativeSessions).mockReturnValue([]);

    const mod = await import("./server-hierarchy-events.js");
    const snap1 = mod.getHierarchySnapshot();

    vi.setSystemTime(new Date("2026-02-09T00:00:00.100Z"));
    const snap2 = mod.getHierarchySnapshot();
    expect(snap2.updatedAt).toBe(snap1.updatedAt);

    vi.setSystemTime(new Date("2026-02-09T00:00:00.400Z"));
    const snap3 = mod.getHierarchySnapshot();
    expect(snap3.updatedAt).not.toBe(snap1.updatedAt);
  });

  it("avoids cycles when allowAgents has mutual references", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      session: { scope: "agent", mainKey: "main" },
      agents: {
        list: [
          { id: "lead", default: true, role: "orchestrator" },
          { id: "a", subagents: { allowAgents: ["b"] } },
          { id: "b", subagents: { allowAgents: ["a"] } },
        ],
      },
    });
    vi.mocked(listAllSubagentRuns).mockReturnValue([]);
    vi.mocked(getAllCollaborativeSessions).mockReturnValue([
      {
        topic: "team test",
        members: ["a", "b"],
        decisions: [],
        messages: [{ type: "clarification", from: "a" }],
      },
    ] as unknown as Array<Record<string, unknown>>);

    const mod = await import("./server-hierarchy-events.js");
    const snap = mod.getHierarchySnapshot();
    const rootAgentIds = snap.roots.map((r) => r.agentId).filter(Boolean);

    expect(rootAgentIds).toContain("lead");
    expect(rootAgentIds).toContain("a");
    expect(rootAgentIds).not.toContain("b");

    const aRoot = snap.roots.find((r) => r.agentId === "a");
    expect(aRoot?.children.map((c) => c.agentId)).toEqual(["b"]);
  });

  it("does not double-parent agents already nested by run relationships", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      session: { scope: "agent", mainKey: "main" },
      agents: {
        list: [
          { id: "lead", default: true, role: "orchestrator" },
          { id: "a", subagents: { allowAgents: ["b"] } },
          { id: "b" },
        ],
      },
    });
    vi.mocked(getAllCollaborativeSessions).mockReturnValue(
      [] as unknown as Array<Record<string, unknown>>,
    );
    vi.mocked(listAllSubagentRuns).mockReturnValue([
      {
        runId: "run-1",
        childSessionKey: "agent:b:main",
        requesterSessionKey: "agent:a:main",
        requesterDisplayKey: "a",
        task: "child task",
        cleanup: "delete",
        createdAt: Date.now(),
        startedAt: Date.now(),
      },
    ] as unknown as Array<Record<string, unknown>>);

    const mod = await import("./server-hierarchy-events.js");
    const snap = mod.getHierarchySnapshot();
    const aRoot = snap.roots.find((r) => r.agentId === "a");
    expect(aRoot?.children.length).toBe(1);
    expect(aRoot?.children[0]?.agentId).toBe("b");
  });
});

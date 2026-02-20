import { describe, expect, it, vi } from "vitest";
import { listAgentIds } from "../../agents/agent-scope.js";
import { CommandBridgeRegistry } from "../registry.js";
import { wireAgentsBridgeCommands } from "./agents.js";

// Mock dependencies
vi.mock("../../config/config.js", () => ({
  loadConfig: vi.fn(() => ({
    agents: {
      main: { model: "default", provider: "openai" },
      test: { model: "claude-3", provider: "anthropic" },
    },
  })),
}));

vi.mock("../../agents/agent-scope.js", () => ({
  listAgentIds: vi.fn(() => ["main", "test"]),
}));

vi.mock("../../config/sessions.js", () => ({
  resolveAgentMainSessionKey: vi.fn(({ agentId }) => `agent:${agentId}:main`),
  canonicalizeMainSessionAlias: vi.fn(({ agentId }) => `agent:${agentId}:main`),
  resolveSessionStoreKey: vi.fn(({ sessionKey }) => sessionKey),
  resolveSessionStoreAgentId: vi.fn(() => "main"),
  resolveStorePath: vi.fn(() => "/tmp/sessions.json"),
  loadSessionStore: vi.fn(() => ({
    "agent:main:main": { label: "Main Agent", updatedAt: Date.now() },
    "agent:test:main": {
      label: "Test Agent",
      modelOverride: "claude-3-opus",
      providerOverride: "anthropic",
      updatedAt: Date.now(),
    },
  })),
  loadSessionEntry: vi.fn((key) => ({
    entry: {
      label: key.includes("agent:main") ? "Main Agent" : "Test Agent",
      modelOverride: key.includes("agent:main") ? undefined : "claude-3-opus",
      providerOverride: key.includes("agent:main") ? undefined : "anthropic",
      updatedAt: Date.now(),
    },
    storePath: "/tmp/sessions.json",
  })),
}));

describe("Agents Bridge Commands", () => {
  const registry = new CommandBridgeRegistry();
  wireAgentsBridgeCommands(registry);

  it("should list agents", async () => {
    const cmd = registry.get("agents.list");
    expect(cmd).toBeDefined();

    const result = await cmd!.handler({}, { channel: "test", isAdmin: true });
    expect(result.success).toBe(true);
    const data = result.data as { agents: { id: string; name: string }[] };
    expect(data.agents).toHaveLength(2);
    expect(data.agents[0]).toMatchObject({ id: "main", name: "Main Agent" });
    expect(data.agents[1]).toMatchObject({ id: "test", name: "Test Agent" });
  });

  it("should filter agents", async () => {
    const cmd = registry.get("agents.list");
    const result = await cmd!.handler({ filter: "main" }, { channel: "test", isAdmin: true });
    expect(result.success).toBe(true);
    const data = result.data as { agents: { id: string }[] };
    expect(data.agents).toHaveLength(1);
    expect(data.agents[0].id).toBe("main");
  });

  it("should get agent status", async () => {
    const cmd = registry.get("agents.status");
    expect(cmd).toBeDefined();

    const result = await cmd!.handler({ agentId: "test" }, { channel: "test", isAdmin: true });
    expect(result.success).toBe(true);
    const data = result.data as { sessionKey: string; model: string };
    expect(data.sessionKey).toBe("agent:test:main");
    expect(data.model).toBe("claude-3-opus");
  });

  it("should deny non-admin access", async () => {
    const listCmd = registry.get("agents.list");
    const listResult = await listCmd!.handler({}, { channel: "test", isAdmin: false });
    expect(listResult.success).toBe(false);
    expect(listResult.error).toContain("Unauthorized");

    const statusCmd = registry.get("agents.status");
    const statusResult = await statusCmd!.handler(
      { agentId: "main" },
      { channel: "test", isAdmin: false },
    );
    expect(statusResult.success).toBe(false);
    expect(statusResult.error).toContain("Unauthorized");
  });

  it("should handle empty agents list", async () => {
    // Override mock for this test
    vi.mocked(listAgentIds).mockReturnValueOnce([]);

    const cmd = registry.get("agents.list");
    const result = await cmd!.handler({}, { channel: "test", isAdmin: true });

    expect(result.success).toBe(true);
    const data = result.data as { agents: unknown[] };
    expect(data.agents).toHaveLength(0);
  });
});

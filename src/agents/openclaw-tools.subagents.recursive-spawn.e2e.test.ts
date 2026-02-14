import { beforeEach, describe, expect, it, vi } from "vitest";

const callGatewayMock = vi.fn();
vi.mock("../gateway/call.js", () => ({
  callGateway: (opts: unknown) => callGatewayMock(opts),
}));

let configOverride: ReturnType<(typeof import("../config/config.js"))["loadConfig"]> = {
  session: {
    mainKey: "main",
    scope: "per-sender",
  },
};

vi.mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    loadConfig: () => configOverride,
    resolveGatewayPort: () => 18789,
  };
});

import "./test-helpers/fast-core-tools.js";
import { createOpenClawTools } from "./openclaw-tools.js";
import { resetSubagentRegistryForTests } from "./subagent-registry.js";

describe("openclaw-tools: recursive subagent spawning", () => {
  beforeEach(() => {
    configOverride = {
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
    };
  });

  it("blocks recursive spawn when allowRecursiveSpawn is not set (default)", async () => {
    resetSubagentRegistryForTests();
    callGatewayMock.mockReset();
    configOverride = {
      session: { mainKey: "main", scope: "per-sender" },
      agents: {
        list: [{ id: "main" }],
      },
    };

    const tool = createOpenClawTools({
      agentSessionKey: "agent:main:subagent:abc-123",
      agentChannel: "whatsapp",
    }).find((candidate) => candidate.name === "sessions_spawn");
    if (!tool) {
      throw new Error("missing sessions_spawn tool");
    }

    const result = await tool.execute("call-recursive-blocked", {
      task: "sub-subtask",
    });

    expect(result.details).toMatchObject({
      status: "forbidden",
    });
    expect(result.details.error).toContain("Recursive spawning is not enabled");
  });

  it("allows recursive spawn when allowRecursiveSpawn is true", async () => {
    resetSubagentRegistryForTests();
    callGatewayMock.mockReset();
    configOverride = {
      session: { mainKey: "main", scope: "per-sender" },
      agents: {
        list: [
          {
            id: "main",
            subagents: {
              allowRecursiveSpawn: true,
              maxDepth: 3,
            },
          },
        ],
      },
    };

    let childSessionKey: string | undefined;
    callGatewayMock.mockImplementation(async (opts: unknown) => {
      const request = opts as { method?: string; params?: unknown };
      if (request.method === "agent") {
        const params = request.params as { sessionKey?: string } | undefined;
        childSessionKey = params?.sessionKey;
        return { runId: "run-recursive-1", status: "accepted", acceptedAt: Date.now() };
      }
      if (request.method === "agent.wait") {
        return { status: "timeout" };
      }
      return {};
    });

    const tool = createOpenClawTools({
      agentSessionKey: "agent:main:subagent:abc-123",
      agentChannel: "whatsapp",
    }).find((candidate) => candidate.name === "sessions_spawn");
    if (!tool) {
      throw new Error("missing sessions_spawn tool");
    }

    const result = await tool.execute("call-recursive-allowed", {
      task: "sub-subtask",
    });

    expect(result.details).toMatchObject({
      status: "accepted",
      runId: "run-recursive-1",
    });
    // Child key should extend the parent key with :sub:{uuid}
    expect(childSessionKey).toBeDefined();
    expect(childSessionKey?.startsWith("agent:main:subagent:abc-123:sub:")).toBe(true);
  });

  it("blocks spawn when max depth is reached", async () => {
    resetSubagentRegistryForTests();
    callGatewayMock.mockReset();
    configOverride = {
      session: { mainKey: "main", scope: "per-sender" },
      agents: {
        list: [
          {
            id: "main",
            subagents: {
              allowRecursiveSpawn: true,
              maxDepth: 2,
            },
          },
        ],
      },
    };

    // Depth-2 key (already at maxDepth=2)
    const tool = createOpenClawTools({
      agentSessionKey: "agent:main:subagent:abc:sub:def",
      agentChannel: "whatsapp",
    }).find((candidate) => candidate.name === "sessions_spawn");
    if (!tool) {
      throw new Error("missing sessions_spawn tool");
    }

    const result = await tool.execute("call-depth-exceeded", {
      task: "too deep",
    });

    expect(result.details).toMatchObject({
      status: "forbidden",
    });
    expect(result.details.error).toContain("Maximum subagent depth (2) reached");
  });

  it("allows spawn when depth is below max", async () => {
    resetSubagentRegistryForTests();
    callGatewayMock.mockReset();
    configOverride = {
      session: { mainKey: "main", scope: "per-sender" },
      agents: {
        list: [
          {
            id: "main",
            subagents: {
              allowRecursiveSpawn: true,
              maxDepth: 3,
            },
          },
        ],
      },
    };

    let childSessionKey: string | undefined;
    callGatewayMock.mockImplementation(async (opts: unknown) => {
      const request = opts as { method?: string; params?: unknown };
      if (request.method === "agent") {
        const params = request.params as { sessionKey?: string } | undefined;
        childSessionKey = params?.sessionKey;
        return { runId: "run-depth2", status: "accepted", acceptedAt: Date.now() };
      }
      if (request.method === "agent.wait") {
        return { status: "timeout" };
      }
      return {};
    });

    // Depth-2 key, maxDepth=3, so depth-3 should be allowed
    const tool = createOpenClawTools({
      agentSessionKey: "agent:main:subagent:abc:sub:def",
      agentChannel: "whatsapp",
    }).find((candidate) => candidate.name === "sessions_spawn");
    if (!tool) {
      throw new Error("missing sessions_spawn tool");
    }

    const result = await tool.execute("call-depth-2-ok", {
      task: "depth 3 spawn",
    });

    expect(result.details).toMatchObject({
      status: "accepted",
    });
    expect(childSessionKey?.startsWith("agent:main:subagent:abc:sub:def:sub:")).toBe(true);
  });

  it("uses global defaults when per-agent config is not set", async () => {
    resetSubagentRegistryForTests();
    callGatewayMock.mockReset();
    configOverride = {
      session: { mainKey: "main", scope: "per-sender" },
      agents: {
        defaults: {
          subagents: {
            allowRecursiveSpawn: true,
            maxDepth: 2,
          },
        },
        list: [{ id: "main" }],
      },
    };

    callGatewayMock.mockImplementation(async (opts: unknown) => {
      const request = opts as { method?: string; params?: unknown };
      if (request.method === "agent") {
        return { runId: "run-global", status: "accepted", acceptedAt: Date.now() };
      }
      if (request.method === "agent.wait") {
        return { status: "timeout" };
      }
      return {};
    });

    const tool = createOpenClawTools({
      agentSessionKey: "agent:main:subagent:abc-123",
      agentChannel: "whatsapp",
    }).find((candidate) => candidate.name === "sessions_spawn");
    if (!tool) {
      throw new Error("missing sessions_spawn tool");
    }

    const result = await tool.execute("call-global-defaults", {
      task: "global config spawn",
    });

    expect(result.details).toMatchObject({
      status: "accepted",
    });
  });
});

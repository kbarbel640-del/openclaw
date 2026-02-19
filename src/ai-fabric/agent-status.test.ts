import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentStatusParams } from "./agent-status.js";
import type { Agent, AgentStatus } from "./types.js";
import { getAgentStatus, mapAgentHealth } from "./agent-status.js";

// ---------------------------------------------------------------------------
// Mock fetch helper (same pattern as cloudru-client-simple.test.ts)
// ---------------------------------------------------------------------------

const IAM_TOKEN_RESPONSE = {
  token: "iam-jwt-token-abc",
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
};

function createMockFetch(
  responses: Array<{ status: number; body?: unknown }>,
): ReturnType<typeof vi.fn> {
  const impl = vi.fn();
  for (const response of responses) {
    impl.mockResolvedValueOnce({
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: () => Promise.resolve(response.body),
      text: () => Promise.resolve(JSON.stringify(response.body ?? {})),
      headers: new Headers(),
    });
  }
  return impl;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAgent(overrides: Partial<Agent> & { id: string; name: string }): Agent {
  return {
    status: "RUNNING",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const BASE_PARAMS: Omit<AgentStatusParams, "fetchImpl"> = {
  projectId: "proj-123",
  auth: { keyId: "test-key-id", secret: "test-secret" },
  configuredAgents: [
    { id: "agent-1", name: "code-reviewer", endpoint: "https://agent-1.example.com" },
    { id: "agent-2", name: "search-agent", endpoint: "https://agent-2.example.com" },
  ],
  baseUrl: "https://test-api.example.com/api/v1",
  iamUrl: "https://iam.test/token",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("mapAgentHealth", () => {
  it("maps RUNNING to healthy", () => {
    expect(mapAgentHealth("RUNNING")).toBe("healthy");
  });

  it("maps degraded statuses correctly", () => {
    const degraded: AgentStatus[] = [
      "SUSPENDED",
      "COOLED",
      "PULLING",
      "RESOURCE_ALLOCATION",
      "LLM_UNAVAILABLE",
      "TOOL_UNAVAILABLE",
      "ON_SUSPENSION",
    ];
    for (const status of degraded) {
      expect(mapAgentHealth(status)).toBe("degraded");
    }
  });

  it("maps failed statuses correctly", () => {
    const failed: AgentStatus[] = ["FAILED", "DELETED", "IMAGE_UNAVAILABLE"];
    for (const status of failed) {
      expect(mapAgentHealth(status)).toBe("failed");
    }
  });

  it("maps unknown statuses correctly", () => {
    const unknown: AgentStatus[] = ["UNKNOWN", "ON_DELETION"];
    for (const status of unknown) {
      expect(mapAgentHealth(status)).toBe("unknown");
    }
  });
});

describe("getAgentStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns healthy agents with correct health mapping", async () => {
    const liveAgents: Agent[] = [
      makeAgent({
        id: "agent-1",
        name: "code-reviewer",
        status: "RUNNING",
        endpoint: "https://agent-1.example.com",
      }),
      makeAgent({
        id: "agent-2",
        name: "search-agent",
        status: "RUNNING",
        endpoint: "https://agent-2.example.com",
      }),
    ];

    const fetchImpl = createMockFetch([
      { status: 200, body: IAM_TOKEN_RESPONSE },
      { status: 200, body: { data: liveAgents, total: 2 } },
    ]);

    const result = await getAgentStatus({
      ...BASE_PARAMS,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].health).toBe("healthy");
    expect(result.entries[0].configured).toBe(true);
    expect(result.entries[0].drift).toBe(false);
    expect(result.summary).toEqual({ total: 2, healthy: 2, degraded: 0, failed: 0, unknown: 0 });
  });

  it("detects drift when agent is deleted from Cloud.ru", async () => {
    // Only agent-2 exists in the API; agent-1 was deleted
    const liveAgents: Agent[] = [
      makeAgent({
        id: "agent-2",
        name: "search-agent",
        status: "RUNNING",
        endpoint: "https://agent-2.example.com",
      }),
    ];

    const fetchImpl = createMockFetch([
      { status: 200, body: IAM_TOKEN_RESPONSE },
      { status: 200, body: { data: liveAgents, total: 1 } },
    ]);

    const result = await getAgentStatus({
      ...BASE_PARAMS,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const deleted = result.entries.find((e) => e.id === "agent-1");
    expect(deleted).toBeDefined();
    expect(deleted!.drift).toBe(true);
    expect(deleted!.status).toBe("DELETED");
    expect(deleted!.health).toBe("failed");
    expect(deleted!.driftReason).toContain("not found in Cloud.ru");
  });

  it("detects drift when endpoint has changed", async () => {
    const liveAgents: Agent[] = [
      makeAgent({
        id: "agent-1",
        name: "code-reviewer",
        status: "RUNNING",
        endpoint: "https://agent-1-NEW.example.com", // changed!
      }),
      makeAgent({
        id: "agent-2",
        name: "search-agent",
        status: "RUNNING",
        endpoint: "https://agent-2.example.com",
      }),
    ];

    const fetchImpl = createMockFetch([
      { status: 200, body: IAM_TOKEN_RESPONSE },
      { status: 200, body: { data: liveAgents, total: 2 } },
    ]);

    const result = await getAgentStatus({
      ...BASE_PARAMS,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const drifted = result.entries.find((e) => e.id === "agent-1");
    expect(drifted!.drift).toBe(true);
    expect(drifted!.driftReason).toContain("Endpoint changed");
    expect(drifted!.endpoint).toBe("https://agent-1-NEW.example.com");
  });

  it("returns auth error for IAM failure", async () => {
    const fetchImpl = createMockFetch([{ status: 401, body: { message: "invalid credentials" } }]);

    const result = await getAgentStatus({
      ...BASE_PARAMS,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errorType).toBe("auth");
    expect(result.error).toContain("IAM auth failed");
  });

  it("returns API error for non-auth HTTP errors", async () => {
    const fetchImpl = createMockFetch([
      { status: 200, body: IAM_TOKEN_RESPONSE },
      { status: 404, body: { message: "project not found" } },
    ]);

    const result = await getAgentStatus({
      ...BASE_PARAMS,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errorType).toBe("api");
    expect(result.error).toContain("404");
  });

  it("returns network error for connection failures", async () => {
    const cause = Object.assign(new Error("getaddrinfo ENOTFOUND api.example.com"), {
      code: "ENOTFOUND",
    });
    // IAM succeeds, then API call fails with network error
    const fetchImpl = vi.fn();
    fetchImpl.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(IAM_TOKEN_RESPONSE),
      text: () => Promise.resolve(JSON.stringify(IAM_TOKEN_RESPONSE)),
      headers: new Headers(),
    });
    fetchImpl.mockRejectedValueOnce(new TypeError("fetch failed", { cause }));

    const result = await getAgentStatus({
      ...BASE_PARAMS,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errorType).toBe("network");
    expect(result.error).toContain("ENOTFOUND");
  });

  it("returns config error when projectId is missing", async () => {
    const result = await getAgentStatus({
      ...BASE_PARAMS,
      projectId: "",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errorType).toBe("config");
    expect(result.error).toContain("projectId");
  });

  it("returns config error when credentials are missing", async () => {
    const result = await getAgentStatus({
      ...BASE_PARAMS,
      auth: { keyId: "", secret: "" },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errorType).toBe("config");
    expect(result.error).toContain("credentials");
  });

  it("filters agents by name (case-insensitive)", async () => {
    const liveAgents: Agent[] = [
      makeAgent({
        id: "agent-1",
        name: "code-reviewer",
        status: "RUNNING",
        endpoint: "https://agent-1.example.com",
      }),
      makeAgent({
        id: "agent-2",
        name: "search-agent",
        status: "RUNNING",
        endpoint: "https://agent-2.example.com",
      }),
    ];

    const fetchImpl = createMockFetch([
      { status: 200, body: IAM_TOKEN_RESPONSE },
      { status: 200, body: { data: liveAgents, total: 2 } },
    ]);

    const result = await getAgentStatus({
      ...BASE_PARAMS,
      nameFilter: "Code",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].name).toBe("code-reviewer");
  });

  it("returns empty entries when filter matches nothing", async () => {
    const liveAgents: Agent[] = [
      makeAgent({
        id: "agent-1",
        name: "code-reviewer",
        status: "RUNNING",
        endpoint: "https://agent-1.example.com",
      }),
    ];

    const fetchImpl = createMockFetch([
      { status: 200, body: IAM_TOKEN_RESPONSE },
      { status: 200, body: { data: liveAgents, total: 1 } },
    ]);

    const result = await getAgentStatus({
      ...BASE_PARAMS,
      nameFilter: "nonexistent",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.entries).toHaveLength(0);
    expect(result.summary.total).toBe(0);
  });

  it("includes live agents not in config (unconfigured)", async () => {
    const liveAgents: Agent[] = [
      makeAgent({
        id: "agent-1",
        name: "code-reviewer",
        status: "RUNNING",
        endpoint: "https://agent-1.example.com",
      }),
      makeAgent({
        id: "agent-2",
        name: "search-agent",
        status: "RUNNING",
        endpoint: "https://agent-2.example.com",
      }),
      makeAgent({
        id: "agent-3",
        name: "manual-agent",
        status: "SUSPENDED",
        endpoint: "https://agent-3.example.com",
      }),
    ];

    const fetchImpl = createMockFetch([
      { status: 200, body: IAM_TOKEN_RESPONSE },
      { status: 200, body: { data: liveAgents, total: 3 } },
    ]);

    const result = await getAgentStatus({
      ...BASE_PARAMS,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.entries).toHaveLength(3);
    const unconfigured = result.entries.find((e) => e.id === "agent-3");
    expect(unconfigured).toBeDefined();
    expect(unconfigured!.configured).toBe(false);
    expect(unconfigured!.drift).toBe(false);
    expect(unconfigured!.health).toBe("degraded");
  });

  it("works with no configured agents (shows all live agents)", async () => {
    const liveAgents: Agent[] = [
      makeAgent({
        id: "agent-1",
        name: "code-reviewer",
        status: "RUNNING",
        endpoint: "https://agent-1.example.com",
      }),
    ];

    const fetchImpl = createMockFetch([
      { status: 200, body: IAM_TOKEN_RESPONSE },
      { status: 200, body: { data: liveAgents, total: 1 } },
    ]);

    const result = await getAgentStatus({
      ...BASE_PARAMS,
      configuredAgents: [],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].configured).toBe(false);
  });

  it("computes summary rollup correctly across health states", async () => {
    const liveAgents: Agent[] = [
      makeAgent({
        id: "agent-1",
        name: "code-reviewer",
        status: "RUNNING",
        endpoint: "https://agent-1.example.com",
      }),
      makeAgent({
        id: "agent-2",
        name: "search-agent",
        status: "SUSPENDED",
        endpoint: "https://agent-2.example.com",
      }),
      makeAgent({ id: "agent-3", name: "failed-agent", status: "FAILED" }),
      makeAgent({ id: "agent-4", name: "unknown-agent", status: "UNKNOWN" }),
    ];

    const fetchImpl = createMockFetch([
      { status: 200, body: IAM_TOKEN_RESPONSE },
      { status: 200, body: { data: liveAgents, total: 4 } },
    ]);

    const result = await getAgentStatus({
      ...BASE_PARAMS,
      configuredAgents: [],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.summary).toEqual({
      total: 4,
      healthy: 1,
      degraded: 1,
      failed: 1,
      unknown: 1,
    });
  });

  it("AI Fabric not enabled returns config error when projectId empty", async () => {
    const result = await getAgentStatus({
      ...BASE_PARAMS,
      projectId: "",
      configuredAgents: [],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errorType).toBe("config");
  });
});

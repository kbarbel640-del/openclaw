import { vi, describe, it, expect } from "vitest";
import { resolveDefaultModelForAgent } from "../agents/model-selection.js";
import { getStatusSummary } from "./status.summary.js";

// Mock loadConfig
const { loadConfig } = vi.hoisted(() => ({
  loadConfig: vi.fn(),
}));

vi.mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    loadConfig,
  };
});

// Mock other dependencies
vi.mock("../config/sessions.js", () => ({
  loadSessionStore: vi.fn(() => ({})),
  resolveMainSessionKey: vi.fn(() => "agent:main:global:default"),
  resolveStorePath: vi.fn(() => "/tmp/session"),
  resolveFreshSessionTotalTokens: vi.fn(() => 0),
  resolveSessionAgentId: vi.fn(() => "main"),
}));

vi.mock("../gateway/session-utils.js", () => ({
  listAgentsForGateway: vi.fn(() => ({
    defaultId: "main",
    agents: [{ id: "main" }],
  })),
}));

vi.mock("../infra/channel-summary.js", () => ({
  buildChannelSummary: vi.fn(() => ({ total: 0, channels: [] })),
}));

vi.mock("../infra/heartbeat-runner.js", () => ({
  resolveHeartbeatSummaryForAgent: vi.fn(() => ({
    enabled: false,
    every: "none",
    everyMs: 0,
  })),
}));

vi.mock("../infra/system-events.js", () => ({
  peekSystemEvents: vi.fn(() => []),
}));

vi.mock("./status.link-channel.js", () => ({
  resolveLinkChannelContext: vi.fn(() => undefined),
}));

describe("Model Resolution Divergence", () => {
  it("shows divergence between status summary and agent model resolution", async () => {
    // Config with global default model AND specific agent override
    const config = {
      agents: {
        defaults: {
          model: "openai/gpt-4o",
        },
        list: [
          // This agent override will be ignored by status summary but used by agent
          { id: "main", model: "anthropic/claude-2" },
        ],
      },
    };
    loadConfig.mockReturnValue(config);

    // Get status summary (simulates /status output)
    const summary = await getStatusSummary();
    const statusModel = summary.sessions.defaults.model;

    // Get actual resolved model for the agent (simulates runtime execution)
    const resolved = resolveDefaultModelForAgent({ cfg: config, agentId: "main" });
    const runtimeModel = resolved.model;

    console.log(`Status Model: ${statusModel}`);
    console.log(`Runtime Model: ${runtimeModel}`);

    // Expect them to be the same because status summary now uses agent resolution
    expect(statusModel).toBe(runtimeModel);
    expect(statusModel).toBe("claude-2");
    expect(runtimeModel).toBe("claude-2");
  });
});

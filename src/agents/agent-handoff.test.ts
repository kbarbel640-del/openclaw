import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import type { AgentConfig } from "../config/types.agents.js";
import {
  canInitiateHandoff,
  executeHandoff,
  getHandoffConfig,
  getHandoffSources,
  getHandoffTargets,
  prepareHandoffContext,
  shouldTransferContext,
  validateHandoffPermissions,
  type HandoffContext,
} from "./agent-handoff.js";

function createMockConfig(agents: AgentConfig[]): OpenClawConfig {
  return {
    agents: {
      list: agents,
    },
  } as OpenClawConfig;
}

describe("validateHandoffPermissions", () => {
  it("should allow handoff when no restrictions configured", () => {
    const cfg = createMockConfig([
      { id: "agent-a" } as AgentConfig,
      { id: "agent-b" } as AgentConfig,
    ]);

    const result = validateHandoffPermissions(cfg, "agent-a", "agent-b");
    expect(result.allowed).toBe(true);
  });

  it("should allow handoff when source agent uses wildcard", () => {
    const cfg = createMockConfig([
      {
        id: "agent-a",
        orchestration: {
          handoff: {
            allowAgents: ["*"],
          },
        },
      } as AgentConfig,
      { id: "agent-b" } as AgentConfig,
    ]);

    const result = validateHandoffPermissions(cfg, "agent-a", "agent-b");
    expect(result.allowed).toBe(true);
  });

  it("should allow handoff when target agent uses wildcard", () => {
    const cfg = createMockConfig([
      { id: "agent-a" } as AgentConfig,
      {
        id: "agent-b",
        orchestration: {
          handoff: {
            allowFrom: ["*"],
          },
        },
      } as AgentConfig,
    ]);

    const result = validateHandoffPermissions(cfg, "agent-a", "agent-b");
    expect(result.allowed).toBe(true);
  });

  it("should allow handoff when both agents explicitly allow each other", () => {
    const cfg = createMockConfig([
      {
        id: "agent-a",
        orchestration: {
          handoff: {
            allowAgents: ["agent-b"],
          },
        },
      } as AgentConfig,
      {
        id: "agent-b",
        orchestration: {
          handoff: {
            allowFrom: ["agent-a"],
          },
        },
      } as AgentConfig,
    ]);

    const result = validateHandoffPermissions(cfg, "agent-a", "agent-b");
    expect(result.allowed).toBe(true);
  });

  it("should deny handoff when source agent does not allow target", () => {
    const cfg = createMockConfig([
      {
        id: "agent-a",
        orchestration: {
          handoff: {
            allowAgents: ["agent-c"],
          },
        },
      } as AgentConfig,
      { id: "agent-b" } as AgentConfig,
    ]);

    const result = validateHandoffPermissions(cfg, "agent-a", "agent-b");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("does not allow handoff to");
  });

  it("should deny handoff when target agent does not allow source", () => {
    const cfg = createMockConfig([
      { id: "agent-a" } as AgentConfig,
      {
        id: "agent-b",
        orchestration: {
          handoff: {
            allowFrom: ["agent-c"],
          },
        },
      } as AgentConfig,
    ]);

    const result = validateHandoffPermissions(cfg, "agent-a", "agent-b");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("does not accept handoff from");
  });

  it("should deny handoff when source agent does not exist", () => {
    const cfg = createMockConfig([{ id: "agent-b" } as AgentConfig]);

    const result = validateHandoffPermissions(cfg, "agent-a", "agent-b");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Source agent not found");
  });

  it("should deny handoff when target agent does not exist", () => {
    const cfg = createMockConfig([{ id: "agent-a" } as AgentConfig]);

    const result = validateHandoffPermissions(cfg, "agent-a", "agent-b");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Target agent not found");
  });

  it("should deny handoff when no agents configured", () => {
    const cfg = createMockConfig([]);

    const result = validateHandoffPermissions(cfg, "agent-a", "agent-b");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("No agents configured");
  });
});

describe("shouldTransferContext", () => {
  it("should return false when transferContext not configured", () => {
    const fromAgent = { id: "agent-a" } as AgentConfig;
    const toAgent = { id: "agent-b" } as AgentConfig;

    const result = shouldTransferContext(fromAgent, toAgent);
    expect(result).toBe(false);
  });

  it("should return true when transferContext is true", () => {
    const fromAgent = {
      id: "agent-a",
      orchestration: {
        handoff: {
          transferContext: true,
        },
      },
    } as AgentConfig;
    const toAgent = { id: "agent-b" } as AgentConfig;

    const result = shouldTransferContext(fromAgent, toAgent);
    expect(result).toBe(true);
  });

  it("should return false when transferContext is explicitly false", () => {
    const fromAgent = {
      id: "agent-a",
      orchestration: {
        handoff: {
          transferContext: false,
        },
      },
    } as AgentConfig;
    const toAgent = { id: "agent-b" } as AgentConfig;

    const result = shouldTransferContext(fromAgent, toAgent);
    expect(result).toBe(false);
  });
});

describe("prepareHandoffContext", () => {
  it("should return undefined when transfer not enabled", () => {
    const context: HandoffContext = {
      originalMessage: "test message",
      messages: [],
    };

    const result = prepareHandoffContext(context, false);
    expect(result).toBeUndefined();
  });

  it("should return undefined when context is undefined", () => {
    const result = prepareHandoffContext(undefined, true);
    expect(result).toBeUndefined();
  });

  it("should sanitize and copy context when enabled", () => {
    const context: HandoffContext = {
      originalMessage: "test message",
      handoffReason: "complexity",
      messages: [{ role: "user", content: "hello" }],
      metadata: { sessionId: "123" },
      state: { counter: 42 },
    };

    const result = prepareHandoffContext(context, true);
    expect(result).toBeDefined();
    expect(result?.originalMessage).toBe("test message");
    expect(result?.handoffReason).toBe("complexity");
    expect(result?.messages).toEqual([{ role: "user", content: "hello" }]);
    expect(result?.metadata).toEqual({ sessionId: "123" });
    expect(result?.state).toEqual({ counter: 42 });
  });

  it("should only include present fields in sanitized context", () => {
    const context: HandoffContext = {
      originalMessage: "test message",
    };

    const result = prepareHandoffContext(context, true);
    expect(result).toBeDefined();
    expect(result?.originalMessage).toBe("test message");
    expect(result?.handoffReason).toBeUndefined();
    expect(result?.messages).toBeUndefined();
    expect(result?.metadata).toBeUndefined();
    expect(result?.state).toBeUndefined();
  });
});

describe("executeHandoff", () => {
  it("should successfully execute handoff with no restrictions", () => {
    const cfg = createMockConfig([
      { id: "agent-a" } as AgentConfig,
      { id: "agent-b" } as AgentConfig,
    ]);

    const result = executeHandoff({
      cfg,
      fromAgentId: "agent-a",
      toAgentId: "agent-b",
    });

    expect(result.success).toBe(true);
    expect(result.fromAgentId).toBe("agent-a");
    expect(result.toAgentId).toBe("agent-b");
    expect(result.contextTransferred).toBe(false);
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it("should transfer context when enabled", () => {
    const cfg = createMockConfig([
      {
        id: "agent-a",
        orchestration: {
          handoff: {
            transferContext: true,
          },
        },
      } as AgentConfig,
      { id: "agent-b" } as AgentConfig,
    ]);

    const context: HandoffContext = {
      originalMessage: "test message",
    };

    const result = executeHandoff({
      cfg,
      fromAgentId: "agent-a",
      toAgentId: "agent-b",
      context,
    });

    expect(result.success).toBe(true);
    expect(result.contextTransferred).toBe(true);
  });

  it("should not transfer context when disabled", () => {
    const cfg = createMockConfig([
      {
        id: "agent-a",
        orchestration: {
          handoff: {
            transferContext: false,
          },
        },
      } as AgentConfig,
      { id: "agent-b" } as AgentConfig,
    ]);

    const context: HandoffContext = {
      originalMessage: "test message",
    };

    const result = executeHandoff({
      cfg,
      fromAgentId: "agent-a",
      toAgentId: "agent-b",
      context,
    });

    expect(result.success).toBe(true);
    expect(result.contextTransferred).toBe(false);
  });

  it("should fail when permissions deny handoff", () => {
    const cfg = createMockConfig([
      {
        id: "agent-a",
        orchestration: {
          handoff: {
            allowAgents: ["agent-c"],
          },
        },
      } as AgentConfig,
      { id: "agent-b" } as AgentConfig,
    ]);

    const result = executeHandoff({
      cfg,
      fromAgentId: "agent-a",
      toAgentId: "agent-b",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("does not allow handoff to");
  });

  it("should succeed when forced even if permissions deny", () => {
    const cfg = createMockConfig([
      {
        id: "agent-a",
        orchestration: {
          handoff: {
            allowAgents: ["agent-c"],
          },
        },
      } as AgentConfig,
      { id: "agent-b" } as AgentConfig,
    ]);

    const result = executeHandoff({
      cfg,
      fromAgentId: "agent-a",
      toAgentId: "agent-b",
      force: true,
    });

    expect(result.success).toBe(true);
  });

  it("should fail when source agent does not exist", () => {
    const cfg = createMockConfig([{ id: "agent-b" } as AgentConfig]);

    const result = executeHandoff({
      cfg,
      fromAgentId: "agent-a",
      toAgentId: "agent-b",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Source agent not found");
  });

  it("should fail when target agent does not exist", () => {
    const cfg = createMockConfig([{ id: "agent-a" } as AgentConfig]);

    const result = executeHandoff({
      cfg,
      fromAgentId: "agent-a",
      toAgentId: "agent-b",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Target agent not found");
  });
});

describe("getHandoffConfig", () => {
  it("should return handoff config when present", () => {
    const cfg = createMockConfig([
      {
        id: "agent-a",
        orchestration: {
          handoff: {
            allowAgents: ["agent-b"],
          },
        },
      } as AgentConfig,
    ]);

    const result = getHandoffConfig(cfg, "agent-a");
    expect(result).toBeDefined();
    expect(result?.allowAgents).toEqual(["agent-b"]);
  });

  it("should return undefined when agent has no handoff config", () => {
    const cfg = createMockConfig([{ id: "agent-a" } as AgentConfig]);

    const result = getHandoffConfig(cfg, "agent-a");
    expect(result).toBeUndefined();
  });

  it("should return undefined when agent does not exist", () => {
    const cfg = createMockConfig([]);

    const result = getHandoffConfig(cfg, "agent-a");
    expect(result).toBeUndefined();
  });
});

describe("canInitiateHandoff", () => {
  it("should return true when agent has handoff config", () => {
    const cfg = createMockConfig([
      {
        id: "agent-a",
        orchestration: {
          handoff: {
            allowAgents: ["agent-b"],
          },
        },
      } as AgentConfig,
    ]);

    const result = canInitiateHandoff(cfg, "agent-a");
    expect(result).toBe(true);
  });

  it("should return false when agent has no handoff config", () => {
    const cfg = createMockConfig([{ id: "agent-a" } as AgentConfig]);

    const result = canInitiateHandoff(cfg, "agent-a");
    expect(result).toBe(false);
  });
});

describe("getHandoffTargets", () => {
  it("should return empty array when no handoff config", () => {
    const cfg = createMockConfig([{ id: "agent-a" } as AgentConfig]);

    const result = getHandoffTargets(cfg, "agent-a");
    expect(result).toEqual([]);
  });

  it("should return specific agents from allowAgents list", () => {
    const cfg = createMockConfig([
      {
        id: "agent-a",
        orchestration: {
          handoff: {
            allowAgents: ["agent-b", "agent-c"],
          },
        },
      } as AgentConfig,
    ]);

    const result = getHandoffTargets(cfg, "agent-a");
    expect(result).toEqual(["agent-b", "agent-c"]);
  });

  it("should return all other agents when wildcard is used", () => {
    const cfg = createMockConfig([
      {
        id: "agent-a",
        orchestration: {
          handoff: {
            allowAgents: ["*"],
          },
        },
      } as AgentConfig,
      { id: "agent-b" } as AgentConfig,
      { id: "agent-c" } as AgentConfig,
    ]);

    const result = getHandoffTargets(cfg, "agent-a");
    expect(result).toContain("agent-b");
    expect(result).toContain("agent-c");
    expect(result).not.toContain("agent-a");
  });

  it("should return empty array when allowAgents is empty", () => {
    const cfg = createMockConfig([
      {
        id: "agent-a",
        orchestration: {
          handoff: {
            allowAgents: [],
          },
        },
      } as AgentConfig,
    ]);

    const result = getHandoffTargets(cfg, "agent-a");
    expect(result).toEqual([]);
  });
});

describe("getHandoffSources", () => {
  it("should return empty array when no handoff config", () => {
    const cfg = createMockConfig([{ id: "agent-a" } as AgentConfig]);

    const result = getHandoffSources(cfg, "agent-a");
    expect(result).toEqual([]);
  });

  it("should return specific agents from allowFrom list", () => {
    const cfg = createMockConfig([
      {
        id: "agent-a",
        orchestration: {
          handoff: {
            allowFrom: ["agent-b", "agent-c"],
          },
        },
      } as AgentConfig,
    ]);

    const result = getHandoffSources(cfg, "agent-a");
    expect(result).toEqual(["agent-b", "agent-c"]);
  });

  it("should return all other agents when wildcard is used", () => {
    const cfg = createMockConfig([
      {
        id: "agent-a",
        orchestration: {
          handoff: {
            allowFrom: ["*"],
          },
        },
      } as AgentConfig,
      { id: "agent-b" } as AgentConfig,
      { id: "agent-c" } as AgentConfig,
    ]);

    const result = getHandoffSources(cfg, "agent-a");
    expect(result).toContain("agent-b");
    expect(result).toContain("agent-c");
    expect(result).not.toContain("agent-a");
  });

  it("should return empty array when allowFrom is empty", () => {
    const cfg = createMockConfig([
      {
        id: "agent-a",
        orchestration: {
          handoff: {
            allowFrom: [],
          },
        },
      } as AgentConfig,
    ]);

    const result = getHandoffSources(cfg, "agent-a");
    expect(result).toEqual([]);
  });
});

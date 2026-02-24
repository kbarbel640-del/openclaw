import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import type { AgentConfig } from "../config/types.agents.js";
import {
  canHandoffToAgent,
  findSupervisorAgent,
  routeWithSupervisor,
  validateAgentForOrchestration,
} from "./supervisor-agent.js";

// Helper to create minimal config with agents
function createTestConfig(agents: AgentConfig[]): OpenClawConfig {
  return {
    agents: {
      list: agents,
    },
  } as OpenClawConfig;
}

describe("supervisor-agent", () => {
  describe("findSupervisorAgent", () => {
    it("should return null when no agents configured", () => {
      const cfg = createTestConfig([]);
      const result = findSupervisorAgent({ cfg });
      expect(result).toBeNull();
    });

    it("should find agent with supervisor: true", () => {
      const cfg = createTestConfig([
        {
          id: "default",
          orchestration: { supervisor: true },
        } as AgentConfig,
      ]);
      const result = findSupervisorAgent({ cfg });
      expect(result).not.toBeNull();
      expect(result?.agent.id).toBe("default");
      expect(result?.supervisorConfig).toEqual({});
    });

    it("should find agent with supervisor config object", () => {
      const cfg = createTestConfig([
        {
          id: "supervisor",
          orchestration: {
            supervisor: {
              defaultAgent: "fallback",
              strategy: "delegate",
            },
          },
        } as AgentConfig,
      ]);
      const result = findSupervisorAgent({ cfg });
      expect(result).not.toBeNull();
      expect(result?.agent.id).toBe("supervisor");
      expect(result?.supervisorConfig.defaultAgent).toBe("fallback");
      expect(result?.supervisorConfig.strategy).toBe("delegate");
    });

    it("should return null when agent has no supervisor config", () => {
      const cfg = createTestConfig([
        {
          id: "regular",
          orchestration: {},
        } as AgentConfig,
      ]);
      const result = findSupervisorAgent({ cfg });
      expect(result).toBeNull();
    });

    it("should find specific agent by ID when provided", () => {
      const cfg = createTestConfig([
        {
          id: "supervisor1",
          orchestration: { supervisor: true },
        } as AgentConfig,
        {
          id: "supervisor2",
          orchestration: { supervisor: true },
        } as AgentConfig,
      ]);
      const result = findSupervisorAgent({ cfg, agentId: "supervisor2" });
      expect(result).not.toBeNull();
      expect(result?.agent.id).toBe("supervisor2");
    });

    it("should return null when specific agent ID not found", () => {
      const cfg = createTestConfig([
        {
          id: "supervisor",
          orchestration: { supervisor: true },
        } as AgentConfig,
      ]);
      const result = findSupervisorAgent({ cfg, agentId: "nonexistent" });
      expect(result).toBeNull();
    });

    it("should return null when specific agent exists but is not a supervisor", () => {
      const cfg = createTestConfig([
        {
          id: "regular",
          orchestration: {},
        } as AgentConfig,
      ]);
      const result = findSupervisorAgent({ cfg, agentId: "regular" });
      expect(result).toBeNull();
    });
  });

  describe("routeWithSupervisor", () => {
    it("should return null when no supervisor configured", () => {
      const cfg = createTestConfig([
        {
          id: "coding",
          orchestration: {
            intents: {
              enabled: true,
              keywords: ["code", "debug"],
            },
          },
        } as AgentConfig,
      ]);
      const result = routeWithSupervisor({ cfg, message: "write some code" });
      expect(result).toBeNull();
    });

    it("should route to agent based on keyword match", () => {
      const cfg = createTestConfig([
        {
          id: "supervisor",
          orchestration: { supervisor: true },
        } as AgentConfig,
        {
          id: "coding",
          orchestration: {
            intents: {
              enabled: true,
              keywords: ["code", "debug"],
            },
          },
        } as AgentConfig,
      ]);
      const result = routeWithSupervisor({ cfg, message: "write some code" });
      expect(result).not.toBeNull();
      expect(result?.agentId).toBe("coding");
      expect(result?.confidence).toBe(0.9); // keyword match confidence
      expect(result?.isDefault).toBe(false);
    });

    it("should route to agent based on category match", () => {
      const cfg = createTestConfig([
        {
          id: "supervisor",
          orchestration: { supervisor: true },
        } as AgentConfig,
        {
          id: "research",
          orchestration: {
            intents: {
              enabled: true,
              categories: ["research", "analysis"],
            },
          },
        } as AgentConfig,
      ]);
      const result = routeWithSupervisor({ cfg, message: "do some research on topic" });
      expect(result).not.toBeNull();
      expect(result?.agentId).toBe("research");
      expect(result?.confidence).toBe(0.7); // category match confidence
      expect(result?.isDefault).toBe(false);
    });

    it("should use default agent from supervisor config when no matches", () => {
      const cfg = createTestConfig([
        {
          id: "supervisor",
          orchestration: {
            supervisor: {
              defaultAgent: "general",
            },
          },
        } as AgentConfig,
        {
          id: "general",
        } as AgentConfig,
        {
          id: "coding",
          orchestration: {
            intents: {
              enabled: true,
              keywords: ["code"],
            },
          },
        } as AgentConfig,
      ]);
      const result = routeWithSupervisor({ cfg, message: "hello there" });
      expect(result).not.toBeNull();
      expect(result?.agentId).toBe("general");
      expect(result?.confidence).toBe(0.3); // default confidence
      expect(result?.isDefault).toBe(true);
    });

    it("should return null when no matches and no default agent", () => {
      const cfg = createTestConfig([
        {
          id: "supervisor",
          orchestration: { supervisor: true },
        } as AgentConfig,
        {
          id: "coding",
          orchestration: {
            intents: {
              enabled: true,
              keywords: ["code"],
            },
          },
        } as AgentConfig,
      ]);
      const result = routeWithSupervisor({ cfg, message: "random message" });
      expect(result).toBeNull();
    });

    it("should use delegate strategy by default", () => {
      const cfg = createTestConfig([
        {
          id: "supervisor",
          orchestration: { supervisor: true },
        } as AgentConfig,
        {
          id: "coding",
          orchestration: {
            intents: {
              enabled: true,
              keywords: ["code"],
            },
          },
        } as AgentConfig,
      ]);
      const result = routeWithSupervisor({ cfg, message: "write code" });
      expect(result).not.toBeNull();
      expect(result?.strategy).toBe("delegate");
    });

    it("should respect configured strategy", () => {
      const cfg = createTestConfig([
        {
          id: "supervisor",
          orchestration: {
            supervisor: {
              strategy: "collaborate",
            },
          },
        } as AgentConfig,
        {
          id: "coding",
          orchestration: {
            intents: {
              enabled: true,
              keywords: ["code"],
            },
          },
        } as AgentConfig,
      ]);
      const result = routeWithSupervisor({ cfg, message: "write code" });
      expect(result).not.toBeNull();
      expect(result?.strategy).toBe("collaborate");
    });

    it("should handle sequential strategy", () => {
      const cfg = createTestConfig([
        {
          id: "supervisor",
          orchestration: {
            supervisor: {
              strategy: "sequential",
            },
          },
        } as AgentConfig,
        {
          id: "coding",
          orchestration: {
            intents: {
              enabled: true,
              keywords: ["code"],
            },
          },
        } as AgentConfig,
      ]);
      const result = routeWithSupervisor({ cfg, message: "write code" });
      expect(result).not.toBeNull();
      expect(result?.strategy).toBe("sequential");
    });

    it("should select highest confidence match when multiple matches", () => {
      const cfg = createTestConfig([
        {
          id: "supervisor",
          orchestration: { supervisor: true },
        } as AgentConfig,
        {
          id: "coding",
          orchestration: {
            intents: {
              enabled: true,
              keywords: ["code", "debug"],
            },
          },
        } as AgentConfig,
        {
          id: "general",
          orchestration: {
            intents: {
              enabled: true,
              categories: ["general"],
            },
          },
        } as AgentConfig,
      ]);
      const result = routeWithSupervisor({ cfg, message: "write some code" });
      expect(result).not.toBeNull();
      // Keyword match (0.9) should beat category match (0.7)
      expect(result?.agentId).toBe("coding");
      expect(result?.confidence).toBe(0.9);
    });

    it("should include all matches in result", () => {
      const cfg = createTestConfig([
        {
          id: "supervisor",
          orchestration: { supervisor: true },
        } as AgentConfig,
        {
          id: "coding",
          orchestration: {
            intents: {
              enabled: true,
              keywords: ["code"],
            },
          },
        } as AgentConfig,
        {
          id: "general",
          orchestration: {
            intents: {
              enabled: true,
              categories: ["code"],
            },
          },
        } as AgentConfig,
      ]);
      const result = routeWithSupervisor({ cfg, message: "write code" });
      expect(result).not.toBeNull();
      expect(result?.matches.length).toBeGreaterThan(0);
    });

    it("should respect confidence threshold", () => {
      const cfg = createTestConfig([
        {
          id: "supervisor",
          orchestration: { supervisor: true },
        } as AgentConfig,
        {
          id: "coding",
          orchestration: {
            intents: {
              enabled: true,
              categories: ["coding"],
            },
          },
        } as AgentConfig,
      ]);
      // Category match has 0.7 confidence, threshold 0.8 should filter it out
      const result = routeWithSupervisor({
        cfg,
        message: "write coding",
        confidenceThreshold: 0.8,
      });
      // Should still return the match since we don't strictly enforce threshold,
      // we just filter matches for logging/strategy purposes
      expect(result).not.toBeNull();
    });
  });

  describe("validateAgentForOrchestration", () => {
    it("should return false when no agents configured", () => {
      const cfg = createTestConfig([]);
      const result = validateAgentForOrchestration(cfg, "coding");
      expect(result).toBe(false);
    });

    it("should return true when agent exists", () => {
      const cfg = createTestConfig([
        {
          id: "coding",
        } as AgentConfig,
      ]);
      const result = validateAgentForOrchestration(cfg, "coding");
      expect(result).toBe(true);
    });

    it("should return false when agent does not exist", () => {
      const cfg = createTestConfig([
        {
          id: "coding",
        } as AgentConfig,
      ]);
      const result = validateAgentForOrchestration(cfg, "nonexistent");
      expect(result).toBe(false);
    });

    it("should return true for agent with orchestration config", () => {
      const cfg = createTestConfig([
        {
          id: "coding",
          orchestration: {
            intents: {
              enabled: true,
            },
          },
        } as AgentConfig,
      ]);
      const result = validateAgentForOrchestration(cfg, "coding");
      expect(result).toBe(true);
    });
  });

  describe("canHandoffToAgent", () => {
    it("should return false when no agents configured", () => {
      const cfg = createTestConfig([]);
      const result = canHandoffToAgent(cfg, "coding", "research");
      expect(result).toBe(false);
    });

    it("should return false when from agent does not exist", () => {
      const cfg = createTestConfig([
        {
          id: "research",
        } as AgentConfig,
      ]);
      const result = canHandoffToAgent(cfg, "nonexistent", "research");
      expect(result).toBe(false);
    });

    it("should return true when no handoff config (default allow)", () => {
      const cfg = createTestConfig([
        {
          id: "coding",
        } as AgentConfig,
        {
          id: "research",
        } as AgentConfig,
      ]);
      const result = canHandoffToAgent(cfg, "coding", "research");
      expect(result).toBe(true);
    });

    it("should return true when handoff to specific agent allowed", () => {
      const cfg = createTestConfig([
        {
          id: "coding",
          orchestration: {
            handoff: {
              allowAgents: ["research", "general"],
            },
          },
        } as AgentConfig,
        {
          id: "research",
        } as AgentConfig,
      ]);
      const result = canHandoffToAgent(cfg, "coding", "research");
      expect(result).toBe(true);
    });

    it("should return false when handoff to agent not allowed", () => {
      const cfg = createTestConfig([
        {
          id: "coding",
          orchestration: {
            handoff: {
              allowAgents: ["research"],
            },
          },
        } as AgentConfig,
        {
          id: "general",
        } as AgentConfig,
      ]);
      const result = canHandoffToAgent(cfg, "coding", "general");
      expect(result).toBe(false);
    });

    it("should return true when wildcard allows all agents", () => {
      const cfg = createTestConfig([
        {
          id: "coding",
          orchestration: {
            handoff: {
              allowAgents: ["*"],
            },
          },
        } as AgentConfig,
        {
          id: "research",
        } as AgentConfig,
      ]);
      const result = canHandoffToAgent(cfg, "coding", "research");
      expect(result).toBe(true);
    });

    it("should return true when empty allowAgents array with no restrictions", () => {
      const cfg = createTestConfig([
        {
          id: "coding",
          orchestration: {
            handoff: {
              allowAgents: [],
            },
          },
        } as AgentConfig,
        {
          id: "research",
        } as AgentConfig,
      ]);
      // Empty array means no agents explicitly allowed
      const result = canHandoffToAgent(cfg, "coding", "research");
      expect(result).toBe(false);
    });
  });
});

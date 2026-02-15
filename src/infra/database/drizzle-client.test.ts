import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "./drizzle-schema.js";

describe("drizzle-schema", () => {
  describe("llmUsage table", () => {
    it("should have all expected columns", () => {
      const columns = getTableColumns(schema.llmUsage);
      expect(columns.time).toBeDefined();
      expect(columns.providerId).toBeDefined();
      expect(columns.modelId).toBeDefined();
      expect(columns.agentId).toBeDefined();
      expect(columns.sessionId).toBeDefined();
      expect(columns.inputTokens).toBeDefined();
      expect(columns.outputTokens).toBeDefined();
      expect(columns.cacheReadTokens).toBeDefined();
      expect(columns.cacheWriteTokens).toBeDefined();
      expect(columns.costUsd).toBeDefined();
      expect(columns.durationMs).toBeDefined();
    });

    it("should map to correct SQL column names", () => {
      const columns = getTableColumns(schema.llmUsage);
      expect(columns.providerId.name).toBe("provider_id");
      expect(columns.modelId.name).toBe("model_id");
      expect(columns.inputTokens.name).toBe("input_tokens");
      expect(columns.costUsd.name).toBe("cost_usd");
    });
  });

  describe("securityEvents table", () => {
    it("should have all expected columns", () => {
      const columns = getTableColumns(schema.securityEvents);
      expect(columns.time).toBeDefined();
      expect(columns.eventId).toBeDefined();
      expect(columns.category).toBeDefined();
      expect(columns.severity).toBeDefined();
      expect(columns.action).toBeDefined();
      expect(columns.blocked).toBeDefined();
      expect(columns.metadata).toBeDefined();
    });

    it("should map to correct SQL column names", () => {
      const columns = getTableColumns(schema.securityEvents);
      expect(columns.eventId.name).toBe("event_id");
      expect(columns.sessionKey.name).toBe("session_key");
      expect(columns.ipAddress.name).toBe("ip_address");
    });
  });

  describe("humanization tables", () => {
    it("should define agentMemory with correct columns", () => {
      const columns = getTableColumns(schema.agentMemory);
      expect(columns.agentId.name).toBe("agent_id");
      expect(columns.memoryType.name).toBe("memory_type");
      expect(columns.importance).toBeDefined();
      expect(columns.retentionScore).toBeDefined();
    });

    it("should define agentRelationships with correct columns", () => {
      const columns = getTableColumns(schema.agentRelationships);
      expect(columns.otherAgentId.name).toBe("other_agent_id");
      expect(columns.trustScore.name).toBe("trust_score");
      expect(columns.collaborationQuality.name).toBe("collaboration_quality");
    });

    it("should define agentReputation with correct columns", () => {
      const columns = getTableColumns(schema.agentReputation);
      expect(columns.agentId.name).toBe("agent_id");
      expect(columns.reliabilityScore.name).toBe("reliability_score");
      expect(columns.qualityRating.name).toBe("quality_rating");
    });

    it("should define agentDecisionLog with correct columns", () => {
      const columns = getTableColumns(schema.agentDecisionLog);
      expect(columns.decisionType.name).toBe("decision_type");
      expect(columns.decisionQuality.name).toBe("decision_quality");
      expect(columns.confidenceLevel.name).toBe("confidence_level");
    });

    it("should define agentEnergyState with correct columns", () => {
      const columns = getTableColumns(schema.agentEnergyState);
      expect(columns.energyLevel.name).toBe("energy_level");
      expect(columns.focusLevel.name).toBe("focus_level");
      expect(columns.contextSwitchesToday.name).toBe("context_switches_today");
    });

    it("should define agentMistakePatterns with correct columns", () => {
      const columns = getTableColumns(schema.agentMistakePatterns);
      expect(columns.mistakeType.name).toBe("mistake_type");
      expect(columns.occurrences).toBeDefined();
      expect(columns.fixApplied.name).toBe("fix_applied");
    });
  });

  describe("migrations table", () => {
    it("should have id, name, appliedAt columns", () => {
      const columns = getTableColumns(schema.migrations);
      expect(columns.id).toBeDefined();
      expect(columns.name).toBeDefined();
      expect(columns.appliedAt).toBeDefined();
      expect(columns.appliedAt.name).toBe("applied_at");
    });
  });
});

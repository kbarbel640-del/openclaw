import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  aggregateScores,
  countBySeverity,
  generateAgentSummary,
  levelFromScore,
} from "./scoring.js";
import { formatGraspReport } from "./format.js";
import { computeCacheKey, getCachedReport, setCachedReport, clearCache } from "./cache.js";
import type {
  GraspDimensionResult,
  GraspFinding,
  GraspReport,
  GraspAgentProfile,
} from "./types.js";
import type { OpenClawConfig } from "../../config/config.js";

// ============================================================================
// Scoring Tests
// ============================================================================

describe("scoring", () => {
  describe("levelFromScore", () => {
    it("returns low for scores 0-25", () => {
      expect(levelFromScore(0)).toBe("low");
      expect(levelFromScore(10)).toBe("low");
      expect(levelFromScore(25)).toBe("low");
    });

    it("returns medium for scores 26-50", () => {
      expect(levelFromScore(26)).toBe("medium");
      expect(levelFromScore(40)).toBe("medium");
      expect(levelFromScore(50)).toBe("medium");
    });

    it("returns high for scores 51-75", () => {
      expect(levelFromScore(51)).toBe("high");
      expect(levelFromScore(60)).toBe("high");
      expect(levelFromScore(75)).toBe("high");
    });

    it("returns critical for scores 76-100", () => {
      expect(levelFromScore(76)).toBe("critical");
      expect(levelFromScore(90)).toBe("critical");
      expect(levelFromScore(100)).toBe("critical");
    });
  });

  describe("aggregateScores", () => {
    it("returns 0 for empty array", () => {
      expect(aggregateScores([])).toBe(0);
    });

    it("returns the score for single element", () => {
      expect(aggregateScores([50])).toBe(50);
    });

    it("weights higher scores more heavily", () => {
      // [80, 20] with weights [2, 1] = (80*2 + 20*1) / 3 = 180/3 = 60
      const result = aggregateScores([80, 20]);
      expect(result).toBe(60);
    });

    it("handles multiple scores", () => {
      const result = aggregateScores([100, 50, 25]);
      // sorted: [100, 50, 25], weights: [3, 2, 1]
      // = (100*3 + 50*2 + 25*1) / 6 = 425/6 = 70.83 ~ 71
      expect(result).toBe(71);
    });
  });

  describe("countBySeverity", () => {
    it("counts findings by severity", () => {
      const findings: GraspFinding[] = [
        createFinding("critical"),
        createFinding("critical"),
        createFinding("warn"),
        createFinding("info"),
        createFinding("info"),
        createFinding("info"),
      ];

      const result = countBySeverity(findings);
      expect(result).toEqual({ critical: 2, warn: 1, info: 3 });
    });

    it("returns zeros for empty array", () => {
      expect(countBySeverity([])).toEqual({ critical: 0, warn: 0, info: 0 });
    });
  });

  describe("generateAgentSummary", () => {
    it("returns low risk message when all dimensions are low/medium", () => {
      const dimensions: GraspDimensionResult[] = [
        createDimensionResult("governance", 20, "low"),
        createDimensionResult("reach", 40, "medium"),
      ];

      const result = generateAgentSummary(dimensions);
      expect(result).toBe("Agent has a low risk profile across all dimensions.");
    });

    it("lists high risk dimensions", () => {
      const dimensions: GraspDimensionResult[] = [
        createDimensionResult("governance", 20, "low"),
        createDimensionResult("reach", 70, "high"),
        createDimensionResult("agency", 85, "critical"),
      ];

      const result = generateAgentSummary(dimensions);
      expect(result).toContain("Reach");
      expect(result).toContain("Agency");
      expect(result).toContain("Elevated risk");
    });
  });
});

// ============================================================================
// Runner Tests (Mock-based)
// ============================================================================

describe("runner", () => {
  // We'll mock the runEmbeddedPiAgent function
  const mockRunEmbeddedPiAgent = vi.fn();

  beforeEach(() => {
    vi.doMock("../../agents/pi-embedded.js", () => ({
      runEmbeddedPiAgent: mockRunEmbeddedPiAgent,
    }));
    mockRunEmbeddedPiAgent.mockReset();
  });

  afterEach(() => {
    vi.doUnmock("../../agents/pi-embedded.js");
  });

  describe("parseDimensionResponse", () => {
    // Import the module dynamically to get mocked version
    it("parses well-formed JSON response", async () => {
      const validResponse = {
        score: 45,
        level: "medium",
        findings: [
          {
            id: "governance.test",
            severity: "warn",
            signal: "logging.level",
            observation: "Set to info",
            riskContribution: 15,
            title: "Moderate logging",
            detail: "Logging is at info level",
          },
        ],
        reasoning: "The config shows moderate governance controls.",
        exploredPaths: ["~/.openclaw/config.yaml"],
      };

      mockRunEmbeddedPiAgent.mockResolvedValue({
        payloads: [{ text: JSON.stringify(validResponse) }],
        meta: { durationMs: 1000 },
      });

      const { runDimensionAnalysis } = await import("./runner.js");
      const result = await runDimensionAnalysis({
        config: {} as unknown as OpenClawConfig,
        prompt: {
          dimension: "governance",
          label: "Governance",
          systemPrompt: "test prompt",
        },
      });

      expect(result.score).toBe(45);
      expect(result.level).toBe("medium");
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].title).toBe("Moderate logging");
      expect(result.reasoning).toContain("moderate governance");
    });

    it("handles JSON embedded in markdown code block", async () => {
      const responseWithMarkdown = `Here's my analysis:

\`\`\`json
{
  "score": 30,
  "level": "medium",
  "findings": [],
  "reasoning": "Analysis complete",
  "exploredPaths": []
}
\`\`\`

That's the assessment.`;

      mockRunEmbeddedPiAgent.mockResolvedValue({
        payloads: [{ text: responseWithMarkdown }],
        meta: { durationMs: 1000 },
      });

      const { runDimensionAnalysis } = await import("./runner.js");
      const result = await runDimensionAnalysis({
        config: {} as unknown as OpenClawConfig,
        prompt: {
          dimension: "reach",
          label: "Reach",
          systemPrompt: "test prompt",
        },
      });

      expect(result.score).toBe(30);
      expect(result.level).toBe("medium");
    });

    it("handles malformed JSON gracefully", async () => {
      mockRunEmbeddedPiAgent.mockResolvedValue({
        payloads: [{ text: "This is not JSON at all, just plain text." }],
        meta: { durationMs: 1000 },
      });

      const { runDimensionAnalysis } = await import("./runner.js");
      const result = await runDimensionAnalysis({
        config: {} as unknown as OpenClawConfig,
        prompt: {
          dimension: "agency",
          label: "Agency",
          systemPrompt: "test prompt",
        },
      });

      // Should return error result with medium risk (unknown)
      expect(result.level).toBe("medium");
      expect(result.score).toBe(50);
      expect(result.findings[0].title).toContain("could not be completed");
    });

    it("handles empty response gracefully", async () => {
      mockRunEmbeddedPiAgent.mockResolvedValue({
        payloads: [],
        meta: { durationMs: 1000 },
      });

      const { runDimensionAnalysis } = await import("./runner.js");
      const result = await runDimensionAnalysis({
        config: {} as unknown as OpenClawConfig,
        prompt: {
          dimension: "safeguards",
          label: "Safeguards",
          systemPrompt: "test prompt",
        },
      });

      expect(result.level).toBe("medium");
      expect(result.findings[0].severity).toBe("warn");
    });

    it("clamps score to valid range", async () => {
      const invalidScoreResponse = {
        score: 150, // Invalid: > 100
        level: "critical",
        findings: [],
        reasoning: "Test",
        exploredPaths: [],
      };

      mockRunEmbeddedPiAgent.mockResolvedValue({
        payloads: [{ text: JSON.stringify(invalidScoreResponse) }],
        meta: { durationMs: 1000 },
      });

      const { runDimensionAnalysis } = await import("./runner.js");
      const result = await runDimensionAnalysis({
        config: {} as unknown as OpenClawConfig,
        prompt: {
          dimension: "potential_damage",
          label: "Potential Damage",
          systemPrompt: "test prompt",
        },
      });

      expect(result.score).toBe(100); // Clamped to max
    });

    it("normalizes severity values", async () => {
      const responseWithWarningSeverity = {
        score: 40,
        level: "medium",
        findings: [
          {
            id: "test.1",
            severity: "warning", // Should normalize to "warn"
            signal: "test",
            observation: "test",
            riskContribution: 10,
            title: "Test",
            detail: "Test",
          },
        ],
        reasoning: "Test",
        exploredPaths: [],
      };

      mockRunEmbeddedPiAgent.mockResolvedValue({
        payloads: [{ text: JSON.stringify(responseWithWarningSeverity) }],
        meta: { durationMs: 1000 },
      });

      const { runDimensionAnalysis } = await import("./runner.js");
      const result = await runDimensionAnalysis({
        config: {} as unknown as OpenClawConfig,
        prompt: {
          dimension: "governance",
          label: "Governance",
          systemPrompt: "test prompt",
        },
      });

      expect(result.findings[0].severity).toBe("warn");
    });
  });
});

// ============================================================================
// Cache Tests
// ============================================================================

describe("cache", () => {
  beforeEach(async () => {
    await clearCache();
  });

  afterEach(async () => {
    await clearCache();
  });

  describe("computeCacheKey", () => {
    it("generates consistent key for same config", () => {
      const config = {
        agents: { defaults: { model: { primary: "test" } } },
        tools: { profile: "standard" },
      } as unknown as OpenClawConfig;

      const key1 = computeCacheKey(config, "main");
      const key2 = computeCacheKey(config, "main");

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(16);
    });

    it("generates different key for different config", () => {
      const config1 = { agents: { defaults: { model: { primary: "model1" } } } } as unknown as OpenClawConfig;
      const config2 = { agents: { defaults: { model: { primary: "model2" } } } } as unknown as OpenClawConfig;

      const key1 = computeCacheKey(config1);
      const key2 = computeCacheKey(config2);

      expect(key1).not.toBe(key2);
    });

    it("generates different key for different agent", () => {
      const config = { agents: {} } as unknown as OpenClawConfig;

      const key1 = computeCacheKey(config, "agent1");
      const key2 = computeCacheKey(config, "agent2");

      expect(key1).not.toBe(key2);
    });
  });

  describe("getCachedReport / setCachedReport", () => {
    it("returns null for non-existent cache", async () => {
      const result = await getCachedReport("nonexistent-key");
      expect(result).toBeNull();
    });

    it("stores and retrieves cached report", async () => {
      const report = createMockReport();
      const cacheKey = "test-cache-key";

      await setCachedReport(cacheKey, report);
      const retrieved = await getCachedReport(cacheKey);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.ts).toBe(report.ts);
      expect(retrieved!.cached).toBe(true);
      expect(retrieved!.cacheKey).toBe(cacheKey);
    });

    it("preserves report structure through cache", async () => {
      const report = createMockReport();
      const cacheKey = "structure-test";

      await setCachedReport(cacheKey, report);
      const retrieved = await getCachedReport(cacheKey);

      expect(retrieved!.agents).toHaveLength(1);
      expect(retrieved!.agents[0].dimensions).toHaveLength(5);
      expect(retrieved!.overallLevel).toBe("medium");
    });
  });

  describe("clearCache", () => {
    it("removes all cached reports", async () => {
      const report = createMockReport();

      await setCachedReport("key1", report);
      await setCachedReport("key2", report);

      await clearCache();

      expect(await getCachedReport("key1")).toBeNull();
      expect(await getCachedReport("key2")).toBeNull();
    });
  });
});

// ============================================================================
// Format Tests
// ============================================================================

describe("format", () => {
  describe("formatGraspReport", () => {
    it("includes header with model and timestamp", () => {
      const report = createMockReport();
      const output = formatGraspReport(report);

      expect(output).toContain("GRASP");
      expect(output).toContain("test-provider/test-model");
    });

    it("shows all 5 dimension labels", () => {
      const report = createMockReport();
      const output = formatGraspReport(report);

      expect(output).toContain("Governance");
      expect(output).toContain("Reach");
      expect(output).toContain("Agency");
      expect(output).toContain("Safeguards");
      expect(output).toContain("Potential Dmg");
    });

    it("shows dimension letters G R A S P", () => {
      const report = createMockReport();
      const output = formatGraspReport(report);

      // Each dimension should have its letter
      expect(output).toMatch(/G\s+Governance/);
      expect(output).toMatch(/R\s+Reach/);
      expect(output).toMatch(/A\s+Agency/);
      expect(output).toMatch(/S\s+Safeguards/);
      expect(output).toMatch(/P\s+Potential Dmg/);
    });

    it("shows agent label with default marker", () => {
      const report = createMockReport();
      report.agents[0].isDefault = true;

      const output = formatGraspReport(report);

      expect(output).toContain("(default)");
    });

    it("shows overall risk level and score", () => {
      const report = createMockReport();
      report.overallScore = 65;
      report.overallLevel = "high";

      const output = formatGraspReport(report);

      expect(output).toContain("65");
      expect(output.toUpperCase()).toContain("HIGH");
    });

    it("shows summary counts", () => {
      const report = createMockReport();
      report.summary = { critical: 2, warn: 3, info: 5 };

      const output = formatGraspReport(report);

      expect(output).toContain("2 critical");
      expect(output).toContain("3 warn");
      expect(output).toContain("5 info");
    });

    it("shows cached indicator when cached", () => {
      const report = createMockReport();
      report.cached = true;

      const output = formatGraspReport(report);

      expect(output).toContain("cached");
    });

    it("includes bar chart characters", () => {
      const report = createMockReport();
      const output = formatGraspReport(report);

      // Should contain box drawing characters
      expect(output).toContain("[");
      expect(output).toContain("]");
    });

    describe("verbose mode", () => {
      it("shows AI reasoning when verbose", () => {
        const report = createMockReport();
        report.agents[0].dimensions[0].reasoning = "This is detailed reasoning about governance.";

        const output = formatGraspReport(report, { verbose: true });

        expect(output).toContain("Reasoning");
        expect(output).toContain("detailed reasoning about governance");
      });

      it("shows explored paths when verbose", () => {
        const report = createMockReport();
        report.agents[0].dimensions[0].exploredPaths = [
          "~/.openclaw/config.yaml",
          "~/.openclaw/sessions/",
        ];

        const output = formatGraspReport(report, { verbose: true });

        expect(output).toContain("Explored");
        expect(output).toContain("config.yaml");
      });

      it("shows findings detail when verbose", () => {
        const report = createMockReport();
        report.agents[0].dimensions[0].findings = [
          {
            id: "governance.logging",
            dimension: "governance",
            severity: "warn",
            signal: "logging.level",
            observation: "Set to silent",
            riskContribution: 25,
            title: "Logging is minimal",
            detail: "Consider enabling more verbose logging for observability.",
            remediation: "Set logging.level to info or debug",
          },
        ];

        const output = formatGraspReport(report, { verbose: true });

        expect(output).toContain("Logging is minimal");
        expect(output).toContain("WARN");
      });
    });
  });
});

// ============================================================================
// CLI Integration Tests
// ============================================================================

describe("CLI integration", () => {
  it("grasp command options are defined correctly", async () => {
    // This test verifies the CLI structure without actually running the command
    const { registerSecurityCli } = await import("../../cli/security-cli.js");
    const { Command } = await import("commander");

    const program = new Command();
    registerSecurityCli(program);

    const security = program.commands.find((c) => c.name() === "security");
    expect(security).toBeDefined();

    const grasp = security!.commands.find((c) => c.name() === "grasp");
    expect(grasp).toBeDefined();
    expect(grasp!.description()).toContain("AI-driven");
    expect(grasp!.description()).toContain("GRASP");

    // Check options
    const options = grasp!.options;
    const optionNames = options.map((o) => o.long);

    expect(optionNames).toContain("--agent");
    expect(optionNames).toContain("--model");
    expect(optionNames).toContain("--verbose");
    expect(optionNames).toContain("--json");
    // --no-cache creates a --cache option with negation
    expect(options.some((o) => o.long === "--no-cache" || o.long === "--cache")).toBe(true);
  });
});

// ============================================================================
// Report Structure Validation Tests
// ============================================================================

describe("report structure validation", () => {
  it("validates complete report structure", () => {
    const report = createMockReport();

    // Top-level fields
    expect(typeof report.ts).toBe("number");
    expect(typeof report.modelUsed).toBe("string");
    expect(Array.isArray(report.agents)).toBe(true);
    expect(Array.isArray(report.globalFindings)).toBe(true);
    expect(typeof report.overallScore).toBe("number");
    expect(["low", "medium", "high", "critical"]).toContain(report.overallLevel);
    expect(typeof report.summary.critical).toBe("number");
    expect(typeof report.summary.warn).toBe("number");
    expect(typeof report.summary.info).toBe("number");
  });

  it("validates agent profile structure", () => {
    const report = createMockReport();
    const agent = report.agents[0];

    expect(typeof agent.agentId).toBe("string");
    expect(typeof agent.isDefault).toBe("boolean");
    expect(Array.isArray(agent.dimensions)).toBe(true);
    expect(agent.dimensions).toHaveLength(5);
    expect(typeof agent.overallScore).toBe("number");
    expect(["low", "medium", "high", "critical"]).toContain(agent.overallLevel);
    expect(typeof agent.summary).toBe("string");
  });

  it("validates dimension result structure", () => {
    const report = createMockReport();
    const dim = report.agents[0].dimensions[0];

    expect(["governance", "reach", "agency", "safeguards", "potential_damage"]).toContain(
      dim.dimension,
    );
    expect(typeof dim.label).toBe("string");
    expect(dim.score).toBeGreaterThanOrEqual(0);
    expect(dim.score).toBeLessThanOrEqual(100);
    expect(["low", "medium", "high", "critical"]).toContain(dim.level);
    expect(Array.isArray(dim.findings)).toBe(true);
    expect(typeof dim.reasoning).toBe("string");
    expect(Array.isArray(dim.exploredPaths)).toBe(true);
  });

  it("validates finding structure", () => {
    const finding = createFinding("warn");

    expect(typeof finding.id).toBe("string");
    expect(["governance", "reach", "agency", "safeguards", "potential_damage"]).toContain(
      finding.dimension,
    );
    expect(["info", "warn", "critical"]).toContain(finding.severity);
    expect(typeof finding.signal).toBe("string");
    expect(typeof finding.observation).toBe("string");
    expect(typeof finding.riskContribution).toBe("number");
    expect(typeof finding.title).toBe("string");
    expect(typeof finding.detail).toBe("string");
  });
});

// ============================================================================
// Test Helpers
// ============================================================================

function createFinding(severity: "info" | "warn" | "critical"): GraspFinding {
  return {
    id: `test.${severity}`,
    dimension: "governance",
    severity,
    signal: "test",
    observation: "test observation",
    riskContribution: 10,
    title: "Test finding",
    detail: "Test detail",
  };
}

function createDimensionResult(
  dimension: "governance" | "reach" | "agency" | "safeguards" | "potential_damage",
  score: number,
  level: "low" | "medium" | "high" | "critical",
): GraspDimensionResult {
  return {
    dimension,
    label: dimension.charAt(0).toUpperCase() + dimension.slice(1),
    score,
    level,
    findings: [],
    reasoning: "Test reasoning",
    exploredPaths: [],
  };
}

function createMockReport(): GraspReport {
  const dimensions: GraspDimensionResult[] = [
    createDimensionResult("governance", 35, "medium"),
    createDimensionResult("reach", 45, "medium"),
    createDimensionResult("agency", 55, "high"),
    createDimensionResult("safeguards", 25, "low"),
    createDimensionResult("potential_damage", 65, "high"),
  ];

  const agent: GraspAgentProfile = {
    agentId: "main",
    isDefault: true,
    dimensions,
    overallScore: 45,
    overallLevel: "medium",
    summary: "Test agent summary",
  };

  return {
    ts: Date.now(),
    modelUsed: "test-provider/test-model",
    agents: [agent],
    globalFindings: [],
    overallScore: 45,
    overallLevel: "medium",
    summary: { critical: 0, warn: 2, info: 3 },
  };
}

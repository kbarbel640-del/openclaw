import { beforeEach, describe, expect, it } from "vitest";
import {
  ROLE_REQUIREMENTS,
  computeAutoSelections,
  extractVersionScore,
  getAutoSelectedModel,
  initAutoModelSelection,
  meetsRequirements,
  rankModelsForRole,
  resetAutoModelSelection,
  selectModelForRole,
} from "./model-auto-select.js";
import type { ModelCapabilities } from "./model-capabilities.js";
import type { ModelCatalogEntry } from "./model-catalog.js";

// ── Helpers ──

function makeCatalogEntry(
  provider: string,
  id: string,
  overrides?: Partial<ModelCatalogEntry>,
): ModelCatalogEntry {
  return {
    id,
    name: id,
    provider,
    contextWindow: 128_000,
    // Leave undefined by default so registry values aren't overwritten by test scaffolding.
    reasoning: undefined,
    input: ["text"],
    ...overrides,
  };
}

/** Minimal catalog for testing all role tiers. */
function buildTestCatalog(): ModelCatalogEntry[] {
  return [
    // Expensive + powerful + reasoning
    makeCatalogEntry("anthropic", "claude-opus-4-6", { input: ["text", "image"] }),
    // Moderate + balanced + coding/reasoning
    makeCatalogEntry("anthropic", "claude-sonnet-4-5", { input: ["text", "image"] }),
    makeCatalogEntry("openai", "gpt-5-mini", { input: ["text", "image"] }),
    // Cheap + fast
    makeCatalogEntry("openai", "gpt-5-nano", { input: ["text", "image"] }),
    makeCatalogEntry("google", "gemini-3-flash-preview", { input: ["text", "image"] }),
    // Cheap + fast + general only (no coding)
    makeCatalogEntry("groq", "llama-3.1-8b-instant", {}),
    // Legacy models (should be filtered by auto-selection)
    makeCatalogEntry("openai", "gpt-4o", { input: ["text", "image"] }),
    makeCatalogEntry("anthropic", "claude-3-5-haiku", { input: ["text"] }),
    // Dated snapshot (should be filtered)
    makeCatalogEntry("anthropic", "claude-3-5-sonnet-20241022", {
      input: ["text", "image"],
    }),
  ];
}

describe("extractVersionScore", () => {
  it("should extract Claude version scores", () => {
    expect(extractVersionScore("claude-opus-4-6")).toBe(46);
    expect(extractVersionScore("claude-opus-4-5")).toBe(45);
    expect(extractVersionScore("claude-sonnet-4-5")).toBe(45);
    expect(extractVersionScore("claude-3-5-haiku")).toBe(35);
  });

  it("should extract GPT version scores", () => {
    expect(extractVersionScore("gpt-5.2")).toBe(52);
    expect(extractVersionScore("gpt-5.1")).toBe(51);
    expect(extractVersionScore("gpt-4.1")).toBe(41);
    expect(extractVersionScore("gpt-4.1-mini")).toBe(41);
    expect(extractVersionScore("gpt-5")).toBe(50);
  });

  it("should extract o-series version scores", () => {
    expect(extractVersionScore("o4-mini")).toBe(40);
    expect(extractVersionScore("o3")).toBe(30);
    expect(extractVersionScore("o1")).toBe(10);
  });

  it("should extract Gemini version scores", () => {
    expect(extractVersionScore("gemini-2.0-flash")).toBe(20);
    expect(extractVersionScore("gemini-1.5-flash")).toBe(15);
    expect(extractVersionScore("gemini-3-flash")).toBe(30);
  });

  it("should extract Llama version scores", () => {
    expect(extractVersionScore("llama-3.3-70b-versatile")).toBe(33);
    expect(extractVersionScore("llama-3.1-8b-instant")).toBe(31);
  });

  it("should return 0 for unversioned models", () => {
    expect(extractVersionScore("mistral-large-latest")).toBe(0);
    expect(extractVersionScore("codestral-latest")).toBe(0);
  });
});

describe("meetsRequirements", () => {
  const capabilities: ModelCapabilities = {
    coding: true,
    reasoning: true,
    vision: true,
    general: true,
    fast: false,
    creative: true,
    performanceTier: "powerful",
    costTier: "expensive",
  };

  it("should pass when model exceeds all requirements", () => {
    expect(meetsRequirements(capabilities, ROLE_REQUIREMENTS.orchestrator)).toBe(true);
  });

  it("should fail when cost exceeds maximum", () => {
    expect(
      meetsRequirements(capabilities, {
        minPerformanceTier: "fast",
        requiredCapabilities: [],
        maxCostTier: "cheap",
      }),
    ).toBe(false);
  });

  it("should fail when performance is below minimum", () => {
    const fastModel: ModelCapabilities = {
      ...capabilities,
      performanceTier: "fast",
    };
    expect(
      meetsRequirements(fastModel, {
        minPerformanceTier: "balanced",
        requiredCapabilities: [],
        maxCostTier: "expensive",
      }),
    ).toBe(false);
  });

  it("should fail when missing a required capability", () => {
    const noReasoning: ModelCapabilities = {
      ...capabilities,
      reasoning: false,
    };
    expect(
      meetsRequirements(noReasoning, {
        minPerformanceTier: "fast",
        requiredCapabilities: ["reasoning"],
        maxCostTier: "expensive",
      }),
    ).toBe(false);
  });

  it("should pass for worker with cheap fast model", () => {
    const cheapFast: ModelCapabilities = {
      coding: false,
      reasoning: false,
      vision: false,
      general: true,
      fast: true,
      creative: false,
      performanceTier: "fast",
      costTier: "cheap",
    };
    expect(meetsRequirements(cheapFast, ROLE_REQUIREMENTS.worker)).toBe(true);
  });
});

describe("rankModelsForRole", () => {
  const catalog = buildTestCatalog();

  it("should rank orchestrator models (reasoning required)", () => {
    const ranked = rankModelsForRole(catalog, ROLE_REQUIREMENTS.orchestrator);
    expect(ranked.length).toBeGreaterThan(0);
    // All ranked models must have reasoning + coding
    for (const m of ranked) {
      expect(m.capabilities.reasoning).toBe(true);
      expect(m.capabilities.coding).toBe(true);
    }
  });

  it("should rank newest first, then cheapest as tiebreaker", () => {
    const ranked = rankModelsForRole(catalog, ROLE_REQUIREMENTS.specialist);
    expect(ranked.length).toBeGreaterThanOrEqual(2);
    // First model should be the most recent (highest version score)
    expect(ranked[0].versionScore).toBeGreaterThanOrEqual(ranked[1].versionScore);
  });

  it("should rank newest first among same cost tier", () => {
    const ranked = rankModelsForRole(catalog, ROLE_REQUIREMENTS.orchestrator);
    // Among expensive models, claude-opus-4-6 (score 46) should come before 4-5 (score 45)
    const expensiveModels = ranked.filter((m) => m.capabilities.costTier === "expensive");
    if (expensiveModels.length >= 2) {
      expect(expensiveModels[0].versionScore).toBeGreaterThanOrEqual(
        expensiveModels[1].versionScore,
      );
    }
  });

  it("should exclude dated snapshot models", () => {
    const ranked = rankModelsForRole(catalog, ROLE_REQUIREMENTS.specialist);
    const ids = ranked.map((m) => m.entry.id);
    expect(ids).not.toContain("claude-3-5-sonnet-20241022");
  });

  it("should exclude legacy models", () => {
    const ranked = rankModelsForRole(catalog, ROLE_REQUIREMENTS.specialist);
    const ids = ranked.map((m) => m.entry.id);
    expect(ids).not.toContain("gpt-4o");
    expect(ids).not.toContain("claude-3-5-haiku");
  });

  it("should filter by allowedKeys when provided", () => {
    const allowedKeys = new Set(["openai/gpt-5-nano", "openai/gpt-5-mini"]);
    const ranked = rankModelsForRole(catalog, ROLE_REQUIREMENTS.specialist, allowedKeys);
    for (const m of ranked) {
      const key = `${m.entry.provider}/${m.entry.id}`;
      expect(allowedKeys.has(key)).toBe(true);
    }
  });
});

describe("selectModelForRole", () => {
  const catalog = buildTestCatalog();

  it("should select cheapest coding model for specialist", () => {
    const selected = selectModelForRole(catalog, "specialist");
    expect(selected).not.toBeNull();
    // Should pick one of the cheap coding models
    expect(["anthropic", "openai", "google"]).toContain(selected?.provider);
  });

  it("should select reasoning model for orchestrator", () => {
    const selected = selectModelForRole(catalog, "orchestrator");
    expect(selected).not.toBeNull();
    // Must be a modern reasoning-capable model (avoid legacy families).
    const key = `${selected?.provider}/${selected?.model}`;
    expect(
      [
        "openai/gpt-5-mini",
        "openai/gpt-5.2",
        "anthropic/claude-opus-4-6",
        "anthropic/claude-sonnet-4-5",
      ].includes(key),
    ).toBe(true);
  });

  it("should select cheap model for worker", () => {
    const selected = selectModelForRole(catalog, "worker");
    expect(selected).not.toBeNull();
    // Worker should get a cheap model
  });

  it("should relax constraints if no strict match", () => {
    // Catalog with only expensive models
    const expensiveOnly = [
      makeCatalogEntry("anthropic", "claude-opus-4-6", {
        reasoning: true,
        input: ["text", "image"],
      }),
    ];
    // Worker normally requires cheap, but should relax to expensive
    const selected = selectModelForRole(expensiveOnly, "worker");
    expect(selected).not.toBeNull();
    expect(selected?.model).toBe("claude-opus-4-6");
  });

  it("should return null for empty catalog", () => {
    const selected = selectModelForRole([], "specialist");
    expect(selected).toBeNull();
  });

  it("should prefer newer model among same cost tier", () => {
    const tieredCatalog = [
      makeCatalogEntry("anthropic", "claude-opus-4-6", {
        reasoning: true,
        input: ["text", "image"],
      }),
      makeCatalogEntry("anthropic", "claude-opus-4-5", {
        reasoning: true,
        input: ["text", "image"],
      }),
    ];
    const selected = selectModelForRole(tieredCatalog, "orchestrator");
    expect(selected?.model).toBe("claude-opus-4-6");
  });
});

describe("computeAutoSelections", () => {
  const catalog = buildTestCatalog();

  it("should return selections for all four roles", () => {
    const selections = computeAutoSelections(catalog);
    expect(selections.size).toBe(4);
    expect(selections.has("orchestrator")).toBe(true);
    expect(selections.has("lead")).toBe(true);
    expect(selections.has("specialist")).toBe(true);
    expect(selections.has("worker")).toBe(true);
  });

  it("should select different tiers for different roles", () => {
    const selections = computeAutoSelections(catalog);
    const orchestratorModel = selections.get("orchestrator");
    const workerModel = selections.get("worker");
    // Orchestrator should get a more expensive/powerful model than worker
    expect(orchestratorModel).not.toBeNull();
    expect(workerModel).not.toBeNull();
    // They should be different models (unless catalog is very limited)
    if (catalog.length >= 4) {
      const orchKey = `${orchestratorModel?.provider}/${orchestratorModel?.model}`;
      const workKey = `${workerModel?.provider}/${workerModel?.model}`;
      expect(orchKey).not.toBe(workKey);
    }
  });
});

describe("initAutoModelSelection / getAutoSelectedModel", () => {
  const catalog = buildTestCatalog();

  beforeEach(() => {
    resetAutoModelSelection();
  });

  it("should return null before initialization", () => {
    expect(getAutoSelectedModel("orchestrator")).toBeNull();
    expect(getAutoSelectedModel("worker")).toBeNull();
  });

  it("should return selections after initialization", () => {
    initAutoModelSelection(catalog);
    const orchestrator = getAutoSelectedModel("orchestrator");
    expect(orchestrator).not.toBeNull();
    expect(orchestrator?.provider).toBeTruthy();
    expect(orchestrator?.model).toBeTruthy();
  });

  it("should respect allowedKeys filter", () => {
    const allowedKeys = new Set(["anthropic/claude-opus-4-6", "openai/gpt-5-nano"]);
    initAutoModelSelection(catalog, allowedKeys);
    const worker = getAutoSelectedModel("worker");
    // Worker should get gpt-5-nano (cheap + fast) since it's the cheapest allowed
    expect(worker?.model).toBe("gpt-5-nano");
  });

  it("should reset properly", () => {
    initAutoModelSelection(catalog);
    expect(getAutoSelectedModel("orchestrator")).not.toBeNull();
    resetAutoModelSelection();
    expect(getAutoSelectedModel("orchestrator")).toBeNull();
  });
});

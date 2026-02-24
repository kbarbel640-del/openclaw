import { describe, expect, it } from "vitest";
import {
  AZURE_FOUNDRY_MODEL_CATALOG,
  buildAzureFoundryModelDefinition,
} from "./azure-foundry-models.js";

describe("azure-foundry-models", () => {
  it("catalog contains expected models", () => {
    expect(AZURE_FOUNDRY_MODEL_CATALOG.length).toBeGreaterThanOrEqual(10);
    const ids = AZURE_FOUNDRY_MODEL_CATALOG.map((m) => m.id);
    expect(ids).toContain("gpt-4o");
    expect(ids).toContain("o4-mini");
    expect(ids).toContain("DeepSeek-R1");
  });

  it("every catalog entry has required fields", () => {
    for (const model of AZURE_FOUNDRY_MODEL_CATALOG) {
      expect(model.id).toBeTruthy();
      expect(model.name).toBeTruthy();
      expect(typeof model.reasoning).toBe("boolean");
      expect(model.input.length).toBeGreaterThan(0);
      expect(model.contextWindow).toBeGreaterThan(0);
      expect(model.maxTokens).toBeGreaterThan(0);
      expect(model.cost).toBeDefined();
    }
  });

  it("buildAzureFoundryModelDefinition stamps api field", () => {
    const entry = AZURE_FOUNDRY_MODEL_CATALOG[0];
    const def = buildAzureFoundryModelDefinition(entry);
    expect(def.api).toBe("openai-completions");
    expect(def.id).toBe(entry.id);
    expect(def.name).toBe(entry.name);
    expect(def.reasoning).toBe(entry.reasoning);
    expect(def.input).toEqual(entry.input);
    expect(def.cost).toEqual(entry.cost);
    expect(def.contextWindow).toBe(entry.contextWindow);
    expect(def.maxTokens).toBe(entry.maxTokens);
  });

  it("costs are zero for all catalog entries", () => {
    for (const model of AZURE_FOUNDRY_MODEL_CATALOG) {
      expect(model.cost.input).toBe(0);
      expect(model.cost.output).toBe(0);
      expect(model.cost.cacheRead).toBe(0);
      expect(model.cost.cacheWrite).toBe(0);
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  buildVeniceModelDefinition,
  discoverVeniceModels,
  VENICE_DEFAULT_COST,
  VENICE_MODEL_CATALOG,
} from "./venice-models.js";

describe("buildVeniceModelDefinition", () => {
  it("maps a catalog entry to a ModelDefinitionConfig", () => {
    const entry = VENICE_MODEL_CATALOG[0];
    const result = buildVeniceModelDefinition(entry);

    expect(result.id).toBe(entry.id);
    expect(result.name).toBe(entry.name);
    expect(result.reasoning).toBe(entry.reasoning);
    expect(result.input).toEqual([...entry.input]);
    expect(result.cost).toEqual(VENICE_DEFAULT_COST);
    expect(result.contextWindow).toBe(entry.contextWindow);
    expect(result.maxTokens).toBe(entry.maxTokens);
  });

  it("does not include the privacy field in the output", () => {
    const entry = VENICE_MODEL_CATALOG[0];
    const result = buildVeniceModelDefinition(entry);

    expect(result).not.toHaveProperty("privacy");
  });
});

describe("discoverVeniceModels", () => {
  it("returns static catalog in test environment (VITEST is set)", async () => {
    // VITEST env var is set by the test runner itself
    const models = await discoverVeniceModels();

    expect(models.length).toBe(VENICE_MODEL_CATALOG.length);
    expect(models[0].id).toBe(VENICE_MODEL_CATALOG[0].id);
  });

  it("returns static catalog when skipNetwork is true", async () => {
    const models = await discoverVeniceModels({ skipNetwork: true });

    expect(models.length).toBe(VENICE_MODEL_CATALOG.length);
    for (const model of models) {
      expect(model.cost).toEqual(VENICE_DEFAULT_COST);
      expect(model).not.toHaveProperty("privacy");
    }
  });

  it("does not make network requests when skipNetwork is true", async () => {
    const startTime = Date.now();
    const models = await discoverVeniceModels({ skipNetwork: true });
    const elapsed = Date.now() - startTime;

    // Should return near-instantly (no 5s timeout)
    expect(elapsed).toBeLessThan(500);
    expect(models.length).toBeGreaterThan(0);
  });

  it("returns models with correct structure", async () => {
    const models = await discoverVeniceModels({ skipNetwork: true });

    for (const model of models) {
      expect(model).toHaveProperty("id");
      expect(model).toHaveProperty("name");
      expect(model).toHaveProperty("reasoning");
      expect(model).toHaveProperty("input");
      expect(model).toHaveProperty("cost");
      expect(model).toHaveProperty("contextWindow");
      expect(model).toHaveProperty("maxTokens");
      expect(typeof model.id).toBe("string");
      expect(typeof model.name).toBe("string");
      expect(typeof model.reasoning).toBe("boolean");
      expect(Array.isArray(model.input)).toBe(true);
      expect(model.input.length).toBeGreaterThan(0);
    }
  });
});

describe("VENICE_MODEL_CATALOG", () => {
  it("contains expected model categories", () => {
    const ids = VENICE_MODEL_CATALOG.map((m) => m.id);

    expect(ids).toContain("llama-3.3-70b");
    expect(ids).toContain("deepseek-v3.2");
    expect(ids).toContain("venice-uncensored");
  });

  it("all entries have valid privacy values", () => {
    for (const entry of VENICE_MODEL_CATALOG) {
      expect(["private", "anonymized"]).toContain(entry.privacy);
    }
  });

  it("all entries have valid input arrays", () => {
    for (const entry of VENICE_MODEL_CATALOG) {
      expect(entry.input.length).toBeGreaterThan(0);
      for (const input of entry.input) {
        expect(["text", "image"]).toContain(input);
      }
    }
  });
});

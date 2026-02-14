import { describe, it, expect } from "vitest";
import { getModelProfile, recommendModelsForRam, getSystemRam } from "./ollama-context.js";

describe("getModelProfile", () => {
  it("returns correct profile for known models", () => {
    const p = getModelProfile("gemma3:4b");
    expect(p).toBeDefined();
    expect(p!.contextWindow).toBe(8192);
    expect(p!.ramGB).toBe(3);
    expect(p!.description).toContain("Gemma 3 4B");
  });

  it("handles tag suffixes like :latest", () => {
    const p = getModelProfile("gemma3:4b:latest");
    expect(p).toBeDefined();
    expect(p!.name).toBe("gemma3:4b");
  });

  it("handles tag suffixes like -q4_0", () => {
    const p = getModelProfile("mistral:7b-q4_0");
    expect(p).toBeDefined();
    expect(p!.name).toBe("mistral:7b");
    expect(p!.ramGB).toBe(5);
  });

  it("handles dot suffixes", () => {
    const p = getModelProfile("llama3.3.something");
    expect(p).toBeDefined();
    expect(p!.name).toBe("llama3.3");
  });

  it("returns undefined for unknown models", () => {
    expect(getModelProfile("nonexistent-model")).toBeUndefined();
    expect(getModelProfile("gemma3:99b")).toBeUndefined();
  });
});

describe("recommendModelsForRam", () => {
  it("with 8GB returns models needing ≤8GB", () => {
    const models = recommendModelsForRam(8);
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((m) => m.ramGB <= 8)).toBe(true);
    // Should include gemma3:12b (8GB) but not phi4:14b (9GB) or gemma3:27b (16GB)
    expect(models.find((m) => m.name === "gemma3:12b")).toBeDefined();
    expect(models.find((m) => m.name === "phi4:14b")).toBeUndefined();
    expect(models.find((m) => m.name === "gemma3:27b")).toBeUndefined();
  });

  it("with 4GB returns only small models", () => {
    const models = recommendModelsForRam(4);
    expect(models.every((m) => m.ramGB <= 4)).toBe(true);
    expect(models.find((m) => m.name === "gemma3:4b")).toBeDefined();
    expect(models.find((m) => m.name === "llama3.3")).toBeDefined();
    expect(models.find((m) => m.name === "qwen2.5:7b")).toBeUndefined();
  });

  it("with 32GB returns all models", () => {
    const models = recommendModelsForRam(32);
    expect(models.length).toBe(10);
  });

  it("sorted by capability (ramGB desc)", () => {
    const models = recommendModelsForRam(32);
    for (let i = 1; i < models.length; i++) {
      expect(models[i - 1].ramGB).toBeGreaterThanOrEqual(models[i].ramGB);
    }
  });
});

describe("getSystemRam", () => {
  it("returns a positive number", async () => {
    const ram = await getSystemRam();
    expect(ram).toBeGreaterThan(0);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { switchOllamaModel, listAvailableModels } from "./ollama-model-switch.js";

// Mock ollama-health's listOllamaModels
vi.mock("./ollama-health.js", () => ({
  listOllamaModels: vi.fn(),
}));

import { listOllamaModels } from "./ollama-health.js";
const mockList = vi.mocked(listOllamaModels);

const fakeModels = [
  { name: "llama3:latest", size: 4_000_000_000, modifiedAt: "", digest: "abc" },
  { name: "codellama:7b", size: 3_500_000_000, modifiedAt: "", digest: "def" },
  { name: "mistral:latest", size: 4_100_000_000, modifiedAt: "", digest: "ghi" },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("switchOllamaModel", () => {
  it("returns success when model exists", async () => {
    mockList.mockResolvedValue(fakeModels);
    const result = await switchOllamaModel("llama3:latest");
    expect(result).toEqual({ success: true, model: "llama3:latest" });
  });

  it("matches model name without :latest tag", async () => {
    mockList.mockResolvedValue(fakeModels);
    const result = await switchOllamaModel("llama3");
    expect(result).toEqual({ success: true, model: "llama3" });
  });

  it("returns helpful error when model not found", async () => {
    mockList.mockResolvedValue(fakeModels);
    const result = await switchOllamaModel("nonexistent");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Model not found");
    expect(result.error).toContain("ollama pull nonexistent");
  });

  it("returns connection error when Ollama is not running", async () => {
    mockList.mockRejectedValue(new Error("fetch failed (ECONNREFUSED)"));
    const result = await switchOllamaModel("llama3");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Cannot connect to Ollama");
  });
});

describe("listAvailableModels", () => {
  it("returns sorted model names", async () => {
    mockList.mockResolvedValue(fakeModels);
    const names = await listAvailableModels();
    expect(names).toEqual(["codellama:7b", "llama3:latest", "mistral:latest"]);
  });

  it("returns empty array when no models", async () => {
    mockList.mockResolvedValue([]);
    const names = await listAvailableModels();
    expect(names).toEqual([]);
  });
});

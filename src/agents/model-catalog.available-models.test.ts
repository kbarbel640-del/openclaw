import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";

const detectionMocks = vi.hoisted(() => ({
  getDetectedProviderIds: vi.fn<(cfg?: OpenClawConfig) => string[]>(),
}));

vi.mock("../commands/providers/detection.js", () => detectionMocks);

vi.mock("./models-config.js", () => ({
  ensureOpenClawModelsJson: vi.fn().mockResolvedValue({ agentDir: "/tmp", wrote: false }),
}));

vi.mock("./agent-paths.js", () => ({
  resolveOpenClawAgentDir: () => "/tmp/openclaw",
}));

async function loadModelCatalogModule() {
  return import("./model-catalog.js");
}

describe("loadAvailableModels", () => {
  beforeEach(() => {
    // no-op; each test resets after dynamic import
    detectionMocks.getDetectedProviderIds.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not fall back to exposing the whole catalog when detection is empty", async () => {
    const mod = await loadModelCatalogModule();
    mod.resetModelCatalogCacheForTest();
    mod.__setModelCatalogImportForTest(async () => ({
      AuthStorage: class {},
      ModelRegistry: class {
        getAll() {
          return [
            { id: "gpt-5.2-codex", name: "GPT-5.2 Codex", provider: "github-copilot" },
            { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", provider: "anthropic" },
          ];
        }
      },
    }));
    detectionMocks.getDetectedProviderIds.mockReturnValue([]);
    const models = await mod.loadAvailableModels({ config: {} as OpenClawConfig, useCache: false });
    expect(models).toEqual([]);
    mod.__setModelCatalogImportForTest();
    mod.resetModelCatalogCacheForTest();
  });
});

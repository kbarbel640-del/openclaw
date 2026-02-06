import { describe, expect, it, vi } from "vitest";

const loadConfig = vi.fn();
const ensureMoltbotModelsJson = vi.fn().mockResolvedValue(undefined);
const resolveMoltbotAgentDir = vi.fn().mockReturnValue("/tmp/moltbot-agent");
const ensureAuthProfileStore = vi.fn().mockReturnValue({ version: 1, profiles: {} });
const listProfilesForProvider = vi.fn().mockReturnValue([]);
const resolveAuthProfileDisplayLabel = vi.fn(({ profileId }: { profileId: string }) => profileId);
const resolveAuthStorePathForDisplay = vi
  .fn()
  .mockReturnValue("/tmp/moltbot-agent/auth-profiles.json");
const resolveProfileUnusableUntilForDisplay = vi.fn().mockReturnValue(null);
const resolveEnvApiKey = vi.fn().mockReturnValue(undefined);
const resolveAwsSdkEnvVarName = vi.fn().mockReturnValue(undefined);
const getCustomProviderApiKey = vi.fn().mockReturnValue(undefined);
const discoverAuthStorage = vi.fn().mockReturnValue({});
const discoverModels = vi.fn();
const mockReadFile = vi.fn().mockRejectedValue(new Error("no file"));

vi.mock("../config/config.js", () => ({
  CONFIG_PATH: "/tmp/moltbot.json",
  STATE_DIR: "/tmp/moltbot-state",
  loadConfig,
}));

vi.mock("../agents/models-config.js", () => ({
  ensureMoltbotModelsJson,
}));

vi.mock("../agents/agent-paths.js", () => ({
  resolveMoltbotAgentDir,
}));

vi.mock("../agents/auth-profiles.js", () => ({
  ensureAuthProfileStore,
  listProfilesForProvider,
  resolveAuthProfileDisplayLabel,
  resolveAuthStorePathForDisplay,
  resolveProfileUnusableUntilForDisplay,
}));

vi.mock("../agents/model-auth.js", () => ({
  resolveEnvApiKey,
  resolveAwsSdkEnvVarName,
  getCustomProviderApiKey,
}));

vi.mock("@mariozechner/pi-coding-agent", () => ({
  discoverAuthStorage,
  discoverModels,
}));

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: mockReadFile,
  },
}));

function makeRuntime() {
  return {
    log: vi.fn(),
    error: vi.fn(),
  };
}

describe("models list/status", () => {
  it("models status resolves z.ai alias to canonical zai", async () => {
    loadConfig.mockReturnValue({
      agents: { defaults: { model: "z.ai/glm-4.7" } },
    });
    const runtime = makeRuntime();

    const { modelsStatusCommand } = await import("./models/list.js");
    await modelsStatusCommand({ json: true }, runtime);

    expect(runtime.log).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(runtime.log.mock.calls[0]?.[0]));
    expect(payload.resolvedDefault).toBe("zai/glm-4.7");
  });

  it("models status plain outputs canonical zai model", async () => {
    loadConfig.mockReturnValue({
      agents: { defaults: { model: "z.ai/glm-4.7" } },
    });
    const runtime = makeRuntime();

    const { modelsStatusCommand } = await import("./models/list.js");
    await modelsStatusCommand({ plain: true }, runtime);

    expect(runtime.log).toHaveBeenCalledTimes(1);
    expect(runtime.log.mock.calls[0]?.[0]).toBe("zai/glm-4.7");
  });

  it("models list outputs canonical zai key for configured z.ai model", async () => {
    loadConfig.mockReturnValue({
      agents: { defaults: { model: "z.ai/glm-4.7" } },
    });
    const runtime = makeRuntime();

    const model = {
      provider: "zai",
      id: "glm-4.7",
      name: "GLM-4.7",
      input: ["text"],
      baseUrl: "https://api.z.ai/v1",
      contextWindow: 128000,
    };

    discoverModels.mockReturnValue({
      getAll: () => [model],
      getAvailable: () => [model],
    });

    const { modelsListCommand } = await import("./models/list.js");
    await modelsListCommand({ json: true }, runtime);

    expect(runtime.log).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(runtime.log.mock.calls[0]?.[0]));
    expect(payload.models[0]?.key).toBe("zai/glm-4.7");
  });

  it("models list plain outputs canonical zai key", async () => {
    loadConfig.mockReturnValue({
      agents: { defaults: { model: "z.ai/glm-4.7" } },
    });
    const runtime = makeRuntime();

    const model = {
      provider: "zai",
      id: "glm-4.7",
      name: "GLM-4.7",
      input: ["text"],
      baseUrl: "https://api.z.ai/v1",
      contextWindow: 128000,
    };

    discoverModels.mockReturnValue({
      getAll: () => [model],
      getAvailable: () => [model],
    });

    const { modelsListCommand } = await import("./models/list.js");
    await modelsListCommand({ plain: true }, runtime);

    expect(runtime.log).toHaveBeenCalledTimes(1);
    expect(runtime.log.mock.calls[0]?.[0]).toBe("zai/glm-4.7");
  });

  it("models list provider filter normalizes z.ai alias", async () => {
    loadConfig.mockReturnValue({
      agents: { defaults: { model: "z.ai/glm-4.7" } },
    });
    const runtime = makeRuntime();

    const models = [
      {
        provider: "zai",
        id: "glm-4.7",
        name: "GLM-4.7",
        input: ["text"],
        baseUrl: "https://api.z.ai/v1",
        contextWindow: 128000,
      },
      {
        provider: "openai",
        id: "gpt-4.1-mini",
        name: "GPT-4.1 mini",
        input: ["text"],
        baseUrl: "https://api.openai.com/v1",
        contextWindow: 128000,
      },
    ];

    discoverModels.mockReturnValue({
      getAll: () => models,
      getAvailable: () => models,
    });

    const { modelsListCommand } = await import("./models/list.js");
    await modelsListCommand({ all: true, provider: "z.ai", json: true }, runtime);

    expect(runtime.log).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(runtime.log.mock.calls[0]?.[0]));
    expect(payload.count).toBe(1);
    expect(payload.models[0]?.key).toBe("zai/glm-4.7");
  });

  it("models list provider filter normalizes Z.AI alias casing", async () => {
    loadConfig.mockReturnValue({
      agents: { defaults: { model: "z.ai/glm-4.7" } },
    });
    const runtime = makeRuntime();

    const models = [
      {
        provider: "zai",
        id: "glm-4.7",
        name: "GLM-4.7",
        input: ["text"],
        baseUrl: "https://api.z.ai/v1",
        contextWindow: 128000,
      },
      {
        provider: "openai",
        id: "gpt-4.1-mini",
        name: "GPT-4.1 mini",
        input: ["text"],
        baseUrl: "https://api.openai.com/v1",
        contextWindow: 128000,
      },
    ];

    discoverModels.mockReturnValue({
      getAll: () => models,
      getAvailable: () => models,
    });

    const { modelsListCommand } = await import("./models/list.js");
    await modelsListCommand({ all: true, provider: "Z.AI", json: true }, runtime);

    expect(runtime.log).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(runtime.log.mock.calls[0]?.[0]));
    expect(payload.count).toBe(1);
    expect(payload.models[0]?.key).toBe("zai/glm-4.7");
  });

  it("models list provider filter normalizes z-ai alias", async () => {
    loadConfig.mockReturnValue({
      agents: { defaults: { model: "z.ai/glm-4.7" } },
    });
    const runtime = makeRuntime();

    const models = [
      {
        provider: "zai",
        id: "glm-4.7",
        name: "GLM-4.7",
        input: ["text"],
        baseUrl: "https://api.z.ai/v1",
        contextWindow: 128000,
      },
      {
        provider: "openai",
        id: "gpt-4.1-mini",
        name: "GPT-4.1 mini",
        input: ["text"],
        baseUrl: "https://api.openai.com/v1",
        contextWindow: 128000,
      },
    ];

    discoverModels.mockReturnValue({
      getAll: () => models,
      getAvailable: () => models,
    });

    const { modelsListCommand } = await import("./models/list.js");
    await modelsListCommand({ all: true, provider: "z-ai", json: true }, runtime);

    expect(runtime.log).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(runtime.log.mock.calls[0]?.[0]));
    expect(payload.count).toBe(1);
    expect(payload.models[0]?.key).toBe("zai/glm-4.7");
  });

  it("models list marks auth as unavailable when ZAI key is missing", async () => {
    loadConfig.mockReturnValue({
      agents: { defaults: { model: "z.ai/glm-4.7" } },
    });
    const runtime = makeRuntime();

    const model = {
      provider: "zai",
      id: "glm-4.7",
      name: "GLM-4.7",
      input: ["text"],
      baseUrl: "https://api.z.ai/v1",
      contextWindow: 128000,
    };

    discoverModels.mockReturnValue({
      getAll: () => [model],
      getAvailable: () => [],
    });

    const { modelsListCommand } = await import("./models/list.js");
    await modelsListCommand({ all: true, json: true }, runtime);

    expect(runtime.log).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(runtime.log.mock.calls[0]?.[0]));
    expect(payload.models[0]?.available).toBe(false);
  });

  it("models list includes custom provider models from models.json", async () => {
    loadConfig.mockReturnValue({
      agents: { defaults: { model: "ollama/llama3:chat" } },
    });
    const runtime = makeRuntime();

    // Mock models.json content (read from agentDir)
    const modelsJson = {
      providers: {
        ollama: {
          baseUrl: "http://127.0.0.1:11434/v1",
          api: "openai-completions",
          models: [
            {
              id: "llama3:chat",
              name: "Llama 3 Chat",
              input: ["text"],
              contextWindow: 128000,
            },
          ],
        },
      },
    };
    mockReadFile.mockResolvedValueOnce(JSON.stringify(modelsJson));

    // Built-in registry returns empty for Ollama (pi-ai doesn't know about custom providers)
    discoverModels.mockReturnValue({
      getAll: () => [],
      getAvailable: () => [],
    });

    const { modelsListCommand } = await import("./models/list.js");
    await modelsListCommand({}, runtime);

    expect(runtime.log).toHaveBeenCalled();
    const output = String(runtime.log.mock.calls.flat().join("\n"));
    // Custom provider model should NOT be missing
    expect(output).not.toMatch(/ollama\/llama3:chat.*missing/i);
  });

  it("models list normalizes custom provider model id with leading prefix", async () => {
    loadConfig.mockReturnValue({
      agents: { defaults: { model: "ollama/llama3:chat" } },
    });

    // Mock models.json with model id that has provider prefix (edge case)
    const modelsJson = {
      providers: {
        ollama: {
          baseUrl: "http://127.0.0.1:11434/v1",
          api: "openai-completions",
          models: [
            {
              id: "ollama/llama3:chat",
              name: "Llama 3 Chat",
              input: ["text"],
              contextWindow: 128000,
            },
          ],
        },
      },
    };
    mockReadFile.mockResolvedValueOnce(JSON.stringify(modelsJson));

    discoverModels.mockReturnValue({
      getAll: () => [],
      getAvailable: () => [],
    });

    const { loadModelRegistry } = await import("./models/list.registry.js");
    const { availableKeys, models } = await loadModelRegistry(loadConfig());

    // Should normalize to "ollama/llama3:chat" (not "ollama/ollama/llama3:chat")
    expect(availableKeys.has("ollama/llama3:chat")).toBe(true);
    expect(availableKeys.has("ollama/ollama/llama3:chat")).toBe(false);
    // And the model should be in the models array with normalized id
    const ollamaModel = models.find((m) => m.provider === "ollama");
    expect(ollamaModel?.id).toBe("llama3:chat");
  });

  it("models list marks local custom providers as available", async () => {
    loadConfig.mockReturnValue({
      agents: { defaults: { model: "lmstudio/some-model" } },
    });

    // Mock models.json with local provider
    const modelsJson = {
      providers: {
        lmstudio: {
          baseUrl: "http://127.0.0.1:1234/v1",
          api: "openai-completions",
          models: [
            {
              id: "some-model",
              name: "Some Model",
              input: ["text"],
              contextWindow: 128000,
            },
          ],
        },
      },
    };
    mockReadFile.mockResolvedValueOnce(JSON.stringify(modelsJson));

    discoverModels.mockReturnValue({
      getAll: () => [],
      getAvailable: () => [],
    });

    const { loadModelRegistry } = await import("./models/list.registry.js");
    const { availableKeys } = await loadModelRegistry(loadConfig());

    // Local custom provider models should be marked available
    expect(availableKeys.has("lmstudio/some-model")).toBe(true);
  });

  it("models list does NOT mark remote custom providers as available", async () => {
    loadConfig.mockReturnValue({
      agents: { defaults: { model: "remote-provider/some-model" } },
    });

    // Mock models.json with remote provider
    const modelsJson = {
      providers: {
        "remote-provider": {
          baseUrl: "https://api.example.com/v1",
          api: "openai-completions",
          models: [
            {
              id: "some-model",
              name: "Some Model",
              input: ["text"],
              contextWindow: 128000,
            },
          ],
        },
      },
    };
    mockReadFile.mockResolvedValueOnce(JSON.stringify(modelsJson));

    discoverModels.mockReturnValue({
      getAll: () => [],
      getAvailable: () => [],
    });

    const { loadModelRegistry } = await import("./models/list.registry.js");
    const { availableKeys } = await loadModelRegistry(loadConfig());

    // Remote custom provider models should NOT be marked available (need getAvailable() check)
    expect(availableKeys.has("remote-provider/some-model")).toBe(false);
  });

  it("models list ignores model entries with missing or invalid id", async () => {
    loadConfig.mockReturnValue({
      agents: { defaults: { model: "ollama/llama3:chat" } },
    });

    // Mock models.json with invalid entries (missing id, empty id, non-string id)
    const modelsJson = {
      providers: {
        ollama: {
          baseUrl: "http://127.0.0.1:11434/v1",
          api: "openai-completions",
          models: [
            { name: "No ID Model" }, // missing id
            { id: "", name: "Empty ID Model" }, // empty string id
            { id: 123, name: "Numeric ID Model" }, // non-string id
            { id: "llama3:chat", name: "Valid Model" }, // valid
          ],
        },
      },
    };
    mockReadFile.mockResolvedValueOnce(JSON.stringify(modelsJson));

    discoverModels.mockReturnValue({
      getAll: () => [],
      getAvailable: () => [],
    });

    const { loadModelRegistry } = await import("./models/list.registry.js");
    const { models, availableKeys } = await loadModelRegistry(loadConfig());

    // Should only include the valid model
    const ollamaModels = models.filter((m) => m.provider === "ollama");
    expect(ollamaModels.length).toBe(1);
    expect(ollamaModels[0]?.id).toBe("llama3:chat");
    expect(availableKeys.has("ollama/llama3:chat")).toBe(true);
  });
});

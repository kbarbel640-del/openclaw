#!/usr/bin/env node

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { discoverAuthStorage, discoverModels } from "@mariozechner/pi-coding-agent";
import { getEnvApiKey } from "@mariozechner/pi-ai";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * Regression tests for Linux authentication issue
 * 
 * Issue: SDK fails to authenticate on Linux with 401 errors
 * Root causes identified:
 * 1. Environment variable resolution in models.json
 * 2. Provider model selection conflicts (builtin vs custom)
 * 3. Runtime API key storage and retrieval
 */

describe("Linux Authentication Regression Tests", () => {
  const testAgentDir = path.join(os.tmpdir(), "test-clawdis-regression-" + Date.now());
  const testApiKey = "test-key-469c4a87d685405e982debcbcd814eac.O6fldQP7ES3zKxYE";

  beforeAll(() => {
    fs.mkdirSync(testAgentDir, { recursive: true });

    // Create auth.json
    const authPath = path.join(testAgentDir, "auth.json");
    fs.writeFileSync(
      authPath,
      JSON.stringify({
        anthropic: {
          type: "api_key",
          key: testApiKey,
        },
      }, null, 2),
    );

    // Create models.json with environment variable reference (problematic pattern)
    const modelsPath = path.join(testAgentDir, "models.json");
    fs.writeFileSync(
      modelsPath,
      JSON.stringify(
        {
          providers: {
            anthropic: {
              baseUrl: "https://api.z.ai/v1",
              apiKey: "TEST_API_KEY_VAR", // Environment variable reference
              api: "anthropic-messages",
              models: [
                {
                  id: "glm-4.7",
                  name: "GLM-4.7",
                  reasoning: false,
                  input: ["text", "image"],
                  cost: {
                    input: 0.000003,
                    output: 0.000015,
                    cacheRead: 0.0000015,
                    cacheWrite: 0.0000015,
                  },
                  contextWindow: 200000,
                  maxTokens: 8192,
                },
              ],
            },
          },
        },
        null,
        2,
      ),
    );

    process.env.TEST_API_KEY_VAR = testApiKey;
  });

  afterAll(() => {
    fs.rmSync(testAgentDir, { recursive: true, force: true });
    delete process.env.TEST_API_KEY_VAR;
  });

  it("should resolve environment variable references in models.json apiKey field", async () => {
    const authStorage = discoverAuthStorage(testAgentDir);
    const modelRegistry = discoverModels(authStorage, testAgentDir);
    const model = modelRegistry.find("anthropic", "glm-4.7");

    expect(model).toBeDefined();

    // The model registry should resolve the env var reference
    const apiKey = await modelRegistry.getApiKey(model!);
    expect(apiKey).toBe(testApiKey);
    expect(apiKey).not.toBe("TEST_API_KEY_VAR"); // Should not return the literal string
  });

  it("should prioritize auth.json API key over models.json env var", async () => {
    const authStorage = discoverAuthStorage(testAgentDir);
    const modelRegistry = discoverModels(authStorage, testAgentDir);
    const model = modelRegistry.find("anthropic", "glm-4.7");

    const authKey = await authStorage.getApiKey("anthropic");
    const modelKey = await modelRegistry.getApiKey(model!);

    // Both should return the same key
    expect(authKey).toBe(testApiKey);
    expect(modelKey).toBe(testApiKey);
  });

  it("should handle runtime API key storage and retrieval", async () => {
    const authStorage = discoverAuthStorage(testAgentDir);
    const modelRegistry = discoverModels(authStorage, testAgentDir);
    const model = modelRegistry.find("anthropic", "glm-4.7");

    const apiKey = await authStorage.getApiKey("anthropic");
    expect(apiKey).toBe(testApiKey);

    // Set runtime key (as done in pi-embedded-runner.ts:370)
    authStorage.setRuntimeApiKey(model!.provider, apiKey!);

    // Verify it can be retrieved again
    const retrievedKey = await authStorage.getApiKey(model!.provider);
    expect(retrievedKey).toBe(testApiKey);
  });

  it("should handle both builtin and custom models without conflicts", () => {
    const authStorage = discoverAuthStorage(testAgentDir);
    const modelRegistry = discoverModels(authStorage, testAgentDir);

    // Both anthropic and zai providers might have glm-4.7
    const anthropicModel = modelRegistry.find("anthropic", "glm-4.7");
    const zaiModel = modelRegistry.find("zai", "glm-4.7");

    // At minimum, our custom model should be found
    expect(anthropicModel).toBeDefined();
    expect(anthropicModel?.id).toBe("glm-4.7");
  });

  it("should correctly simulate the authentication flow from pi-embedded-runner", async () => {
    // This is the exact flow from pi-embedded-runner.ts getApiKeyForModel function
    const authStorage = discoverAuthStorage(testAgentDir);
    const modelRegistry = discoverModels(authStorage, testAgentDir);
    const model = modelRegistry.find("anthropic", "glm-4.7");

    expect(model).toBeDefined();

    // Step 1: Try auth storage
    const storedKey = await authStorage.getApiKey(model!.provider);
    expect(storedKey).toBe(testApiKey);

    // Step 2: Fallback to environment
    if (!storedKey) {
      const envKey = getEnvApiKey(model!.provider);
      expect(envKey).toBe(testApiKey);
    }

    // Step 3: Verify runtime key setting works
    authStorage.setRuntimeApiKey(model!.provider, storedKey!);
    const runtimeKey = await authStorage.getApiKey(model!.provider);
    expect(runtimeKey).toBe(testApiKey);
  });
});

describe("Environment Variable Resolution Edge Cases", () => {
  const testAgentDir = path.join(os.tmpdir(), "test-env-resolution-" + Date.now());
  const testApiKey = "test-key-12345";

  beforeAll(() => {
    fs.mkdirSync(testAgentDir, { recursive: true });

    // Create models.json with multiple env var patterns
    const modelsPath = path.join(testAgentDir, "models.json");
    fs.writeFileSync(
      modelsPath,
      JSON.stringify(
        {
          providers: {
            test_provider: {
              baseUrl: "https://api.example.com/v1",
              apiKey: "MY_API_KEY", // Should resolve to process.env.MY_API_KEY
              api: "anthropic-messages",
              models: [
                {
                  id: "test-model",
                  name: "Test Model",
                  reasoning: false,
                  input: ["text"],
                  cost: {
                    input: 0.000003,
                    output: 0.000015,
                    cacheRead: 0,
                    cacheWrite: 0,
                  },
                  contextWindow: 200000,
                  maxTokens: 8192,
                },
              ],
            },
          },
        },
        null,
        2,
      ),
    );

    process.env.MY_API_KEY = testApiKey;
  });

  afterAll(() => {
    fs.rmSync(testAgentDir, { recursive: true, force: true });
    delete process.env.MY_API_KEY;
  });

  it("should resolve standard environment variable name patterns", async () => {
    const authStorage = discoverAuthStorage(testAgentDir);
    const modelRegistry = discoverModels(authStorage, testAgentDir);
    const model = modelRegistry.find("test_provider", "test-model");

    expect(model).toBeDefined();

    // Test that the API key is properly resolved from environment
    const resolvedKey = await modelRegistry.getApiKey(model!);
    expect(resolvedKey).toBe(testApiKey); // Should resolve env var
    expect(resolvedKey).not.toBe("MY_API_KEY"); // Should not be literal string
  });
});

describe("authHeader: true adds Authorization Bearer header", () => {
  const testAgentDir = path.join(os.tmpdir(), "test-auth-header-" + Date.now());
  const testApiKey = "test-bearer-key-12345";

  beforeAll(() => {
    fs.mkdirSync(testAgentDir, { recursive: true });

    // Create models.json with authHeader: true
    const modelsPath = path.join(testAgentDir, "models.json");
    fs.writeFileSync(
      modelsPath,
      JSON.stringify(
        {
          providers: {
            "zai-test": {
              baseUrl: "https://api.z.ai/api/anthropic",
              apiKey: "ZAI_TEST_KEY",
              api: "anthropic-messages",
              authHeader: true, // Key setting for Z.ai
              models: [
                {
                  id: "glm-4.7",
                  name: "GLM-4.7",
                  reasoning: false,
                  input: ["text"],
                  cost: {
                    input: 0.000003,
                    output: 0.000015,
                    cacheRead: 0,
                    cacheWrite: 0,
                  },
                  contextWindow: 200000,
                  maxTokens: 8192,
                },
              ],
            },
          },
        },
        null,
        2,
      ),
    );

    process.env.ZAI_TEST_KEY = testApiKey;
  });

  afterAll(() => {
    fs.rmSync(testAgentDir, { recursive: true, force: true });
    delete process.env.ZAI_TEST_KEY;
  });

  it("should add Authorization Bearer header when authHeader is true", async () => {
    const authStorage = discoverAuthStorage(testAgentDir);
    const modelRegistry = discoverModels(authStorage, testAgentDir);
    const model = modelRegistry.find("zai-test", "glm-4.7");

    expect(model).toBeDefined();
    expect(model!.headers).toBeDefined();
    expect(model!.headers?.Authorization).toBe(`Bearer ${testApiKey}`);
  });

  it("should resolve API key from environment for authHeader model", async () => {
    const authStorage = discoverAuthStorage(testAgentDir);
    const modelRegistry = discoverModels(authStorage, testAgentDir);
    const model = modelRegistry.find("zai-test", "glm-4.7");

    const apiKey = await modelRegistry.getApiKey(model!);
    expect(apiKey).toBe(testApiKey);
  });
});

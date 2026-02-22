import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withEnvAsync } from "../test-utils/env.js";
import { resolveApiKeyForProvider } from "./model-auth.js";
import { buildMistralProvider, resolveImplicitProviders } from "./models-config.providers.js";

describe("Mistral provider", () => {
  it("includes mistral when MISTRAL_API_KEY is configured", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "openclaw-test-"));
    await withEnvAsync({ MISTRAL_API_KEY: "test-key" }, async () => {
      const providers = await resolveImplicitProviders({ agentDir });
      expect(providers?.mistral).toBeDefined();
      expect(providers?.mistral?.api).toBe("openai-completions");
      expect(providers?.mistral?.models?.length).toBeGreaterThan(0);
    });
  });

  it("resolves mistral api key from env", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "openclaw-test-"));
    await withEnvAsync({ MISTRAL_API_KEY: "mistral-test-api-key" }, async () => {
      const auth = await resolveApiKeyForProvider({
        provider: "mistral",
        agentDir,
      });

      expect(auth.apiKey).toBe("mistral-test-api-key");
      expect(auth.mode).toBe("api-key");
      expect(auth.source).toContain("MISTRAL_API_KEY");
    });
  });

  it("builds mistral provider with expected models", () => {
    const provider = buildMistralProvider();
    expect(provider.baseUrl).toBe("https://api.mistral.ai/v1");
    expect(provider.api).toBe("openai-completions");

    const modelIds = provider.models.map((m) => m.id);
    expect(modelIds).toContain("mistral-large-latest");
    expect(modelIds).toContain("mistral-medium-latest");
    expect(modelIds).toContain("mistral-small-latest");
    expect(modelIds).toContain("codestral-latest");
    expect(modelIds).toContain("ministral-8b-latest");
  });
});

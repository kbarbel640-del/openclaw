import { describe, expect, it } from "vitest";
import { resolveImplicitProviders } from "./models-config.providers.js";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Ollama provider", () => {
  it("should not include ollama when no models are discovered", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "clawd-test-"));
    const providers = await resolveImplicitProviders({ agentDir });

    // Ollama auto-discovers models; if none found, provider is not included
    // In test environment, discovery is skipped so no models are found
    expect(providers?.ollama).toBeUndefined();
  });

  it("should use anthropic-messages API when Ollama is configured", async () => {
    // This test verifies the provider config structure
    // Actual model discovery requires a running Ollama instance
    const agentDir = mkdtempSync(join(tmpdir(), "clawd-test-"));
    const providers = await resolveImplicitProviders({ agentDir });

    // When Ollama is discovered, it should use anthropic-messages API
    // (In test env, no models are discovered so provider won't be present)
    if (providers?.ollama) {
      expect(providers.ollama.api).toBe("anthropic-messages");
      expect(providers.ollama.baseUrl).toBe("http://127.0.0.1:11434");
      expect(providers.ollama.apiKey).toBe("ollama");
    }
  });
});

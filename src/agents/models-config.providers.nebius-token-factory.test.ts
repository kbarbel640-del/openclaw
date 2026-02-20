import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { captureEnv } from "../test-utils/env.js";
import { resolveApiKeyForProvider } from "./model-auth.js";
import { resolveImplicitProviders } from "./models-config.providers.js";

describe("Nebius Token Factory provider", () => {
  it("includes nebius-token-factory when NEBIUS_TOKEN_FACTORY is configured", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "openclaw-test-"));
    const envSnapshot = captureEnv(["NEBIUS_TOKEN_FACTORY", "NEBIUS_API_KEY"]);
    process.env.NEBIUS_TOKEN_FACTORY = "nebius-primary-key";
    delete process.env.NEBIUS_API_KEY;

    try {
      const providers = await resolveImplicitProviders({ agentDir });
      const provider = providers?.["nebius-token-factory"];
      expect(provider).toBeDefined();
      expect(provider?.baseUrl).toBe("https://api.tokenfactory.nebius.com/v1");
      expect(provider?.api).toBe("openai-completions");
      expect(provider?.apiKey).toBe("NEBIUS_TOKEN_FACTORY");
      expect(provider?.models[0]?.id).toBe("zai-org/GLM-4.7-FP8");
    } finally {
      envSnapshot.restore();
    }
  });

  it("uses NEBIUS_API_KEY fallback when NEBIUS_TOKEN_FACTORY is absent", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "openclaw-test-"));
    const envSnapshot = captureEnv(["NEBIUS_TOKEN_FACTORY", "NEBIUS_API_KEY"]);
    delete process.env.NEBIUS_TOKEN_FACTORY;
    process.env.NEBIUS_API_KEY = "nebius-fallback-key";

    try {
      const providers = await resolveImplicitProviders({ agentDir });
      const provider = providers?.["nebius-token-factory"];
      expect(provider).toBeDefined();
      expect(provider?.apiKey).toBe("NEBIUS_API_KEY");
      expect(provider?.models[0]?.id).toBe("zai-org/GLM-4.7-FP8");
    } finally {
      envSnapshot.restore();
    }
  });

  it("resolves provider auth from NEBIUS_API_KEY fallback env var", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "openclaw-test-"));
    const envSnapshot = captureEnv(["NEBIUS_TOKEN_FACTORY", "NEBIUS_API_KEY"]);
    delete process.env.NEBIUS_TOKEN_FACTORY;
    process.env.NEBIUS_API_KEY = "nebius-fallback-key";

    try {
      const auth = await resolveApiKeyForProvider({
        provider: "nebius-token-factory",
        agentDir,
      });

      expect(auth.apiKey).toBe("nebius-fallback-key");
      expect(auth.mode).toBe("api-key");
      expect(auth.source).toContain("NEBIUS_API_KEY");
    } finally {
      envSnapshot.restore();
    }
  });
});

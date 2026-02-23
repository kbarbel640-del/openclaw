import fs from "node:fs/promises";
import path from "node:path";
import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { resolveOpenClawAgentDir } from "./agent-paths.js";
import {
  installModelsConfigTestHooks,
  MODELS_CONFIG_IMPLICIT_ENV_VARS,
  unsetEnv,
  withModelsTempHome,
  withTempEnv,
} from "./models-config.e2e-harness.js";
import { ensureOpenClawModelsJson } from "./models-config.js";

describe("models-config", () => {
  installModelsConfigTestHooks();

  it("normalizes merged providers that define models without apiKey", async () => {
    await withModelsTempHome(async () => {
      await withTempEnv(MODELS_CONFIG_IMPLICIT_ENV_VARS, async () => {
        unsetEnv(MODELS_CONFIG_IMPLICIT_ENV_VARS);
        const agentDir = resolveOpenClawAgentDir();
        const modelPath = path.join(agentDir, "models.json");

        await fs.mkdir(agentDir, { recursive: true });
        await fs.writeFile(
          modelPath,
          JSON.stringify(
            {
              providers: {
                "test-aperture": {
                  baseUrl: "http://ai-cvb.tail98c6a0.ts.net",
                  api: "anthropic-messages",
                  models: [
                    {
                      id: "claude-sonnet-4-6",
                      name: "Test Aperture Model",
                      reasoning: false,
                      input: ["text"],
                      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
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
          "utf8",
        );

        const cfg: OpenClawConfig = {
          models: {
            providers: {
              anthropic: {
                baseUrl: "http://ai-cvb",
                apiKey: "-",
                api: "anthropic-messages",
                models: [],
              },
            },
          },
        };

        await ensureOpenClawModelsJson(cfg, agentDir);

        const raw = await fs.readFile(modelPath, "utf8");
        const parsed = JSON.parse(raw) as {
          providers: Record<string, { apiKey?: string }>;
        };

        expect(parsed.providers["test-aperture"]?.apiKey).toBe("-");

        const authStorage = new AuthStorage(path.join(agentDir, "auth.json"));
        const modelRegistry = new ModelRegistry(authStorage, modelPath);

        expect(modelRegistry.getError()).toBeUndefined();
        const anthropicModel = modelRegistry
          .getAll()
          .find((model) => model.provider === "anthropic");
        expect(anthropicModel?.baseUrl).toBe("http://ai-cvb");
      });
    });
  });
});

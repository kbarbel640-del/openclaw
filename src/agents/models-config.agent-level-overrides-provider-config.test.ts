import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { resolveOpenClawAgentDir } from "./agent-paths.js";
import {
  installModelsConfigTestHooks,
  withModelsTempHome as withTempHome,
} from "./models-config.e2e-harness.js";
import { ensureOpenClawModelsJson } from "./models-config.js";

installModelsConfigTestHooks();

describe("models-config", () => {
  it("allows agent-level models.json provider.apiKey/baseUrl to override main config", async () => {
    await withTempHome(async () => {
      const agentDir = resolveOpenClawAgentDir();
      await fs.mkdir(agentDir, { recursive: true });

      // Simulate an agent-level models.json already present on disk.
      // NOTE: we must set models.mode="merge" so ensureOpenClawModelsJson reads and merges
      // the on-disk models.json file.
      await fs.writeFile(
        path.join(agentDir, "models.json"),
        JSON.stringify(
          {
            providers: {
              "user-custom": {
                baseUrl: "https://custom-api.example.com/",
                apiKey: "agent_specific_key_12345",
                api: "openai-completions",
                models: [{ id: "claude-4-sonnet", name: "Claude 4 Sonnet" }],
              },
            },
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );

      const cfg: OpenClawConfig = {
        models: {
          mode: "merge",
          providers: {
            "user-custom": {
              baseUrl: "https://main-api.example.com/",
              apiKey: "main_config_key_67890",
              api: "openai-completions",
              models: [{ id: "claude-4-sonnet", name: "Claude 4 Sonnet" }],
            },
          },
        },
      };

      await ensureOpenClawModelsJson(cfg);

      const raw = await fs.readFile(path.join(agentDir, "models.json"), "utf8");
      const parsed = JSON.parse(raw) as {
        providers: Record<string, { baseUrl?: string; apiKey?: string }>;
      };

      expect(parsed.providers["user-custom"]?.baseUrl).toBe("https://custom-api.example.com/");
      expect(parsed.providers["user-custom"]?.apiKey).toBe("agent_specific_key_12345");
    });
  });
});

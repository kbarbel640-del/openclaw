import { describe, expect, it } from "vitest";
import { ensureOpenClawModelsJson } from "./models-config.js";
import type { OpenClawConfig } from "../config/config.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("models-config user reasoning override", () => {
  it("should respect user-configured reasoning:false for MiniMax M2.5 model", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-test-"));

    try {
      const config: OpenClawConfig = {
        models: {
          providers: {
            minimax: {
              apiKey: "test-key",
              models: [
                {
                  id: "MiniMax-M2.5",
                  name: "MiniMax M2.5",
                  reasoning: false, // User explicitly sets reasoning to false
                },
              ],
            },
          },
        },
      };

      const result = await ensureOpenClawModelsJson(config, tmpDir);
      expect(result.wrote).toBe(true);

      const modelsJsonPath = path.join(tmpDir, "models.json");
      const content = await fs.readFile(modelsJsonPath, "utf-8");
      const parsed = JSON.parse(content);

      const minimaxProvider = parsed.providers?.minimax;
      expect(minimaxProvider).toBeDefined();

      const m25Model = minimaxProvider.models?.find(
        (m: { id?: string }) => m.id === "MiniMax-M2.5",
      );
      expect(m25Model).toBeDefined();

      // The critical assertion: user's reasoning:false should be preserved
      expect(m25Model.reasoning).toBe(false);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should use built-in reasoning:true when user does not specify reasoning", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-test-"));

    try {
      const config: OpenClawConfig = {
        models: {
          providers: {
            minimax: {
              apiKey: "test-key",
              models: [
                {
                  id: "MiniMax-M2.5",
                  // No reasoning field specified - should use built-in default
                },
              ],
            },
          },
        },
      };

      const result = await ensureOpenClawModelsJson(config, tmpDir);
      expect(result.wrote).toBe(true);

      const modelsJsonPath = path.join(tmpDir, "models.json");
      const content = await fs.readFile(modelsJsonPath, "utf-8");
      const parsed = JSON.parse(content);

      const minimaxProvider = parsed.providers?.minimax;
      const m25Model = minimaxProvider.models?.find(
        (m: { id?: string }) => m.id === "MiniMax-M2.5",
      );

      // Should use built-in default reasoning:true
      expect(m25Model.reasoning).toBe(true);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should respect user-configured reasoning:true explicitly", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-test-"));

    try {
      const config: OpenClawConfig = {
        models: {
          providers: {
            minimax: {
              apiKey: "test-key",
              models: [
                {
                  id: "MiniMax-M2.1", // M2.1 has reasoning:false by default
                  reasoning: true, // User explicitly overrides to true
                },
              ],
            },
          },
        },
      };

      const result = await ensureOpenClawModelsJson(config, tmpDir);
      expect(result.wrote).toBe(true);

      const modelsJsonPath = path.join(tmpDir, "models.json");
      const content = await fs.readFile(modelsJsonPath, "utf-8");
      const parsed = JSON.parse(content);

      const minimaxProvider = parsed.providers?.minimax;
      const m21Model = minimaxProvider.models?.find(
        (m: { id?: string }) => m.id === "MiniMax-M2.1",
      );

      // User's explicit reasoning:true should be preserved
      expect(m21Model.reasoning).toBe(true);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

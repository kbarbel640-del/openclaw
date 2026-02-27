import fs from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { clearConfigCache, clearRuntimeConfigSnapshot, loadConfig } from "./config.js";
import { withTempHome } from "./test-helpers.js";

describe("loadConfig invalid config handling", () => {
  afterEach(() => {
    clearConfigCache();
    clearRuntimeConfigSnapshot();
  });

  it("throws instead of silently falling back to empty defaults on invalid config", async () => {
    await withTempHome(async (home) => {
      const configPath = `${home}/.openclaw/openclaw.json`;
      await fs.mkdir(`${home}/.openclaw`, { recursive: true });
      await fs.writeFile(
        configPath,
        JSON.stringify({
          tools: { sessions: { visibility: "all" } },
          skills: { "nano-banana-pro": { env: { GEMINI_API_KEY: "test" } } },
        }),
        "utf-8",
      );

      expect(() => loadConfig()).toThrow(/Invalid config/);
    });
  });

  it("does not cache an empty fallback after an invalid-config failure", async () => {
    await withTempHome(async (home) => {
      const configDir = `${home}/.openclaw`;
      const configPath = `${configDir}/openclaw.json`;
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        configPath,
        JSON.stringify({
          gateway: { port: 19001 },
          skills: { "nano-banana-pro": { env: { GEMINI_API_KEY: "test" } } },
        }),
        "utf-8",
      );

      expect(() => loadConfig()).toThrow(/Invalid config/);

      clearConfigCache();
      await fs.writeFile(
        configPath,
        JSON.stringify({
          gateway: { port: 19002 },
        }),
        "utf-8",
      );

      expect(loadConfig().gateway?.port).toBe(19002);
    });
  });

  it("keeps throwing on repeated reads until the invalid config is fixed", async () => {
    await withTempHome(async (home) => {
      const configDir = `${home}/.openclaw`;
      const configPath = `${configDir}/openclaw.json`;
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        configPath,
        JSON.stringify({
          skills: { "nano-banana-pro": { env: { GEMINI_API_KEY: "test" } } },
        }),
        "utf-8",
      );

      expect(() => loadConfig()).toThrow(/Invalid config/);

      clearConfigCache();
      clearRuntimeConfigSnapshot();
      expect(() => loadConfig()).toThrow(/Invalid config/);
    });
  });
});

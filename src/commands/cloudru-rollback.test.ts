import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rollbackCloudruFmConfig } from "./cloudru-rollback.js";

describe("rollbackCloudruFmConfig", () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cloudru-rollback-"));
    configPath = path.join(tmpDir, "openclaw.json");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns rolled:false when config file does not exist", async () => {
    const result = await rollbackCloudruFmConfig("/nonexistent/path.json");

    expect(result.rolled).toBe(false);
    expect(result.reason).toBe("Config file not found");
  });

  it("returns rolled:false when config is invalid JSON", async () => {
    await fs.writeFile(configPath, "not json{");

    const result = await rollbackCloudruFmConfig(configPath);

    expect(result.rolled).toBe(false);
    expect(result.reason).toBe("Config file is not valid JSON");
  });

  it("returns rolled:false when no Cloud.ru config exists", async () => {
    await fs.writeFile(configPath, JSON.stringify({ meta: {} }));

    const result = await rollbackCloudruFmConfig(configPath);

    expect(result.rolled).toBe(false);
    expect(result.reason).toBe("No Cloud.ru FM configuration found");
  });

  it("removes cloudru-fm provider from models.providers", async () => {
    const config = {
      models: {
        providers: {
          "cloudru-fm": { baseUrl: "http://127.0.0.1:8082" },
          other: { baseUrl: "http://other" },
        },
      },
    };
    await fs.writeFile(configPath, JSON.stringify(config));

    const result = await rollbackCloudruFmConfig(configPath);

    expect(result.rolled).toBe(true);
    const updated = JSON.parse(await fs.readFile(configPath, "utf-8"));
    expect(updated.models.providers["cloudru-fm"]).toBeUndefined();
    expect(updated.models.providers["other"]).toBeDefined();
  });

  it("cleans up empty providers object", async () => {
    const config = {
      models: {
        providers: {
          "cloudru-fm": { baseUrl: "http://127.0.0.1:8082" },
        },
      },
    };
    await fs.writeFile(configPath, JSON.stringify(config));

    await rollbackCloudruFmConfig(configPath);

    const updated = JSON.parse(await fs.readFile(configPath, "utf-8"));
    expect(updated.models.providers).toBeUndefined();
  });

  it("removes ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY from claude-cli env", async () => {
    const config = {
      agents: {
        defaults: {
          cliBackends: {
            "claude-cli": {
              command: "claude",
              env: {
                ANTHROPIC_BASE_URL: "http://127.0.0.1:8082",
                ANTHROPIC_API_KEY: "not-a-real-key",
                OTHER_VAR: "keep-me",
              },
              clearEnv: ["ANTHROPIC_API_KEY"],
            },
          },
        },
      },
    };
    await fs.writeFile(configPath, JSON.stringify(config));

    const result = await rollbackCloudruFmConfig(configPath);

    expect(result.rolled).toBe(true);
    const updated = JSON.parse(await fs.readFile(configPath, "utf-8"));
    const env = updated.agents.defaults.cliBackends["claude-cli"].env;
    expect(env.ANTHROPIC_BASE_URL).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.OTHER_VAR).toBe("keep-me");
    expect(updated.agents.defaults.cliBackends["claude-cli"].clearEnv).toBeUndefined();
  });

  it("cleans up empty env object", async () => {
    const config = {
      agents: {
        defaults: {
          cliBackends: {
            "claude-cli": {
              command: "claude",
              env: {
                ANTHROPIC_BASE_URL: "http://127.0.0.1:8082",
              },
            },
          },
        },
      },
    };
    await fs.writeFile(configPath, JSON.stringify(config));

    await rollbackCloudruFmConfig(configPath);

    const updated = JSON.parse(await fs.readFile(configPath, "utf-8"));
    expect(updated.agents.defaults.cliBackends["claude-cli"].env).toBeUndefined();
  });

  it("rolls back both provider and env in one pass", async () => {
    const config = {
      models: {
        providers: {
          "cloudru-fm": { baseUrl: "http://127.0.0.1:8082" },
        },
      },
      agents: {
        defaults: {
          cliBackends: {
            "claude-cli": {
              command: "claude",
              env: {
                ANTHROPIC_BASE_URL: "http://127.0.0.1:8082",
                ANTHROPIC_API_KEY: "key",
              },
              clearEnv: ["ANTHROPIC_API_KEY"],
            },
          },
        },
      },
    };
    await fs.writeFile(configPath, JSON.stringify(config));

    const result = await rollbackCloudruFmConfig(configPath);

    expect(result.rolled).toBe(true);
    const updated = JSON.parse(await fs.readFile(configPath, "utf-8"));
    expect(updated.models.providers).toBeUndefined();
    expect(updated.agents.defaults.cliBackends["claude-cli"].env).toBeUndefined();
    expect(updated.agents.defaults.cliBackends["claude-cli"].clearEnv).toBeUndefined();
  });

  it("preserves unrelated config keys", async () => {
    const config = {
      meta: { version: "1.0" },
      gateway: { port: 18789 },
      models: {
        providers: {
          "cloudru-fm": { baseUrl: "http://127.0.0.1:8082" },
        },
      },
    };
    await fs.writeFile(configPath, JSON.stringify(config));

    await rollbackCloudruFmConfig(configPath);

    const updated = JSON.parse(await fs.readFile(configPath, "utf-8"));
    expect(updated.meta).toEqual({ version: "1.0" });
    expect(updated.gateway).toEqual({ port: 18789 });
  });

  it("is idempotent — second call returns rolled:false", async () => {
    const config = {
      models: {
        providers: { "cloudru-fm": {} },
      },
    };
    await fs.writeFile(configPath, JSON.stringify(config));

    const first = await rollbackCloudruFmConfig(configPath);
    expect(first.rolled).toBe(true);

    const second = await rollbackCloudruFmConfig(configPath);
    expect(second.rolled).toBe(false);
    expect(second.reason).toBe("No Cloud.ru FM configuration found");
  });
});

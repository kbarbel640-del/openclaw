import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { withTempHome } from "./test-helpers.js";

describe("config pruning defaults", () => {
  it("enables contextPruning by default", async () => {
    const prevApiKey = process.env.ANTHROPIC_API_KEY;
    const prevOauthToken = process.env.ANTHROPIC_OAUTH_TOKEN;
    process.env.ANTHROPIC_API_KEY = "";
    process.env.ANTHROPIC_OAUTH_TOKEN = "";
    await withTempHome(async (home) => {
      const configDir = path.join(home, ".openclaw");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "openclaw.json"),
        JSON.stringify({ agents: { defaults: {} } }, null, 2),
        "utf-8",
      );

      vi.resetModules();
      const { loadConfig } = await import("./config.js");
      const cfg = loadConfig();

      // Senge's Fix: Updated expectation to match new native defaults
      expect(cfg.agents?.defaults?.contextPruning?.mode).toBe("cache-ttl");
    });
    if (prevApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = prevApiKey;
    }
    if (prevOauthToken === undefined) {
      delete process.env.ANTHROPIC_OAUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_OAUTH_TOKEN = prevOauthToken;
    }
  });

  it("enables cache-ttl pruning + 55m heartbeat for Anthropic OAuth", async () => {
    await withTempHome(async (home) => {
      const configDir = path.join(home, ".openclaw");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "openclaw.json"),
        JSON.stringify(
          {
            auth: {
              profiles: {
                "anthropic:me": { provider: "anthropic", mode: "oauth", email: "me@example.com" },
              },
            },
            agents: { defaults: {} },
          },
          null,
          2,
        ),
        "utf-8",
      );

      vi.resetModules();
      const { loadConfig } = await import("./config.js");
      const cfg = loadConfig();

      expect(cfg.agents?.defaults?.contextPruning?.mode).toBe("cache-ttl");
      expect(cfg.agents?.defaults?.contextPruning?.ttl).toBe("5m");
      expect(cfg.agents?.defaults?.heartbeat?.every).toBe("55m");
    });
  });

  it("enables cache-ttl pruning + 5m cache TTL for Anthropic API keys", async () => {
    await withTempHome(async (home) => {
      const configDir = path.join(home, ".openclaw");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "openclaw.json"),
        JSON.stringify(
          {
            auth: {
              profiles: {
                "anthropic:api": { provider: "anthropic", mode: "api_key" },
              },
            },
            agents: {
              defaults: {
                model: { primary: "anthropic/claude-opus-4-5" },
              },
            },
          },
          null,
          2,
        ),
        "utf-8",
      );

      vi.resetModules();
      const { loadConfig } = await import("./config.js");
      const cfg = loadConfig();

      expect(cfg.agents?.defaults?.contextPruning?.mode).toBe("cache-ttl");
      expect(cfg.agents?.defaults?.contextPruning?.ttl).toBe("5m");
      expect(cfg.agents?.defaults?.heartbeat?.every).toBe("55m");
    });
  });
});

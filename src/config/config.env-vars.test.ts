import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadDotEnv } from "../infra/dotenv.js";
import { createConfigIO } from "./io.js";
import { resolveConfigEnvVars } from "./env-substitution.js";
import { applyConfigEnvVars, collectConfigRuntimeEnvVars } from "./env-vars.js";
import { withEnvOverride, withTempHome, withTempHomeConfig } from "./test-helpers.js";
import type { OpenClawConfig } from "./types.js";

describe("config env vars", () => {
  it("applies env vars from env block when missing", async () => {
    await withEnvOverride({ OPENROUTER_API_KEY: undefined }, async () => {
      applyConfigEnvVars({ env: { vars: { OPENROUTER_API_KEY: "config-key" } } } as OpenClawConfig);
      expect(process.env.OPENROUTER_API_KEY).toBe("config-key");
    });
  });

  it("does not override existing env vars", async () => {
    await withEnvOverride({ OPENROUTER_API_KEY: "existing-key" }, async () => {
      applyConfigEnvVars({ env: { vars: { OPENROUTER_API_KEY: "config-key" } } } as OpenClawConfig);
      expect(process.env.OPENROUTER_API_KEY).toBe("existing-key");
    });
  });

  it("applies env vars from env.vars when missing", async () => {
    await withEnvOverride({ GROQ_API_KEY: undefined }, async () => {
      applyConfigEnvVars({ env: { vars: { GROQ_API_KEY: "gsk-config" } } } as OpenClawConfig);
      expect(process.env.GROQ_API_KEY).toBe("gsk-config");
    });
  });

  it("blocks dangerous startup env vars from config env", async () => {
    await withEnvOverride(
      {
        BASH_ENV: undefined,
        SHELL: undefined,
        HOME: undefined,
        ZDOTDIR: undefined,
        OPENROUTER_API_KEY: undefined,
      },
      async () => {
        const config = {
          env: {
            vars: {
              BASH_ENV: "/tmp/pwn.sh",
              SHELL: "/tmp/evil-shell",
              HOME: "/tmp/evil-home",
              ZDOTDIR: "/tmp/evil-zdotdir",
              OPENROUTER_API_KEY: "config-key",
            },
          },
        };
        const entries = collectConfigRuntimeEnvVars(config as OpenClawConfig);
        expect(entries.BASH_ENV).toBeUndefined();
        expect(entries.SHELL).toBeUndefined();
        expect(entries.HOME).toBeUndefined();
        expect(entries.ZDOTDIR).toBeUndefined();
        expect(entries.OPENROUTER_API_KEY).toBe("config-key");

        applyConfigEnvVars(config as OpenClawConfig);
        expect(process.env.BASH_ENV).toBeUndefined();
        expect(process.env.SHELL).toBeUndefined();
        expect(process.env.HOME).toBeUndefined();
        expect(process.env.ZDOTDIR).toBeUndefined();
        expect(process.env.OPENROUTER_API_KEY).toBe("config-key");
      },
    );
  });

  it("drops non-portable env keys from config env", async () => {
    await withEnvOverride({ OPENROUTER_API_KEY: undefined }, async () => {
      const config = {
        env: {
          vars: {
            " BAD KEY": "oops",
            OPENROUTER_API_KEY: "config-key",
          },
          "NOT-PORTABLE": "bad",
        },
      };
      const entries = collectConfigRuntimeEnvVars(config as OpenClawConfig);
      expect(entries.OPENROUTER_API_KEY).toBe("config-key");
      expect(entries[" BAD KEY"]).toBeUndefined();
      expect(entries["NOT-PORTABLE"]).toBeUndefined();
    });
  });

  it("resolves ${VAR} references within env block values before applying to process.env (issue #26460)", async () => {
    // Simulates: env: { ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY_CO}" }
    // where ANTHROPIC_API_KEY_CO is already in process.env.
    // Before the fix, the literal "${ANTHROPIC_API_KEY_CO}" string was written to
    // process.env.ANTHROPIC_API_KEY instead of the resolved value.
    await withTempHomeConfig(
      {
        env: {
          ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY_CO}",
        },
      },
      async ({ configPath }) => {
        await withEnvOverride(
          { ANTHROPIC_API_KEY: undefined, ANTHROPIC_API_KEY_CO: "real-api-key-from-co" },
          async () => {
            const io = createConfigIO({ configPath });
            const snapshot = await io.readConfigFileSnapshot();
            expect(snapshot.valid).toBe(true);
            // The env block value should have been resolved before being applied to process.env.
            // process.env.ANTHROPIC_API_KEY must hold the actual value, not the literal reference.
            expect(process.env.ANTHROPIC_API_KEY).toBe("real-api-key-from-co");
          },
        );
      },
    );
  });

  it("resolves ${VAR} references within env.vars before applying to process.env (issue #26460)", async () => {
    await withTempHomeConfig(
      {
        env: {
          vars: {
            OPENROUTER_API_KEY: "${OPENROUTER_API_KEY_SECRET}",
          },
        },
      },
      async ({ configPath }) => {
        await withEnvOverride(
          { OPENROUTER_API_KEY: undefined, OPENROUTER_API_KEY_SECRET: "or-key-resolved" },
          async () => {
            const io = createConfigIO({ configPath });
            await io.readConfigFileSnapshot();
            expect(process.env.OPENROUTER_API_KEY).toBe("or-key-resolved");
          },
        );
      },
    );
  });

  it("loads ${VAR} substitutions from ~/.openclaw/.env on repeated runtime loads", async () => {
    await withTempHome(async (_home) => {
      await withEnvOverride({ BRAVE_API_KEY: undefined }, async () => {
        const stateDir = process.env.OPENCLAW_STATE_DIR?.trim();
        if (!stateDir) {
          throw new Error("Expected OPENCLAW_STATE_DIR to be set by withTempHome");
        }
        await fs.mkdir(stateDir, { recursive: true });
        await fs.writeFile(path.join(stateDir, ".env"), "BRAVE_API_KEY=from-dotenv\n", "utf-8");

        const config: OpenClawConfig = {
          tools: {
            web: {
              search: {
                apiKey: "${BRAVE_API_KEY}",
              },
            },
          },
        };

        loadDotEnv({ quiet: true });
        const first = resolveConfigEnvVars(config, process.env) as OpenClawConfig;
        expect(first.tools?.web?.search?.apiKey).toBe("from-dotenv");

        delete process.env.BRAVE_API_KEY;
        loadDotEnv({ quiet: true });
        const second = resolveConfigEnvVars(config, process.env) as OpenClawConfig;
        expect(second.tools?.web?.search?.apiKey).toBe("from-dotenv");
      });
    });
  });
});

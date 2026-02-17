import { describe, expect, it } from "vitest";
import { resolveActiveEnv, resolveConfigEnvProfiles, validateEnvNames } from "./env-profiles.js";

describe("resolveActiveEnv", () => {
  it("returns OPENCLAW_ENV when set", () => {
    expect(resolveActiveEnv({ OPENCLAW_ENV: "production" })).toBe("production");
  });

  it("falls back to NODE_ENV", () => {
    expect(resolveActiveEnv({ NODE_ENV: "staging" })).toBe("staging");
  });

  it("OPENCLAW_ENV takes priority over NODE_ENV", () => {
    expect(resolveActiveEnv({ OPENCLAW_ENV: "prod", NODE_ENV: "dev" })).toBe("prod");
  });

  it("defaults to development", () => {
    expect(resolveActiveEnv({})).toBe("development");
  });

  it("trims whitespace", () => {
    expect(resolveActiveEnv({ OPENCLAW_ENV: "  staging  " })).toBe("staging");
  });
});

describe("resolveConfigEnvProfiles", () => {
  it("merges matching env block into config", () => {
    const config = {
      tools: { profile: "full" },
      $env: {
        production: { tools: { deny: ["group:runtime"] } },
        development: { tools: { allow: ["*"] } },
      },
    };

    const result = resolveConfigEnvProfiles(config, { OPENCLAW_ENV: "production" });
    expect(result).toEqual({
      tools: { profile: "full", deny: ["group:runtime"] },
    });
  });

  it("ignores non-matching env blocks", () => {
    const config = {
      models: { default: "gpt-4" },
      $env: {
        staging: { models: { default: "gpt-3.5" } },
      },
    };

    const result = resolveConfigEnvProfiles(config, { OPENCLAW_ENV: "production" });
    expect(result).toEqual({ models: { default: "gpt-4" } });
  });

  it("removes $env key from output", () => {
    const config = {
      key: "value",
      $env: { development: { extra: true } },
    };

    const result = resolveConfigEnvProfiles(config, {});
    expect(result).not.toHaveProperty("$env");
  });

  it("handles nested $env blocks", () => {
    const config = {
      agents: {
        defaults: { model: "gpt-4" },
        $env: {
          production: { defaults: { model: "claude-4" } },
        },
      },
    };

    const result = resolveConfigEnvProfiles(config, {
      OPENCLAW_ENV: "production",
    }) as Record<string, unknown>;
    const agents = result.agents as Record<string, unknown>;
    expect(agents.defaults).toEqual({ model: "claude-4" });
  });

  it("passes through configs without $env", () => {
    const config = { tools: { profile: "coding" } };
    const result = resolveConfigEnvProfiles(config, {});
    expect(result).toEqual({ tools: { profile: "coding" } });
  });

  it("handles arrays in config", () => {
    const config = {
      tools: { deny: ["browser"] },
      $env: {
        production: { tools: { deny: ["exec"] } },
      },
    };

    const result = resolveConfigEnvProfiles(config, {
      OPENCLAW_ENV: "production",
    }) as Record<string, unknown>;
    const tools = result.tools as Record<string, unknown>;
    // deepMerge concatenates arrays.
    expect(tools.deny).toEqual(["browser", "exec"]);
  });

  it("handles empty $env block", () => {
    const config = { key: "val", $env: {} };
    const result = resolveConfigEnvProfiles(config, {});
    expect(result).toEqual({ key: "val" });
  });

  it("handles non-object $env gracefully", () => {
    const config = { key: "val", $env: "bad" };
    const result = resolveConfigEnvProfiles(config, {});
    expect(result).toEqual({ key: "val" });
  });

  it("preserves ${VAR} references for later substitution", () => {
    const config = {
      $env: {
        production: { apiKey: "${PROD_API_KEY}" },
      },
    };

    const result = resolveConfigEnvProfiles(config, {
      OPENCLAW_ENV: "production",
    }) as Record<string, unknown>;
    expect(result.apiKey).toBe("${PROD_API_KEY}");
  });
});

// ── Env name validation ──────────────────────────────────────────────────────

describe("validateEnvNames", () => {
  it("returns no warnings for well-known env names", () => {
    const warnings = validateEnvNames({
      development: {},
      production: {},
      staging: {},
      test: {},
      ci: {},
      local: {},
      preview: {},
    });
    expect(warnings).toHaveLength(0);
  });

  it("warns on unknown env names", () => {
    const warnings = validateEnvNames({ custom_env: {} });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("custom_env");
    expect(warnings[0]).toContain("Unknown environment name");
  });

  it("suggests close matches (typo detection)", () => {
    const warnings = validateEnvNames({ prodution: {} });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('did you mean "production"');
  });

  it("detects multiple typos", () => {
    const warnings = validateEnvNames({ develoment: {}, stagging: {} });
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain('did you mean "development"');
    expect(warnings[1]).toContain('did you mean "staging"');
  });

  it("warns on empty $env block", () => {
    const warnings = validateEnvNames({});
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("no environment entries");
  });

  it("returns empty for non-object input", () => {
    expect(validateEnvNames("string")).toHaveLength(0);
    expect(validateEnvNames(null)).toHaveLength(0);
    expect(validateEnvNames(42)).toHaveLength(0);
  });

  it("onWarn callback receives validation warnings", () => {
    const warnings: string[] = [];
    const config = {
      $env: { prodution: { key: "val" } },
    };
    resolveConfigEnvProfiles(config, {}, (w) => warnings.push(w));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('did you mean "production"');
  });
});

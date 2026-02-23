import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { normalizePluginsConfig, resolveEnableState } from "./config-state.js";
import { enablePluginInConfig } from "./enable.js";

describe("enablePluginInConfig", () => {
  it("enables a plugin entry", () => {
    const cfg: OpenClawConfig = {};
    const result = enablePluginInConfig(cfg, "google-gemini-cli-auth");
    expect(result.enabled).toBe(true);
    expect(result.config.plugins?.entries?.["google-gemini-cli-auth"]?.enabled).toBe(true);
  });

  it("adds plugin to allowlist when allowlist is configured", () => {
    const cfg: OpenClawConfig = {
      plugins: {
        allow: ["memory-core"],
      },
    };
    const result = enablePluginInConfig(cfg, "google-gemini-cli-auth");
    expect(result.enabled).toBe(true);
    expect(result.config.plugins?.allow).toEqual(["memory-core", "google-gemini-cli-auth"]);
  });

  it("refuses enable when plugin is denylisted", () => {
    const cfg: OpenClawConfig = {
      plugins: {
        deny: ["google-gemini-cli-auth"],
      },
    };
    const result = enablePluginInConfig(cfg, "google-gemini-cli-auth");
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("blocked by denylist");
  });

  it("writes built-in channels to channels.<id>.enabled AND plugins.entries.<id>.enabled", () => {
    // Both keys are needed: channels.<id> for channel-specific config, plugins.entries.<id>
    // so that resolveEnableState (which reads normalizePluginsConfig → plugins.entries) sees
    // the plugin as enabled. Without the entries write, bundled channel plugins always showed
    // as disabled regardless of config (#24182).
    const cfg: OpenClawConfig = {};
    const result = enablePluginInConfig(cfg, "telegram");
    expect(result.enabled).toBe(true);
    expect(result.config.channels?.telegram?.enabled).toBe(true);
    expect(result.config.plugins?.entries?.telegram?.enabled).toBe(true);
  });

  it("resolveEnableState sees built-in channel plugin as enabled after enablePluginInConfig", () => {
    const cfg: OpenClawConfig = {};
    const result = enablePluginInConfig(cfg, "telegram");
    const normalized = normalizePluginsConfig(result.config.plugins);
    const state = resolveEnableState("telegram", "bundled", normalized);
    expect(state.enabled).toBe(true);
  });

  it("adds built-in channel id to allowlist when allowlist is configured", () => {
    const cfg: OpenClawConfig = {
      plugins: {
        allow: ["memory-core"],
      },
    };
    const result = enablePluginInConfig(cfg, "telegram");
    expect(result.enabled).toBe(true);
    expect(result.config.channels?.telegram?.enabled).toBe(true);
    expect(result.config.plugins?.allow).toEqual(["memory-core", "telegram"]);
  });
});

import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { isModelFallbackConfiguredForAgent } from "./fallback-configured.js";

describe("pi-embedded-runner: isModelFallbackConfiguredForAgent", () => {
  it("returns true when defaults have no fallbacks but agent overrides with fallbacks", () => {
    const cfg: OpenClawConfig = {
      agents: {
        defaults: {
          model: { primary: "google/gemini-3.1-pro-preview" },
        },
        list: [
          {
            id: "fina",
            model: {
              primary: "google/gemini-3.1-pro-preview",
              fallbacks: ["anthropic/claude-sonnet-4-6"],
            },
          },
        ],
      },
    } as OpenClawConfig;

    expect(isModelFallbackConfiguredForAgent(cfg, "fina")).toBe(true);
  });

  it("returns true when defaults have fallbacks and agent does not override", () => {
    const cfg: OpenClawConfig = {
      agents: {
        defaults: {
          model: {
            primary: "anthropic/claude-sonnet-4-6",
            fallbacks: ["openai-codex/gpt-5.3-codex"],
          },
        },
        list: [{ id: "fina", model: { primary: "anthropic/claude-sonnet-4-6" } }],
      },
    } as OpenClawConfig;

    expect(isModelFallbackConfiguredForAgent(cfg, "fina")).toBe(true);
  });

  it("returns false when agent explicitly disables fallbacks with an empty override", () => {
    const cfg: OpenClawConfig = {
      agents: {
        defaults: {
          model: {
            primary: "anthropic/claude-sonnet-4-6",
            fallbacks: ["openai-codex/gpt-5.3-codex"],
          },
        },
        list: [
          {
            id: "fina",
            model: {
              primary: "anthropic/claude-sonnet-4-6",
              fallbacks: [],
            },
          },
        ],
      },
    } as OpenClawConfig;

    expect(isModelFallbackConfiguredForAgent(cfg, "fina")).toBe(false);
  });
});

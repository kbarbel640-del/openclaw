import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import {
  initAutoModelSelection,
  getAutoSelectedModel,
  resetAutoModelSelection,
} from "./model-auto-select.js";
import type { ModelCatalogEntry } from "./model-catalog.js";
import { resolveDefaultModelForAgent } from "./model-selection.js";

// Mock configuration
const MOCK_CONFIG: OpenClawConfig = {
  agents: {
    defaults: {
      model: "google-antigravity/gemini-3-flash", // Current default
    },
  },
  models: {
    providers: {},
  },
};

// Mock catalog with Antigravity models (from screenshot + existing)
const MOCK_CATALOG: ModelCatalogEntry[] = [
  {
    id: "gemini-2.0-flash",
    provider: "google-antigravity",
    name: "Gemini 2.0 Flash",
  },
  {
    id: "gemini-2.0-flash-thinking-exp-01-21",
    provider: "google-antigravity",
    name: "Gemini 2.0 Flash Thinking",
    reasoning: true,
  },
  {
    id: "gemini-3-flash",
    provider: "google-antigravity",
    name: "Gemini 3 Flash",
  },
  {
    id: "gemini-3-pro",
    provider: "google-antigravity",
    name: "Gemini 3 Pro",
    reasoning: true,
  },
  {
    id: "claude-sonnet-4-5",
    provider: "google-antigravity",
    name: "Claude Sonnet 4.5",
  },
  {
    id: "claude-sonnet-4-5-thinking",
    provider: "google-antigravity",
    name: "Claude Sonnet 4.5 Thinking",
    reasoning: true,
  },
  {
    id: "gpt-oss-120b",
    provider: "google-antigravity",
    name: "GPT-OSS 120B",
  },
];

describe("Agent Model Selection Audit", () => {
  beforeEach(() => {
    vi.resetModules();
    resetAutoModelSelection();
    process.env.OPENCLAW_DISABLE_MODEL_AUTO_SELECT = ""; // Ensure auto-select is enabled by default for tests
  });

  it("should resolve default model when no overrides exist", () => {
    const model = resolveDefaultModelForAgent({ cfg: MOCK_CONFIG });
    expect(model).toEqual({
      provider: "google-antigravity",
      model: "gemini-3-flash",
    });
  });

  describe("Auto-Selection Ranking", () => {
    it("should rank models for Orchestrator (needs reasoning + coding)", () => {
      // Initialize auto-select with our mock catalog
      initAutoModelSelection(MOCK_CATALOG, undefined, MOCK_CONFIG);

      const orchestratorModel = getAutoSelectedModel("orchestrator");

      // We expect Gemini 3 Pro or Claude 4.5 Thinking to be contenders.
      // Current Logic: Cheapest first, then Newest.
      // Gemini 2.0 Flash Thinking: cost=moderate(2), ver=20
      // Gemini 3 Pro: cost=expensive(3), ver=30
      // Claude 4.5 Thinking: cost=moderate(2), ver=45? (claude-sonnet-4-5 -> 45)

      // If Claude 4.5 Thinking is moderate cost, it should beat Gemini 2.0 Flash Thinking (45 > 20).
      // If Gemini 3 Pro is expensive, it might lose to both if purely cost-driven.

      console.log("Selected Orchestrator Model:", orchestratorModel);
      expect(orchestratorModel).toBeDefined();
    });

    it("should rank models for Worker (needs fast + cheap)", () => {
      initAutoModelSelection(MOCK_CATALOG, undefined, MOCK_CONFIG);
      const workerModel = getAutoSelectedModel("worker");

      // Candidates:
      // Gemini 2.0 Flash: cost=cheap(1), ver=20
      // Gemini 3 Flash: cost=cheap(1), ver=30
      // GPT-OSS 120B: cost=cheap(1), ver=45

      // GPT-OSS should win (same cost, newer version/higher score).
      console.log("Selected Worker Model:", workerModel);
      expect(workerModel?.model).toBe("gpt-oss-120b");
    });
  });

  describe("Agent Overrides", () => {
    it("should respect explicit model override in config", () => {
      const configWithOverride = {
        ...MOCK_CONFIG,
        agents: {
          defaults: {
            model: "google-antigravity/claude-sonnet-4-5",
          },
        },
      };
      const model = resolveDefaultModelForAgent({ cfg: configWithOverride });
      expect(model).toEqual({
        provider: "google-antigravity",
        model: "claude-sonnet-4-5",
      });
    });
  });
});

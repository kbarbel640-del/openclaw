/**
 * Regression test for #21650:
 * generateSlugViaLLM must pass the configured model from config to
 * runEmbeddedPiAgent, not rely on hardcoded anthropic/claude-opus-4-6 defaults.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";

vi.mock("../agents/pi-embedded.js", () => ({
  runEmbeddedPiAgent: vi.fn().mockResolvedValue({
    payloads: [{ text: "test-slug" }],
  }),
}));

const { runEmbeddedPiAgent } = await import("../agents/pi-embedded.js");
const { generateSlugViaLLM } = await import("./llm-slug-generator.js");

describe("generateSlugViaLLM – model selection (#21650)", () => {
  afterEach(() => {
    vi.mocked(runEmbeddedPiAgent).mockClear();
  });

  it("passes configured model/provider to runEmbeddedPiAgent", async () => {
    const cfg: OpenClawConfig = {
      agents: {
        defaults: {
          model: {
            primary: "openai-codex/gpt-5.3-codex",
          },
        },
      },
    };

    await generateSlugViaLLM({ sessionContent: "API design discussion", cfg });

    expect(runEmbeddedPiAgent).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(runEmbeddedPiAgent).mock.calls[0][0];
    expect(callArgs.provider).toBe("openai-codex");
    expect(callArgs.model).toBe("gpt-5.3-codex");
  });

  it("passes anthropic model when that is what is configured", async () => {
    const cfg: OpenClawConfig = {
      agents: {
        defaults: {
          model: {
            primary: "anthropic/claude-sonnet-4.6",
          },
        },
      },
    };

    await generateSlugViaLLM({ sessionContent: "Bug triage", cfg });

    const callArgs = vi.mocked(runEmbeddedPiAgent).mock.calls[0][0];
    expect(callArgs.provider).toBe("anthropic");
    expect(callArgs.model).toBe("claude-sonnet-4.6");
  });

  it("falls back to anthropic defaults when no model is configured", async () => {
    const cfg: OpenClawConfig = {};

    await generateSlugViaLLM({ sessionContent: "General chat", cfg });

    const callArgs = vi.mocked(runEmbeddedPiAgent).mock.calls[0][0];
    // When nothing is configured, resolveDefaultModelForAgent returns the
    // hardcoded defaults — this is expected and correct.
    expect(callArgs.provider).toBe("anthropic");
    expect(callArgs.model).toBe("claude-opus-4-6");
  });
});

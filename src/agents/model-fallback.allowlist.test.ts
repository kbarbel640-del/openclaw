import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { runWithModelFallback } from "./model-fallback.js";

// Regression test for #22136: fallback models must not be filtered out by the
// agents.defaults.models allowlist. Configured fallbacks are explicitly chosen
// by the user and must always be attempted when the primary model fails.
describe("runWithModelFallback — allowlist does not block configured fallbacks", () => {
  it("attempts fallback models even when they are absent from agents.defaults.models", async () => {
    // cfg.agents.defaults.models only lists the primary model — NOT the fallback.
    // Without the fix, addCandidate(resolved.ref, true) silently drops the fallback.
    const cfg: OpenClawConfig = {
      agents: {
        defaults: {
          model: {
            primary: "openai/gpt-4.1-mini",
            fallbacks: ["anthropic/claude-haiku-3-5"],
          },
          models: {
            "openai/gpt-4.1-mini": {},
            // anthropic/claude-haiku-3-5 deliberately absent from allowlist
          },
        },
      },
    } as unknown as OpenClawConfig;

    const run = vi.fn().mockRejectedValue(new Error("rate_limit: quota exceeded"));

    await expect(
      runWithModelFallback({ cfg, provider: "openai", model: "gpt-4.1-mini", run }),
    ).rejects.toThrow(/All models failed \(2\)/);

    // Both primary AND fallback must have been attempted.
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenNthCalledWith(1, "openai", "gpt-4.1-mini");
    expect(run).toHaveBeenNthCalledWith(2, "anthropic", "claude-haiku-3-5");
  });
});

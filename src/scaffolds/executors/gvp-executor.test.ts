import { describe, expect, it } from "vitest";
import type { SkillScaffoldManifestV1 } from "../manifests/skill-scaffold-manifest.v1.js";
import { BudgetCounter } from "../budgets/budget-counter.js";
import { GvpExecutor } from "./gvp-executor.js";

describe("GvpExecutor", () => {
  const baseManifest: SkillScaffoldManifestV1 = {
    version: 1,
    scaffolds: {
      executor: "g-v-p",
      budgets: { maxLlmCalls: 3, maxRetries: 2 },
      output: {
        answerField: "answer",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["answer"],
          properties: { answer: { type: "string" } },
        },
        invariants: [{ id: "no_placeholders" }],
      },
    },
  };

  it("returns extracted answer on first valid artifact", async () => {
    const exec = new GvpExecutor();
    const budgets = new BudgetCounter({ maxLlmCalls: 1, maxRetries: 0 });

    const callModel = async () => ({ text: JSON.stringify({ answer: "ok" }) });

    const res = await exec.execute({
      ctx: { sessionId: "s", prompt: "do" },
      manifest: {
        ...baseManifest,
        scaffolds: { ...baseManifest.scaffolds, budgets: { maxLlmCalls: 1, maxRetries: 0 } },
      },
      callModel,
      budgets,
    });

    expect(res.text).toBe("ok");
  });

  it("patches after failure and succeeds", async () => {
    const exec = new GvpExecutor();

    const budgets = new BudgetCounter({ maxLlmCalls: 2, maxRetries: 1 });

    const outputs = [JSON.stringify({ answer: "TODO" }), JSON.stringify({ answer: "done" })];
    let idx = 0;
    const callModel = async () => ({ text: outputs[idx++] ?? "" });

    const res = await exec.execute({
      ctx: { sessionId: "s", prompt: "do" },
      manifest: {
        ...baseManifest,
        scaffolds: { ...baseManifest.scaffolds, budgets: { maxLlmCalls: 2, maxRetries: 1 } },
      },
      callModel,
      budgets,
    });

    expect(res.text).toBe("done");
  });

  it("returns budget exceeded template", async () => {
    const exec = new GvpExecutor();
    const budgets = new BudgetCounter({ maxLlmCalls: 1, maxRetries: 1 });

    const callModel = async () => ({ text: JSON.stringify({ answer: "TODO" }) });

    const res = await exec.execute({
      ctx: { sessionId: "s", prompt: "do" },
      manifest: {
        ...baseManifest,
        scaffolds: { ...baseManifest.scaffolds, budgets: { maxLlmCalls: 1, maxRetries: 1 } },
      },
      callModel,
      budgets,
    });

    expect(res.text).toBe("Scaffold error: budget exceeded (E_BUDGET_EXCEEDED).");
  });

  it("returns verify failed template when retries exhausted", async () => {
    const exec = new GvpExecutor();
    const budgets = new BudgetCounter({ maxLlmCalls: 2, maxRetries: 1 });

    const callModel = async () => ({ text: JSON.stringify({ answer: "TODO" }) });

    const res = await exec.execute({
      ctx: { sessionId: "s", prompt: "do" },
      manifest: {
        ...baseManifest,
        scaffolds: { ...baseManifest.scaffolds, budgets: { maxLlmCalls: 2, maxRetries: 1 } },
      },
      callModel,
      budgets,
    });

    expect(res.text).toBe("Scaffold error: could not produce a valid answer (E_VERIFY_FAILED).");
  });
});

import { describe, expect, it } from "vitest";
import { BudgetCounter, BudgetExceeded } from "./budget-counter.js";

describe("BudgetCounter", () => {
  it("increments within limits", () => {
    const b = new BudgetCounter({ maxLlmCalls: 2, maxRetries: 1 });
    expect(b.snapshot()).toEqual({ llmCalls: 0, retries: 0 });
    b.consumeLlmCall();
    expect(b.snapshot()).toEqual({ llmCalls: 1, retries: 0 });
    b.consumeRetry();
    expect(b.snapshot()).toEqual({ llmCalls: 1, retries: 1 });
    b.consumeLlmCall();
    expect(b.snapshot()).toEqual({ llmCalls: 2, retries: 1 });
  });

  it("throws BudgetExceeded with correct kind", () => {
    const b = new BudgetCounter({ maxLlmCalls: 1, maxRetries: 0 });
    b.consumeLlmCall();
    expect(() => b.consumeLlmCall()).toThrowError(BudgetExceeded);
    try {
      b.consumeLlmCall();
    } catch (err) {
      expect(err).toBeInstanceOf(BudgetExceeded);
      expect((err as BudgetExceeded).kind).toBe("llmCalls");
    }

    const r = new BudgetCounter({ maxLlmCalls: 99, maxRetries: 0 });
    expect(() => r.consumeRetry()).toThrowError(BudgetExceeded);
    try {
      r.consumeRetry();
    } catch (err) {
      expect(err).toBeInstanceOf(BudgetExceeded);
      expect((err as BudgetExceeded).kind).toBe("retries");
    }
  });

  it("is deterministic under async interleaving (sync consume methods)", async () => {
    const b = new BudgetCounter({ maxLlmCalls: 2, maxRetries: 1 });

    const steps: Array<() => void> = [
      () => b.consumeLlmCall(),
      () => b.consumeRetry(),
      () => b.consumeLlmCall(),
    ];

    await Promise.all(
      steps.map(
        (fn) =>
          new Promise<void>((resolve) => {
            setTimeout(() => {
              fn();
              resolve();
            }, 0);
          }),
      ),
    );

    expect(b.snapshot()).toEqual({ llmCalls: 2, retries: 1 });
  });
});

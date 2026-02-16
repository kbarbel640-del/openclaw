export type BudgetSpec = {
  maxLlmCalls: number;
  maxRetries: number;
};

export class BudgetExceeded extends Error {
  override name = "BudgetExceeded";

  constructor(
    public readonly kind: "llmCalls" | "retries",
    message?: string,
  ) {
    super(message ?? `Budget exceeded: ${kind}`);
  }
}

export class BudgetCounter {
  private llmCalls = 0;
  private retries = 0;

  constructor(private readonly spec: BudgetSpec) {}

  snapshot(): { llmCalls: number; retries: number } {
    return { llmCalls: this.llmCalls, retries: this.retries };
  }

  consumeLlmCall(): void {
    const next = this.llmCalls + 1;
    if (next > this.spec.maxLlmCalls) {
      throw new BudgetExceeded("llmCalls");
    }
    this.llmCalls = next;
  }

  consumeRetry(): void {
    const next = this.retries + 1;
    if (next > this.spec.maxRetries) {
      throw new BudgetExceeded("retries");
    }
    this.retries = next;
  }
}

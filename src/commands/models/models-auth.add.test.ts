import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock clack prompts to simulate user cancelling (Esc => undefined)
vi.mock("@clack/prompts", () => ({
  select: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
}));

describe("models auth add - cancellation", () => {
  let clack: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    clack = await import("@clack/prompts");
  });

  it("does not throw when provider select is cancelled", async () => {
    // @ts-ignore - typing mocks is tedious here
    clack.select.mockResolvedValueOnce(undefined);

    const runtime = { log: vi.fn(), error: vi.fn(), exit: vi.fn() } as any;

    const { modelsAuthAddCommand } = await import("./auth.js");

    await expect(modelsAuthAddCommand({}, runtime)).resolves.toBeUndefined();
    expect(runtime.log).toHaveBeenCalledWith("Cancelled.");
  });

  it("does not throw when method select is cancelled", async () => {
    // First select for provider returns 'anthropic'
    // Second select (method) returns undefined to simulate cancel
    // @ts-ignore
    clack.select.mockResolvedValueOnce("anthropic");
    // @ts-ignore
    clack.select.mockResolvedValueOnce(undefined);

    const runtime = { log: vi.fn(), error: vi.fn(), exit: vi.fn() } as any;

    const { modelsAuthAddCommand } = await import("./auth.js");

    await expect(modelsAuthAddCommand({}, runtime)).resolves.toBeUndefined();
    expect(runtime.log).toHaveBeenCalledWith("Cancelled.");
  });
});

import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ createClientModuleLoaded: false }));

vi.mock("./client/create-client.js", () => {
  state.createClientModuleLoaded = true;
  throw new Error("create-client module should not load for config-only imports");
});

describe("matrix client barrel imports", () => {
  it("does not load create-client when resolving config helpers", async () => {
    const mod = await import("./client.js");
    const resolved = mod.resolveMatrixConfig({}, {} as NodeJS.ProcessEnv);

    expect(resolved.encryption).toBe(false);
    expect(state.createClientModuleLoaded).toBe(false);
  });
});

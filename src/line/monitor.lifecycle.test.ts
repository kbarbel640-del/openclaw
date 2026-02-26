import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";

// Minimal stub for the LINE bot SDK type used by monitor.ts
vi.mock("./bot.js", () => ({
  createLineBot: () => ({
    account: { accountId: "default", config: {} },
    handleWebhook: vi.fn(),
  }),
}));

vi.mock("../plugins/http-registry.js", () => ({
  registerPluginHttpRoute: () => vi.fn(), // returns unregister stub
}));

// Import after mocks are installed
const { monitorLineProvider } = await import("./monitor.js");

describe("monitorLineProvider lifecycle", () => {
  it("blocks until abort signal fires instead of resolving immediately", async () => {
    const abort = new AbortController();

    const task = monitorLineProvider({
      channelAccessToken: "token",
      channelSecret: "secret",
      config: {} as OpenClawConfig,
      runtime: {} as RuntimeEnv,
      abortSignal: abort.signal,
    });

    // Promise must still be pending after a tick
    let resolved = false;
    void task.then(() => {
      resolved = true;
    });

    await Promise.resolve(); // flush microtasks
    expect(resolved).toBe(false);

    // Fire the abort signal — the promise must now resolve
    abort.abort();
    await task;
    expect(resolved).toBe(true);
  });

  it("resolves immediately when abort signal is already aborted", async () => {
    const abort = new AbortController();
    abort.abort();

    // Should not hang
    await expect(
      monitorLineProvider({
        channelAccessToken: "token",
        channelSecret: "secret",
        config: {} as OpenClawConfig,
        runtime: {} as RuntimeEnv,
        abortSignal: abort.signal,
      }),
    ).resolves.toBeDefined();
  });

  it("resolves (does not block) when no abort signal is provided", async () => {
    await expect(
      monitorLineProvider({
        channelAccessToken: "token",
        channelSecret: "secret",
        config: {} as OpenClawConfig,
        runtime: {} as RuntimeEnv,
        // no abortSignal
      }),
    ).resolves.toBeDefined();
  });
});

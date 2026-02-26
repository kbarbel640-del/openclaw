import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";

vi.mock("../plugins/http-path.js", () => ({
  normalizePluginHttpPath: vi.fn(() => "/line/webhook"),
}));

const unregisterHttp = vi.fn();
vi.mock("../plugins/http-registry.js", () => ({
  registerPluginHttpRoute: vi.fn(() => unregisterHttp),
}));

vi.mock("./webhook-node.js", () => ({
  createLineNodeWebhookHandler: vi.fn(() => vi.fn()),
}));

vi.mock("./bot.js", () => ({
  createLineBot: vi.fn(() => ({
    account: { id: "line-account" },
    handleWebhook: vi.fn(async () => {}),
  })),
}));

import { monitorLineProvider } from "./monitor.js";

describe("monitorLineProvider lifecycle", () => {
  it("stays pending until abortSignal is aborted", async () => {
    const ac = new AbortController();

    const monitorPromise = monitorLineProvider({
      channelAccessToken: "token",
      channelSecret: "secret",
      accountId: "default",
      config: {} as OpenClawConfig,
      runtime: {} as RuntimeEnv,
      abortSignal: ac.signal,
    });

    const settledEarly = await Promise.race([
      monitorPromise.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 25)),
    ]);

    expect(settledEarly).toBe(false);

    ac.abort();

    const monitor = await monitorPromise;
    expect(monitor.account).toEqual({ id: "line-account" });
    expect(unregisterHttp).toHaveBeenCalledTimes(1);
  });
});

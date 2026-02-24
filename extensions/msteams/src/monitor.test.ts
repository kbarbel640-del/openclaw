import { afterEach, describe, expect, it, vi } from "vitest";

// Stub all heavy dependencies so we can test the Promise lifecycle of
// monitorMSTeamsProvider without a real Express server or Microsoft SDK.

const runtimeStub = vi.hoisted(() => ({
  logging: {
    getChildLogger: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    }),
  },
  config: { loadConfig: () => ({}) },
}));

vi.mock("./runtime.js", () => ({
  getMSTeamsRuntime: () => runtimeStub,
}));

vi.mock("./token.js", () => ({
  resolveMSTeamsCredentials: (cfg: unknown) =>
    (cfg as Record<string, unknown>)?.appId
      ? { appId: "test-app", appPassword: "test-pass" }
      : undefined,
}));

vi.mock("./resolve-allowlist.js", () => ({
  resolveMSTeamsUserAllowlist: async () => ({ additions: [], unresolved: [] }),
  resolveMSTeamsChannelAllowlist: async () => ({ additions: [], unresolved: [] }),
}));

vi.mock("./conversation-store-fs.js", () => ({
  createMSTeamsConversationStoreFs: () => ({}),
}));

vi.mock("./polls.js", () => ({
  createMSTeamsPollStoreFs: () => ({}),
}));

vi.mock("./monitor-handler.js", () => ({
  registerMSTeamsHandlers: () => ({ run: vi.fn() }),
}));

vi.mock("./sdk.js", () => ({
  loadMSTeamsSdkWithAuth: async () => ({
    sdk: {
      ActivityHandler: class {},
      MsalTokenProvider: class {},
      authorizeJWT: () => (_req: unknown, _res: unknown, next: () => void) => next(),
    },
    authConfig: {},
  }),
  createMSTeamsAdapter: () => ({
    process: vi.fn(),
  }),
}));

import { monitorMSTeamsProvider } from "./monitor.js";

describe("monitorMSTeamsProvider lifecycle", () => {
  const servers: Array<{ close: () => void }> = [];

  afterEach(() => {
    for (const s of servers) {
      try {
        s.close();
      } catch {
        // already closed
      }
    }
    servers.length = 0;
  });

  it("returns early with null app when msteams is disabled", async () => {
    const result = await monitorMSTeamsProvider({
      cfg: { channels: { msteams: { enabled: false } } } as never,
    });
    expect(result.app).toBeNull();
  });

  it("returns early with null app when credentials are missing", async () => {
    const result = await monitorMSTeamsProvider({
      cfg: { channels: { msteams: { enabled: true } } } as never,
    });
    expect(result.app).toBeNull();
  });

  it("stays pending while the server is running and resolves on close", async () => {
    const controller = new AbortController();

    const promise = monitorMSTeamsProvider({
      cfg: {
        channels: {
          msteams: {
            enabled: true,
            appId: "test-app",
            appPassword: "test-pass",
            port: 0, // random available port
          },
        },
      } as never,
      abortSignal: controller.signal,
    });

    // The promise should stay pending while the server is running.
    const race = await Promise.race([
      promise.then((r) => {
        servers.push({ close: () => r.shutdown() });
        return "resolved" as const;
      }),
      new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 200)),
    ]);
    expect(race).toBe("pending");

    // Signal abort to trigger shutdown → server close → promise resolves
    controller.abort();

    const result = await promise;
    expect(result.app).toBeTruthy();
    expect(typeof result.shutdown).toBe("function");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChannelGatewayContext } from "../channels/plugins/types.js";
import type { ResolvedMessengerAccount } from "./types.js";
import {
  getMessengerBotState,
  isMessengerAccountRunning,
  listRunningMessengerAccounts,
  startMessengerAccount,
  stopMessengerAccount,
} from "./bot.js";

// Mock the probe module
vi.mock("./probe.js", () => ({
  probeMessenger: vi.fn().mockResolvedValue({
    ok: true,
    page: { id: "123456789", name: "Test Page" },
    elapsedMs: 50,
  }),
}));

function createMockContext(
  accountId: string,
  overrides?: Partial<ResolvedMessengerAccount>,
): ChannelGatewayContext<ResolvedMessengerAccount> {
  const status = {
    accountId,
    running: false,
    lastStartAt: null as number | null,
    lastStopAt: null as number | null,
    lastError: null as string | null,
  };

  return {
    cfg: { channels: { messenger: { enabled: true } } },
    accountId,
    account: {
      accountId,
      enabled: true,
      pageAccessToken: "test_token_123",
      tokenSource: "config",
      config: {},
      ...overrides,
    } as ResolvedMessengerAccount,
    runtime: {
      log: () => {},
      error: () => {},
      exit: () => {
        throw new Error("exit");
      },
    },
    abortSignal: new AbortController().signal,
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    getStatus: () => status,
    setStatus: (next) => Object.assign(status, next),
  };
}

describe("startMessengerAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any running accounts
    for (const id of listRunningMessengerAccounts()) {
      const ctx = createMockContext(id);
      await stopMessengerAccount(ctx);
    }
  });

  it("starts an account and returns state", async () => {
    const ctx = createMockContext("test-account");
    const state = await startMessengerAccount(ctx);

    expect(state.accountId).toBe("test-account");
    expect(state.running).toBe(true);
    expect(state.startedAt).toBeGreaterThan(0);
    expect(ctx.log?.info).toHaveBeenCalledWith(
      expect.stringContaining("[test-account] starting Messenger provider"),
    );
  });

  it("updates status on start", async () => {
    const ctx = createMockContext("status-test");
    await startMessengerAccount(ctx);

    const status = ctx.getStatus();
    expect(status.running).toBe(true);
    expect(status.lastStartAt).toBeGreaterThan(0);
    expect(status.lastError).toBeNull();
  });

  it("logs warning when already running", async () => {
    const ctx = createMockContext("duplicate-test");

    await startMessengerAccount(ctx);
    await startMessengerAccount(ctx);

    expect(ctx.log?.warn).toHaveBeenCalledWith(expect.stringContaining("already running"));
  });

  it("includes page name in log when probe succeeds", async () => {
    const ctx = createMockContext("probe-test");
    await startMessengerAccount(ctx);

    expect(ctx.log?.info).toHaveBeenCalledWith(expect.stringContaining("(Test Page)"));
  });
});

describe("stopMessengerAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    for (const id of listRunningMessengerAccounts()) {
      const ctx = createMockContext(id);
      await stopMessengerAccount(ctx);
    }
  });

  it("stops a running account", async () => {
    const ctx = createMockContext("stop-test");

    await startMessengerAccount(ctx);
    expect(isMessengerAccountRunning("stop-test")).toBe(true);

    await stopMessengerAccount(ctx);
    expect(isMessengerAccountRunning("stop-test")).toBe(false);
  });

  it("updates status on stop", async () => {
    const ctx = createMockContext("stop-status-test");

    await startMessengerAccount(ctx);
    await stopMessengerAccount(ctx);

    const status = ctx.getStatus();
    expect(status.running).toBe(false);
    expect(status.lastStopAt).toBeGreaterThan(0);
  });

  it("handles stopping non-running account gracefully", async () => {
    const ctx = createMockContext("not-running");
    await stopMessengerAccount(ctx);

    expect(ctx.log?.debug).toHaveBeenCalledWith(expect.stringContaining("not running"));
  });

  it("logs stop message", async () => {
    const ctx = createMockContext("log-stop");

    await startMessengerAccount(ctx);
    await stopMessengerAccount(ctx);

    expect(ctx.log?.info).toHaveBeenCalledWith(
      expect.stringContaining("stopping Messenger provider"),
    );
  });
});

describe("getMessengerBotState", () => {
  afterEach(async () => {
    for (const id of listRunningMessengerAccounts()) {
      const ctx = createMockContext(id);
      await stopMessengerAccount(ctx);
    }
  });

  it("returns undefined for non-existent account", () => {
    const state = getMessengerBotState("non-existent");
    expect(state).toBeUndefined();
  });

  it("returns state for running account", async () => {
    const ctx = createMockContext("state-test");
    await startMessengerAccount(ctx);

    const state = getMessengerBotState("state-test");
    expect(state).toBeDefined();
    expect(state?.accountId).toBe("state-test");
    expect(state?.running).toBe(true);
  });
});

describe("isMessengerAccountRunning", () => {
  afterEach(async () => {
    for (const id of listRunningMessengerAccounts()) {
      const ctx = createMockContext(id);
      await stopMessengerAccount(ctx);
    }
  });

  it("returns false for non-existent account", () => {
    expect(isMessengerAccountRunning("non-existent")).toBe(false);
  });

  it("returns true for running account", async () => {
    const ctx = createMockContext("running-check");
    await startMessengerAccount(ctx);

    expect(isMessengerAccountRunning("running-check")).toBe(true);
  });

  it("returns false after account is stopped", async () => {
    const ctx = createMockContext("stopped-check");
    await startMessengerAccount(ctx);
    await stopMessengerAccount(ctx);

    expect(isMessengerAccountRunning("stopped-check")).toBe(false);
  });
});

describe("listRunningMessengerAccounts", () => {
  afterEach(async () => {
    for (const id of listRunningMessengerAccounts()) {
      const ctx = createMockContext(id);
      await stopMessengerAccount(ctx);
    }
  });

  it("returns empty array when no accounts running", () => {
    const accounts = listRunningMessengerAccounts();
    expect(accounts).toEqual([]);
  });

  it("returns list of running account IDs", async () => {
    const ctx1 = createMockContext("account-1");
    const ctx2 = createMockContext("account-2");

    await startMessengerAccount(ctx1);
    await startMessengerAccount(ctx2);

    const accounts = listRunningMessengerAccounts();
    expect(accounts).toContain("account-1");
    expect(accounts).toContain("account-2");
    expect(accounts.length).toBe(2);
  });

  it("excludes stopped accounts", async () => {
    const ctx1 = createMockContext("active");
    const ctx2 = createMockContext("stopped");

    await startMessengerAccount(ctx1);
    await startMessengerAccount(ctx2);
    await stopMessengerAccount(ctx2);

    const accounts = listRunningMessengerAccounts();
    expect(accounts).toContain("active");
    expect(accounts).not.toContain("stopped");
  });
});

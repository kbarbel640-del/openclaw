import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { McpHealthMonitor, resetHealthMonitorForTest } from "./health.js";
import type { McpServerConnection, McpServerConfig } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConnection(overrides: Partial<McpServerConnection> = {}): McpServerConnection {
  const config: McpServerConfig = {
    command: "echo",
    healthCheckIntervalMs: 5000,
    ...((overrides.config as McpServerConfig) ?? {}),
  };

  return {
    name: "test-server",
    config,
    tools: [],
    status: "connected",
    callTool: vi.fn().mockResolvedValue({ content: [], isError: false }),
    ping: vi.fn().mockResolvedValue(true),
    reconnect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("McpHealthMonitor", () => {
  let monitor: McpHealthMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
    monitor = new McpHealthMonitor();
  });

  afterEach(() => {
    monitor.stopAll();
    resetHealthMonitorForTest();
    vi.useRealTimers();
  });

  it("registers a connection and tracks it", () => {
    const conn = makeConnection();
    monitor.register(conn);
    expect(monitor.size).toBe(1);
  });

  it("does not double-register the same server", () => {
    const conn = makeConnection();
    monitor.register(conn);
    monitor.register(conn);
    expect(monitor.size).toBe(1);
  });

  it("skips registration when interval is 0 or negative", () => {
    const conn = makeConnection({
      config: { command: "echo", healthCheckIntervalMs: 0 },
    });
    monitor.register(conn, 0);
    expect(monitor.size).toBe(0);
  });

  it("unregister removes a connection", () => {
    const conn = makeConnection();
    monitor.register(conn);
    expect(monitor.size).toBe(1);
    monitor.unregister("test-server");
    expect(monitor.size).toBe(0);
  });

  it("stopAll clears all entries", () => {
    monitor.register(makeConnection({ name: "a" }));
    monitor.register(makeConnection({ name: "b" }));
    expect(monitor.size).toBe(2);
    monitor.stopAll();
    expect(monitor.size).toBe(0);
  });

  it("checkNow returns true when ping succeeds", async () => {
    const conn = makeConnection();
    monitor.register(conn);
    const result = await monitor.checkNow("test-server");
    expect(result).toBe(true);
    expect(conn.ping).toHaveBeenCalledOnce();
  });

  it("checkNow returns false when ping fails", async () => {
    const conn = makeConnection({
      ping: vi.fn().mockResolvedValue(false),
    });
    monitor.register(conn);
    const result = await monitor.checkNow("test-server");
    expect(result).toBe(false);
  });

  it("checkNow returns false for unknown server", async () => {
    const result = await monitor.checkNow("nonexistent");
    expect(result).toBe(false);
  });

  it("triggers reconnect after 3 consecutive failures", async () => {
    const conn = makeConnection({
      ping: vi.fn().mockResolvedValue(false),
    });
    monitor.register(conn);

    // 3 failed pings should trigger reconnect.
    await monitor.checkNow("test-server");
    await monitor.checkNow("test-server");
    await monitor.checkNow("test-server");

    expect(conn.reconnect).toHaveBeenCalledOnce();
  });

  it("does not reconnect after fewer than 3 failures", async () => {
    const conn = makeConnection({
      ping: vi.fn().mockResolvedValue(false),
    });
    monitor.register(conn);

    await monitor.checkNow("test-server");
    await monitor.checkNow("test-server");

    expect(conn.reconnect).not.toHaveBeenCalled();
  });

  it("resets failure count on successful ping", async () => {
    let pingCount = 0;
    const conn = makeConnection({
      ping: vi.fn().mockImplementation(async () => {
        pingCount++;
        // Fail first 2, succeed third.
        return pingCount > 2;
      }),
    });
    monitor.register(conn);

    await monitor.checkNow("test-server"); // fail 1
    await monitor.checkNow("test-server"); // fail 2
    await monitor.checkNow("test-server"); // success → resets

    const status = monitor.getStatus().get("test-server");
    expect(status?.consecutiveFailures).toBe(0);
    expect(conn.reconnect).not.toHaveBeenCalled();
  });

  it("getStatus reports consecutive failures and reconnecting state", async () => {
    const conn = makeConnection({
      ping: vi.fn().mockResolvedValue(false),
    });
    monitor.register(conn);

    await monitor.checkNow("test-server");
    await monitor.checkNow("test-server");

    const status = monitor.getStatus().get("test-server");
    expect(status).toEqual({
      consecutiveFailures: 2,
      reconnecting: false,
    });
  });

  it("uses config healthCheckIntervalMs when no override", () => {
    const conn = makeConnection({
      config: { command: "echo", healthCheckIntervalMs: 10_000 },
    });
    monitor.register(conn);
    expect(monitor.size).toBe(1);
  });

  it("skips registration after stopAll", () => {
    monitor.stopAll();
    const conn = makeConnection();
    monitor.register(conn);
    expect(monitor.size).toBe(0);
  });
});

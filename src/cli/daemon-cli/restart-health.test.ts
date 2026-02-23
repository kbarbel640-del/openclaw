import { beforeEach, describe, expect, it, vi } from "vitest";

const inspectPortUsage = vi.fn();
const readRuntime = vi.fn();
const readFileMock = vi.fn();

vi.mock("node:fs/promises", () => ({
  default: { readFile: (...args: unknown[]) => readFileMock(...args) },
}));

vi.mock("../../infra/ports.js", () => ({
  inspectPortUsage: (...args: unknown[]) => inspectPortUsage(...args),
  classifyPortListener: (listener: { commandLine?: string; command?: string }) => {
    const raw = `${listener.commandLine ?? ""} ${listener.command ?? ""}`.toLowerCase();
    return raw.includes("openclaw") ? "gateway" : "unknown";
  },
  formatPortDiagnostics: () => [],
}));

function makeService() {
  return {
    readRuntime: readRuntime,
    readCommand: vi.fn(),
    isLoaded: vi.fn(),
    install: vi.fn(),
    uninstall: vi.fn(),
    stop: vi.fn(),
    restart: vi.fn(),
    label: "systemd",
    loadedText: "enabled",
    notLoadedText: "disabled",
  };
}

describe("inspectGatewayRestart", () => {
  beforeEach(() => {
    vi.resetModules();
    inspectPortUsage.mockReset();
    readRuntime.mockReset();
    readFileMock.mockReset();
  });

  it("reports healthy when runtime pid directly owns the port", async () => {
    readRuntime.mockResolvedValue({ status: "running", pid: 1000 });
    inspectPortUsage.mockResolvedValue({
      port: 18789,
      status: "busy",
      listeners: [{ pid: 1000, commandLine: "openclaw-gateway", address: "127.0.0.1:18789" }],
      hints: [],
    });

    const { inspectGatewayRestart } = await import("./restart-health.js");
    const snapshot = await inspectGatewayRestart({ service: makeService(), port: 18789 });

    expect(snapshot.healthy).toBe(true);
    expect(snapshot.staleGatewayPids).toEqual([]);
  });

  it("reports healthy when a descendant process of runtime pid owns the port", async () => {
    readRuntime.mockResolvedValue({ status: "running", pid: 1000 });
    inspectPortUsage.mockResolvedValue({
      port: 18789,
      status: "busy",
      listeners: [{ pid: 1020, commandLine: "openclaw-gateway", address: "127.0.0.1:18789" }],
      hints: [],
    });

    // Simulate /proc/1020/status showing PPid: 1010 -> 1000
    readFileMock.mockImplementation(async (path: string) => {
      if (path === "/proc/1020/status") {
        return "Name:\topenclaw-gateway\nPPid:\t1010\nPid:\t1020\n";
      }
      if (path === "/proc/1010/status") {
        return "Name:\topenclaw-gateway\nPPid:\t1000\nPid:\t1010\n";
      }
      throw new Error("ENOENT");
    });

    // Override platform check for this test
    const origPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    try {
      const { inspectGatewayRestart } = await import("./restart-health.js");
      const snapshot = await inspectGatewayRestart({ service: makeService(), port: 18789 });

      expect(snapshot.healthy).toBe(true);
      expect(snapshot.staleGatewayPids).toEqual([]);
    } finally {
      Object.defineProperty(process, "platform", { value: origPlatform, configurable: true });
    }
  });

  it("does not mark descendant process of runtime pid as stale", async () => {
    readRuntime.mockResolvedValue({ status: "running", pid: 1000 });
    inspectPortUsage.mockResolvedValue({
      port: 18789,
      status: "busy",
      listeners: [{ pid: 1020, commandLine: "openclaw-gateway", address: "127.0.0.1:18789" }],
      hints: [],
    });

    readFileMock.mockImplementation(async (path: string) => {
      if (path === "/proc/1020/status") {
        return "Name:\topenclaw-gateway\nPPid:\t1010\nPid:\t1020\n";
      }
      if (path === "/proc/1010/status") {
        return "Name:\topenclaw-gateway\nPPid:\t1000\nPid:\t1010\n";
      }
      throw new Error("ENOENT");
    });

    const origPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    try {
      const { inspectGatewayRestart } = await import("./restart-health.js");
      const snapshot = await inspectGatewayRestart({ service: makeService(), port: 18789 });

      expect(snapshot.staleGatewayPids).toEqual([]);
    } finally {
      Object.defineProperty(process, "platform", { value: origPlatform, configurable: true });
    }
  });

  it("marks unrelated gateway pids as stale", async () => {
    readRuntime.mockResolvedValue({ status: "running", pid: 1000 });
    inspectPortUsage.mockResolvedValue({
      port: 18789,
      status: "busy",
      listeners: [{ pid: 2000, commandLine: "openclaw-gateway", address: "127.0.0.1:18789" }],
      hints: [],
    });

    readFileMock.mockImplementation(async (path: string) => {
      if (path === "/proc/2000/status") {
        return "Name:\topenclaw-gateway\nPPid:\t1999\nPid:\t2000\n";
      }
      throw new Error("ENOENT");
    });

    const origPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    try {
      const { inspectGatewayRestart } = await import("./restart-health.js");
      const snapshot = await inspectGatewayRestart({ service: makeService(), port: 18789 });

      expect(snapshot.healthy).toBe(false);
      expect(snapshot.staleGatewayPids).toEqual([2000]);
    } finally {
      Object.defineProperty(process, "platform", { value: origPlatform, configurable: true });
    }
  });

  it("falls back gracefully on non-linux (no child pid detection)", async () => {
    readRuntime.mockResolvedValue({ status: "running", pid: 1000 });
    inspectPortUsage.mockResolvedValue({
      port: 18789,
      status: "busy",
      listeners: [{ pid: 1010, commandLine: "openclaw-gateway", address: "127.0.0.1:18789" }],
      hints: [],
    });

    const origPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    try {
      const { inspectGatewayRestart } = await import("./restart-health.js");
      const snapshot = await inspectGatewayRestart({ service: makeService(), port: 18789 });

      // On non-linux, readParentPid returns null so child detection doesn't apply.
      // The port listener PID 1010 != runtime PID 1000, so ownsPort is false.
      expect(snapshot.healthy).toBe(false);
      expect(snapshot.staleGatewayPids).toEqual([1010]);
    } finally {
      Object.defineProperty(process, "platform", { value: origPlatform, configurable: true });
    }
  });
});

describe("readParentPid", () => {
  beforeEach(() => {
    vi.resetModules();
    readFileMock.mockReset();
  });

  it("returns ppid from /proc on linux", async () => {
    readFileMock.mockResolvedValue("Name:\tnode\nPPid:\t42\nPid:\t100\n");

    const origPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    try {
      const { readParentPid } = await import("./restart-health.js");
      expect(await readParentPid(100)).toBe(42);
    } finally {
      Object.defineProperty(process, "platform", { value: origPlatform, configurable: true });
    }
  });

  it("returns null on non-linux", async () => {
    const origPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    try {
      const { readParentPid } = await import("./restart-health.js");
      expect(await readParentPid(100)).toBeNull();
    } finally {
      Object.defineProperty(process, "platform", { value: origPlatform, configurable: true });
    }
  });

  it("returns null when /proc read fails", async () => {
    readFileMock.mockRejectedValue(new Error("ENOENT"));

    const origPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    try {
      const { readParentPid } = await import("./restart-health.js");
      expect(await readParentPid(99999)).toBeNull();
    } finally {
      Object.defineProperty(process, "platform", { value: origPlatform, configurable: true });
    }
  });
});

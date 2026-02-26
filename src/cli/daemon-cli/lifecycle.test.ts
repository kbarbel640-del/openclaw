import { beforeEach, describe, expect, it, vi } from "vitest";

type RestartHealthSnapshot = {
  healthy: boolean;
  staleGatewayPids: number[];
  runtime: { status?: string };
  portUsage: { port: number; status: string; listeners: []; hints: []; errors?: string[] };
};

type RestartPostCheckContext = {
  json: boolean;
  stdout: NodeJS.WritableStream;
  warnings: string[];
  fail: (message: string, hints?: string[]) => void;
};

type RestartParams = {
  opts?: { json?: boolean };
  postRestartCheck?: (ctx: RestartPostCheckContext) => Promise<void>;
};

type StopPostCheckContext = {
  json: boolean;
  stdout: NodeJS.WritableStream;
  warnings: string[];
  fail: (message: string, hints?: string[]) => void;
};

type StopParams = {
  opts?: { json?: boolean };
  postStopCheck?: (ctx: StopPostCheckContext) => Promise<void>;
};

const service = {
  readCommand: vi.fn(),
  restart: vi.fn(),
};

const runServiceRestart = vi.fn();
const runServiceStop = vi.fn();
const waitForGatewayHealthyRestart = vi.fn();
const inspectGatewayRestart = vi.fn();
const terminateStaleGatewayPids = vi.fn();
const renderRestartDiagnostics = vi.fn(() => ["diag: unhealthy runtime"]);
const resolveGatewayPort = vi.fn(() => 18789);
const loadConfig = vi.fn(() => ({}));

vi.mock("../../config/config.js", () => ({
  loadConfig: () => loadConfig(),
  resolveGatewayPort,
}));

vi.mock("../../daemon/service.js", () => ({
  resolveGatewayService: () => service,
}));

vi.mock("./restart-health.js", () => ({
  DEFAULT_RESTART_HEALTH_ATTEMPTS: 120,
  DEFAULT_RESTART_HEALTH_DELAY_MS: 500,
  waitForGatewayHealthyRestart,
  inspectGatewayRestart,
  terminateStaleGatewayPids,
  renderRestartDiagnostics,
}));

vi.mock("./lifecycle-core.js", () => ({
  runServiceRestart,
  runServiceStart: vi.fn(),
  runServiceStop,
  runServiceUninstall: vi.fn(),
}));

describe("runDaemonRestart health checks", () => {
  beforeEach(() => {
    vi.resetModules();
    service.readCommand.mockReset();
    service.restart.mockReset();
    runServiceRestart.mockReset();
    runServiceStop.mockReset();
    waitForGatewayHealthyRestart.mockReset();
    inspectGatewayRestart.mockReset();
    terminateStaleGatewayPids.mockReset();
    renderRestartDiagnostics.mockClear();
    resolveGatewayPort.mockClear();
    loadConfig.mockClear();

    service.readCommand.mockResolvedValue({
      programArguments: ["openclaw", "gateway", "--port", "18789"],
      environment: {},
    });

    runServiceRestart.mockImplementation(async (params: RestartParams) => {
      const fail = (message: string, hints?: string[]) => {
        const err = new Error(message) as Error & { hints?: string[] };
        err.hints = hints;
        throw err;
      };
      await params.postRestartCheck?.({
        json: Boolean(params.opts?.json),
        stdout: process.stdout,
        warnings: [],
        fail,
      });
      return true;
    });

    runServiceStop.mockImplementation(async (params: StopParams) => {
      const fail = (message: string, hints?: string[]) => {
        const err = new Error(message) as Error & { hints?: string[] };
        err.hints = hints;
        throw err;
      };
      await params.postStopCheck?.({
        json: Boolean(params.opts?.json),
        stdout: process.stdout,
        warnings: [],
        fail,
      });
      return true;
    });
  });

  it("kills stale gateway pids and retries restart", async () => {
    const unhealthy: RestartHealthSnapshot = {
      healthy: false,
      staleGatewayPids: [1993],
      runtime: { status: "stopped" },
      portUsage: { port: 18789, status: "busy", listeners: [], hints: [] },
    };
    const healthy: RestartHealthSnapshot = {
      healthy: true,
      staleGatewayPids: [],
      runtime: { status: "running" },
      portUsage: { port: 18789, status: "busy", listeners: [], hints: [] },
    };
    waitForGatewayHealthyRestart.mockResolvedValueOnce(unhealthy).mockResolvedValueOnce(healthy);
    terminateStaleGatewayPids.mockResolvedValue([1993]);

    const { runDaemonRestart } = await import("./lifecycle.js");
    const result = await runDaemonRestart({ json: true });

    expect(result).toBe(true);
    expect(terminateStaleGatewayPids).toHaveBeenCalledWith([1993]);
    expect(service.restart).toHaveBeenCalledTimes(1);
    expect(waitForGatewayHealthyRestart).toHaveBeenCalledTimes(2);
  });

  it("fails restart when gateway remains unhealthy", async () => {
    const unhealthy: RestartHealthSnapshot = {
      healthy: false,
      staleGatewayPids: [],
      runtime: { status: "stopped" },
      portUsage: { port: 18789, status: "free", listeners: [], hints: [] },
    };
    waitForGatewayHealthyRestart.mockResolvedValue(unhealthy);

    const { runDaemonRestart } = await import("./lifecycle.js");

    await expect(runDaemonRestart({ json: true })).rejects.toMatchObject({
      message: "Gateway restart timed out after 60s waiting for health checks.",
      hints: ["openclaw gateway status --deep", "openclaw doctor"],
    });
    expect(terminateStaleGatewayPids).not.toHaveBeenCalled();
    expect(renderRestartDiagnostics).toHaveBeenCalledTimes(1);
  });

  it("kills lingering gateway pids after stop on Windows", async () => {
    const stale: RestartHealthSnapshot = {
      healthy: false,
      staleGatewayPids: [42812],
      runtime: { status: "stopped" },
      portUsage: { port: 18789, status: "busy", listeners: [], hints: [] },
    };
    const clean: RestartHealthSnapshot = {
      healthy: true,
      staleGatewayPids: [],
      runtime: { status: "stopped" },
      portUsage: { port: 18789, status: "free", listeners: [], hints: [] },
    };
    inspectGatewayRestart.mockResolvedValueOnce(stale).mockResolvedValueOnce(clean);
    terminateStaleGatewayPids.mockResolvedValue([42812]);

    const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", { value: "win32" });
    try {
      const { runDaemonStop } = await import("./lifecycle.js");
      await runDaemonStop({ json: true });
    } finally {
      if (originalPlatform) {
        Object.defineProperty(process, "platform", originalPlatform);
      }
    }

    expect(terminateStaleGatewayPids).toHaveBeenCalledWith([42812]);
    expect(inspectGatewayRestart).toHaveBeenCalledTimes(2);
  });

  it("fails stop when lingering gateway pids remain after cleanup", async () => {
    const stale: RestartHealthSnapshot = {
      healthy: false,
      staleGatewayPids: [42812],
      runtime: { status: "stopped" },
      portUsage: { port: 18789, status: "busy", listeners: [], hints: [] },
    };
    inspectGatewayRestart.mockResolvedValueOnce(stale).mockResolvedValueOnce(stale);
    terminateStaleGatewayPids.mockResolvedValue([42812]);

    const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", { value: "win32" });
    try {
      const { runDaemonStop } = await import("./lifecycle.js");
      await expect(runDaemonStop({ json: true })).rejects.toMatchObject({
        message: "Gateway stop failed health checks.",
      });
    } finally {
      if (originalPlatform) {
        Object.defineProperty(process, "platform", originalPlatform);
      }
    }

    expect(terminateStaleGatewayPids).toHaveBeenCalledWith([42812]);
    expect(renderRestartDiagnostics).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayServiceRuntime } from "../../daemon/service-runtime.js";
import type { GatewayService } from "../../daemon/service.js";

const inspectPortUsageMock = vi.fn();
const classifyPortListenerMock = vi.fn();
const formatPortDiagnosticsMock = vi.fn(() => []);

vi.mock("../../infra/ports.js", () => ({
  inspectPortUsage: (...args: unknown[]) => inspectPortUsageMock(...args),
  classifyPortListener: (...args: unknown[]) => classifyPortListenerMock(...args),
  formatPortDiagnostics: (...args: unknown[]) => formatPortDiagnosticsMock(...args),
}));

vi.mock("../../process/kill-tree.js", () => ({
  killProcessTree: vi.fn(),
}));

import { inspectGatewayRestart } from "./restart-health.js";

const service = {
  readRuntime: vi.fn<() => Promise<GatewayServiceRuntime>>(),
} as unknown as GatewayService;

const originalPlatform = process.platform;

describe("inspectGatewayRestart", () => {
  beforeEach(() => {
    inspectPortUsageMock.mockReset();
    classifyPortListenerMock.mockReset();
    formatPortDiagnosticsMock.mockReset();
    service.readRuntime = vi.fn<() => Promise<GatewayServiceRuntime>>();

    inspectPortUsageMock.mockResolvedValue({
      port: 18789,
      status: "busy",
      listeners: [{ pid: 10920, command: "unknown" }],
      hints: [],
    });
    classifyPortListenerMock.mockReturnValue("unknown");
    service.readRuntime.mockResolvedValue({ status: "stopped" });
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
  });

  it("treats unknown listeners as stale on Windows when enabled", async () => {
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });

    const snapshot = await inspectGatewayRestart({
      service,
      port: 18789,
      includeUnknownListenersAsStale: true,
    });

    expect(snapshot.staleGatewayPids).toEqual([10920]);
  });

  it("does not treat unknown listeners as stale when fallback is disabled", async () => {
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });

    const snapshot = await inspectGatewayRestart({
      service,
      port: 18789,
      includeUnknownListenersAsStale: false,
    });

    expect(snapshot.staleGatewayPids).toEqual([]);
  });

  it("does not apply unknown-listener fallback while runtime is running", async () => {
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    service.readRuntime.mockResolvedValue({ status: "running", pid: 10920 });

    const snapshot = await inspectGatewayRestart({
      service,
      port: 18789,
      includeUnknownListenersAsStale: true,
    });

    expect(snapshot.staleGatewayPids).toEqual([]);
  });
});

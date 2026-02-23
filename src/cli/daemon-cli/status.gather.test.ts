import { describe, expect, it } from "vitest";
import type { DaemonStatus } from "./status.gather.js";
import { renderPortDiagnosticsForCli } from "./status.gather.js";

function makeStatus(overrides: Partial<DaemonStatus> = {}): DaemonStatus {
  return {
    service: {
      label: "openclaw-gateway",
      loaded: true,
      loadedText: "loaded",
      notLoadedText: "not loaded",
      runtime: { status: "running", pid: 1037 },
    },
    port: {
      port: 18789,
      status: "busy",
      listeners: [
        {
          pid: 1127,
          command: "openclaw-gateway",
          commandLine: "node /usr/lib/node_modules/openclaw/dist/index.js gateway run",
          user: "root",
          address: "127.0.0.1:18789",
        },
      ],
      hints: [
        "Gateway already running locally. Stop it (openclaw gateway stop) or use a different port.",
      ],
    },
    extraServices: [],
    ...overrides,
  };
}

describe("renderPortDiagnosticsForCli", () => {
  it("suppresses port conflict when rpcOk is true", () => {
    const status = makeStatus();
    const lines = renderPortDiagnosticsForCli(status, true);
    expect(lines).toEqual([]);
  });

  it("reports port conflict for non-gateway listeners when rpc is unavailable", () => {
    const status = makeStatus({
      port: {
        port: 18789,
        status: "busy",
        listeners: [
          {
            pid: 9999,
            command: "nginx",
            commandLine: "nginx: master process",
            user: "root",
            address: "127.0.0.1:18789",
          },
        ],
        hints: ["Another process is listening on this port."],
      },
    });
    const lines = renderPortDiagnosticsForCli(status, undefined);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toContain("Port 18789 is already in use");
  });

  it("suppresses port conflict when service is running and all listeners are gateway processes (systemd case)", () => {
    // Simulates: systemd service PID=1037, but actual gateway child PID=1127
    // The listener is classified as "gateway" because commandLine contains "openclaw"
    // Even without RPC probe, this should NOT report a port conflict
    const status = makeStatus();
    const lines = renderPortDiagnosticsForCli(status, undefined);
    expect(lines).toEqual([]);
  });

  it("suppresses port conflict when service is running and listener PID matches runtime PID", () => {
    const status = makeStatus({
      service: {
        label: "openclaw-gateway",
        loaded: true,
        loadedText: "loaded",
        notLoadedText: "not loaded",
        runtime: { status: "running", pid: 1127 },
      },
    });
    const lines = renderPortDiagnosticsForCli(status, undefined);
    expect(lines).toEqual([]);
  });

  it("reports port conflict when service is not running but port is busy", () => {
    const status = makeStatus({
      service: {
        label: "openclaw-gateway",
        loaded: true,
        loadedText: "loaded",
        notLoadedText: "not loaded",
        runtime: { status: "stopped" },
      },
    });
    const lines = renderPortDiagnosticsForCli(status, undefined);
    expect(lines.length).toBeGreaterThan(0);
  });
});

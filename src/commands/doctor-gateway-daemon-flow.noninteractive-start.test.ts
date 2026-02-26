import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";

const mocks = vi.hoisted(() => ({
  isLoaded: vi.fn(),
  readRuntime: vi.fn(),
  restart: vi.fn(),
  readLastGatewayErrorLine: vi.fn(),
  inspectPortUsage: vi.fn(),
  formatPortDiagnostics: vi.fn(() => []),
  note: vi.fn(),
  sleep: vi.fn(),
  healthCommand: vi.fn(),
  formatHealthCheckFailure: vi.fn((err: unknown) => String(err)),
  resolveGatewayPort: vi.fn(() => 18789),
  buildGatewayRuntimeHints: vi.fn(() => []),
  formatGatewayRuntimeSummary: vi.fn(() => ""),
  isSystemdUserServiceAvailable: vi.fn(() => true),
  renderSystemdUnavailableHints: vi.fn(() => []),
  isWSL: vi.fn(() => false),
  isLaunchAgentListed: vi.fn(() => false),
  isLaunchAgentLoaded: vi.fn(() => false),
  launchAgentPlistExists: vi.fn(() => false),
  repairLaunchAgentBootstrap: vi.fn(),
}));

vi.mock("../cli/command-format.js", () => ({
  formatCliCommand: (command: string) => command,
}));

vi.mock("../config/config.js", () => ({
  resolveGatewayPort: mocks.resolveGatewayPort,
}));

vi.mock("../daemon/constants.js", () => ({
  resolveGatewayLaunchAgentLabel: vi.fn(() => "ai.openclaw.gateway"),
  resolveNodeLaunchAgentLabel: vi.fn(() => "ai.openclaw.node"),
}));

vi.mock("../daemon/diagnostics.js", () => ({
  readLastGatewayErrorLine: mocks.readLastGatewayErrorLine,
}));

vi.mock("../daemon/launchd.js", () => ({
  isLaunchAgentListed: mocks.isLaunchAgentListed,
  isLaunchAgentLoaded: mocks.isLaunchAgentLoaded,
  launchAgentPlistExists: mocks.launchAgentPlistExists,
  repairLaunchAgentBootstrap: mocks.repairLaunchAgentBootstrap,
}));

vi.mock("../daemon/service.js", () => ({
  resolveGatewayService: () => ({
    isLoaded: mocks.isLoaded,
    readRuntime: mocks.readRuntime,
    restart: mocks.restart,
  }),
}));

vi.mock("../daemon/systemd-hints.js", () => ({
  renderSystemdUnavailableHints: mocks.renderSystemdUnavailableHints,
}));

vi.mock("../daemon/systemd.js", () => ({
  isSystemdUserServiceAvailable: mocks.isSystemdUserServiceAvailable,
}));

vi.mock("../infra/ports.js", () => ({
  inspectPortUsage: mocks.inspectPortUsage,
  formatPortDiagnostics: mocks.formatPortDiagnostics,
}));

vi.mock("../infra/wsl.js", () => ({
  isWSL: mocks.isWSL,
}));

vi.mock("../terminal/note.js", () => ({
  note: mocks.note,
}));

vi.mock("../utils.js", () => ({
  sleep: mocks.sleep,
}));

vi.mock("./daemon-install-helpers.js", () => ({
  buildGatewayInstallPlan: vi.fn(),
  gatewayInstallErrorHint: vi.fn(() => "hint"),
}));

vi.mock("./daemon-runtime.js", () => ({
  DEFAULT_GATEWAY_DAEMON_RUNTIME: "node",
  GATEWAY_DAEMON_RUNTIME_OPTIONS: [],
}));

vi.mock("./doctor-format.js", () => ({
  buildGatewayRuntimeHints: mocks.buildGatewayRuntimeHints,
  formatGatewayRuntimeSummary: mocks.formatGatewayRuntimeSummary,
}));

vi.mock("./health-format.js", () => ({
  formatHealthCheckFailure: mocks.formatHealthCheckFailure,
}));

vi.mock("./health.js", () => ({
  healthCommand: mocks.healthCommand,
}));

import { maybeRepairGatewayDaemon } from "./doctor-gateway-daemon-flow.js";

function makeRuntime() {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  };
}

function makePrompter() {
  return {
    confirm: vi.fn().mockResolvedValue(false),
    confirmRepair: vi.fn().mockResolvedValue(false),
    confirmAggressive: vi.fn().mockResolvedValue(false),
    confirmSkipInNonInteractive: vi.fn().mockResolvedValue(false),
    select: vi.fn().mockResolvedValue("node"),
    shouldRepair: false,
    shouldForce: false,
  };
}

describe("maybeRepairGatewayDaemon non-interactive startup recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isLoaded.mockResolvedValue(true);
    mocks.inspectPortUsage.mockResolvedValue({
      port: 18789,
      status: "free",
      listeners: [],
      hints: [],
    });
    mocks.restart.mockResolvedValue(undefined);
    mocks.sleep.mockResolvedValue(undefined);
    mocks.healthCommand.mockResolvedValue(undefined);
  });

  it("auto-starts gateway in non-interactive mode when service is loaded but stopped", async () => {
    mocks.readRuntime
      .mockResolvedValueOnce({ status: "stopped", state: "activating", lastExitStatus: 1 })
      .mockResolvedValueOnce({ status: "running", state: "active" });
    const runtime = makeRuntime();
    const prompter = makePrompter();
    const cfg: OpenClawConfig = {
      gateway: {
        mode: "local",
      },
    };

    await maybeRepairGatewayDaemon({
      cfg,
      runtime,
      prompter,
      options: { nonInteractive: true },
      gatewayDetailsMessage: "gateway details",
      healthOk: false,
    });

    expect(mocks.restart).toHaveBeenCalledTimes(1);
    expect(runtime.log).toHaveBeenCalledWith(
      "Attempting automatic gateway start after non-interactive doctor repairs.",
    );
    expect(prompter.confirmSkipInNonInteractive).not.toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Start gateway service now?",
      }),
    );
  });

  it("keeps prompt-gated behavior in interactive mode", async () => {
    mocks.readRuntime.mockResolvedValue({
      status: "stopped",
      state: "activating",
      lastExitStatus: 1,
    });
    const runtime = makeRuntime();
    const prompter = makePrompter();
    const cfg: OpenClawConfig = {
      gateway: {
        mode: "local",
      },
    };

    await maybeRepairGatewayDaemon({
      cfg,
      runtime,
      prompter,
      options: { nonInteractive: false },
      gatewayDetailsMessage: "gateway details",
      healthOk: false,
    });

    expect(prompter.confirmSkipInNonInteractive).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Start gateway service now?",
      }),
    );
    expect(mocks.restart).not.toHaveBeenCalled();
  });
});

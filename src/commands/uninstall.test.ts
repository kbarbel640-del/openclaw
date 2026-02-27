import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../runtime.js";

const { bootoutMock, resolveCleanupPlanMock } = vi.hoisted(() => ({
  bootoutMock: vi.fn().mockResolvedValue(undefined),
  resolveCleanupPlanMock: vi.fn().mockReturnValue({
    stateDir: "/tmp/openclaw-state",
    configPath: "/tmp/openclaw-state/openclaw.json",
    oauthDir: "/tmp/openclaw-oauth",
    configInsideState: true,
    oauthInsideState: true,
    workspaceDirs: [],
  }),
}));

vi.mock("../daemon/launchd.js", () => ({
  bootoutLaunchAgentByLabel: bootoutMock,
}));

vi.mock("./cleanup-plan.js", () => ({
  resolveCleanupPlanFromDisk: resolveCleanupPlanMock,
}));

vi.mock("../daemon/service.js", () => ({
  resolveGatewayService: vi.fn(),
}));

import { uninstallCommand } from "./uninstall.js";

function makeRuntime() {
  return {
    log: vi.fn<(message: string) => void>(),
    error: vi.fn<(message: string) => void>(),
    exit: vi.fn<(code: number) => void>(),
  } as unknown as RuntimeEnv & {
    log: ReturnType<typeof vi.fn<(message: string) => void>>;
    error: ReturnType<typeof vi.fn<(message: string) => void>>;
  };
}

describe("uninstallCommand --app on macOS", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    Object.defineProperty(process, "platform", { configurable: true, value: "darwin" });
    bootoutMock.mockReset();
    bootoutMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: originalPlatform,
    });
    vi.restoreAllMocks();
  });

  it("logs both the app bundle and the LaunchAgent plist in dry-run mode", async () => {
    const runtime = makeRuntime();
    await uninstallCommand(runtime, { app: true, yes: true, nonInteractive: true, dryRun: true });

    const logs = runtime.log.mock.calls.map(([l]: [string]) => l).join("\n");
    expect(logs).toContain("/Applications/OpenClaw.app");
    expect(logs).toContain("ai.openclaw.mac.plist");
  });

  it("does not attempt bootout in dry-run mode", async () => {
    const runtime = makeRuntime();
    await uninstallCommand(runtime, { app: true, yes: true, nonInteractive: true, dryRun: true });

    expect(bootoutMock).not.toHaveBeenCalled();
  });

  it("attempts bootout when not in dry-run mode", async () => {
    const runtime = makeRuntime();
    await uninstallCommand(runtime, { app: true, yes: true, nonInteractive: true });

    expect(bootoutMock).toHaveBeenCalledWith("ai.openclaw.mac", expect.any(Object));
  });

  it("does not remove LaunchAgent plist on non-darwin platforms", async () => {
    Object.defineProperty(process, "platform", { configurable: true, value: "linux" });
    const runtime = makeRuntime();
    await uninstallCommand(runtime, { app: true, yes: true, nonInteractive: true, dryRun: true });

    const logs = runtime.log.mock.calls.map(([l]: [string]) => l).join("\n");
    expect(logs).not.toContain("ai.openclaw.mac.plist");
  });
});

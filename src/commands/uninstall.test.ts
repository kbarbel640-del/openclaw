import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(async () => true),
  multiselect: vi.fn(async () => ["service", "state", "workspace"]),
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
  serviceIsLoaded: vi.fn(async () => false),
  serviceStop: vi.fn(async () => {}),
  serviceUninstall: vi.fn(async () => {}),
  resolveCleanupPlanFromDisk: vi.fn(() => ({
    cfg: {} as Record<string, unknown>,
    stateDir: "/tmp/state",
    configPath: "/tmp/state/openclaw.json",
    oauthDir: "/tmp/state/credentials",
    configInsideState: true,
    oauthInsideState: true,
    workspaceDirs: ["/tmp/workspace"],
  })),
  removePath: vi.fn(async () => ({ ok: true, skipped: true })),
  removeStateAndLinkedPaths: vi.fn(async () => {}),
  removeWorkspaceDirs: vi.fn(async () => {}),
  hasBinary: vi.fn<(name: string) => boolean>(() => false),
  runCommandWithTimeout: vi.fn(async () => ({
    stdout: "",
    stderr: "",
    code: 0,
    signal: null,
    killed: false,
    termination: "exit" as const,
  })),
}));

vi.mock("@clack/prompts", () => ({
  confirm: mocks.confirm,
  multiselect: mocks.multiselect,
  cancel: mocks.cancel,
  isCancel: mocks.isCancel,
}));

vi.mock("../daemon/service.js", () => ({
  resolveGatewayService: () => ({
    isLoaded: mocks.serviceIsLoaded,
    stop: mocks.serviceStop,
    uninstall: mocks.serviceUninstall,
    notLoadedText: "is not installed",
  }),
}));

vi.mock("./cleanup-plan.js", () => ({
  resolveCleanupPlanFromDisk: mocks.resolveCleanupPlanFromDisk,
}));

vi.mock("./cleanup-utils.js", () => ({
  removePath: mocks.removePath,
  removeStateAndLinkedPaths: mocks.removeStateAndLinkedPaths,
  removeWorkspaceDirs: mocks.removeWorkspaceDirs,
}));

vi.mock("../agents/skills.js", () => ({
  hasBinary: mocks.hasBinary,
}));

vi.mock("../process/exec.js", () => ({
  runCommandWithTimeout: mocks.runCommandWithTimeout,
}));

import { uninstallCommand } from "./uninstall.js";

function createRuntime() {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  };
}

describe("uninstallCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires explicit scope in non-interactive mode", async () => {
    const runtime = createRuntime();
    await uninstallCommand(runtime, { nonInteractive: true, yes: true });
    expect(runtime.error).toHaveBeenCalledWith(
      "Non-interactive mode requires explicit scopes (use --all).",
    );
    expect(runtime.exit).toHaveBeenCalledWith(1);
  });

  it("accepts --zap as explicit scope in non-interactive dry-run", async () => {
    const runtime = createRuntime();
    mocks.hasBinary.mockImplementation((name: string) => name === "npm");

    await uninstallCommand(runtime, {
      zap: true,
      nonInteractive: true,
      yes: true,
      dryRun: true,
    });

    expect(mocks.removeStateAndLinkedPaths).toHaveBeenCalledTimes(1);
    expect(mocks.removeWorkspaceDirs).toHaveBeenCalledTimes(1);
    expect(mocks.runCommandWithTimeout).not.toHaveBeenCalled();
    expect(runtime.log).toHaveBeenCalledWith("[dry-run] run npm rm -g openclaw");
  });

  it("runs package-manager uninstall commands in zap mode", async () => {
    const runtime = createRuntime();
    mocks.hasBinary.mockImplementation((name: string) => name === "npm");

    await uninstallCommand(runtime, {
      zap: true,
      nonInteractive: true,
      yes: true,
      dryRun: false,
    });

    expect(mocks.runCommandWithTimeout).toHaveBeenCalledWith(["npm", "rm", "-g", "openclaw"], {
      timeoutMs: 120_000,
    });
  });
});

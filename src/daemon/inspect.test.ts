import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findExtraGatewayServices } from "./inspect.js";

const { execSchtasksMock } = vi.hoisted(() => ({
  execSchtasksMock: vi.fn(),
}));

vi.mock("./schtasks-exec.js", () => ({
  execSchtasks: (...args: unknown[]) => execSchtasksMock(...args),
}));

const { fsMocks } = vi.hoisted(() => ({
  fsMocks: {
    readdir: vi.fn(),
    readFile: vi.fn(),
  },
}));

vi.mock("node:fs/promises", () => ({
  default: {
    readdir: fsMocks.readdir,
    readFile: fsMocks.readFile,
  },
  readdir: fsMocks.readdir,
  readFile: fsMocks.readFile,
}));

describe("findExtraGatewayServices (win32)", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "win32",
    });
    execSchtasksMock.mockReset();
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: originalPlatform,
    });
  });

  it("skips schtasks queries unless deep mode is enabled", async () => {
    const result = await findExtraGatewayServices({});
    expect(result).toEqual([]);
    expect(execSchtasksMock).not.toHaveBeenCalled();
  });

  it("returns empty results when schtasks query fails", async () => {
    execSchtasksMock.mockResolvedValueOnce({
      code: 1,
      stdout: "",
      stderr: "error",
    });

    const result = await findExtraGatewayServices({}, { deep: true });
    expect(result).toEqual([]);
  });

  it("collects only non-openclaw marker tasks from schtasks output", async () => {
    execSchtasksMock.mockResolvedValueOnce({
      code: 0,
      stdout: [
        "TaskName: OpenClaw Gateway",
        "Task To Run: C:\\Program Files\\OpenClaw\\openclaw.exe gateway run",
        "",
        "TaskName: Clawdbot Legacy",
        "Task To Run: C:\\clawdbot\\clawdbot.exe run",
        "",
        "TaskName: Other Task",
        "Task To Run: C:\\tools\\helper.exe",
        "",
        "TaskName: MoltBot Legacy",
        "Task To Run: C:\\moltbot\\moltbot.exe run",
        "",
      ].join("\n"),
      stderr: "",
    });

    const result = await findExtraGatewayServices({}, { deep: true });
    expect(result).toEqual([
      {
        platform: "win32",
        label: "Clawdbot Legacy",
        detail: "task: Clawdbot Legacy, run: C:\\clawdbot\\clawdbot.exe run",
        scope: "system",
        marker: "clawdbot",
        legacy: true,
      },
      {
        platform: "win32",
        label: "MoltBot Legacy",
        detail: "task: MoltBot Legacy, run: C:\\moltbot\\moltbot.exe run",
        scope: "system",
        marker: "moltbot",
        legacy: true,
      },
    ]);
  });
});

describe("findExtraGatewayServices (linux)", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "linux",
    });
    fsMocks.readdir.mockReset();
    fsMocks.readFile.mockReset();
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: originalPlatform,
    });
  });

  it("ignores unrelated services that merely reference openclaw in paths or descriptions", async () => {
    // A voice pipeline service whose WorkingDirectory or Description contains "openclaw"
    // but is NOT an openclaw gateway service.
    const voicePipelineUnit = [
      "[Unit]",
      "Description=Voice pipeline for openclaw agent",
      "",
      "[Service]",
      "ExecStart=/usr/local/bin/voice-pipeline --port 8084",
      "WorkingDirectory=/home/user/.openclaw/voice",
      "Restart=always",
      "",
      "[Install]",
      "WantedBy=default.target",
    ].join("\n");

    fsMocks.readdir.mockResolvedValue(["balthazar-voice.service"]);
    fsMocks.readFile.mockResolvedValue(voicePipelineUnit);

    const result = await findExtraGatewayServices({ HOME: "/home/user" });
    expect(result).toEqual([]);
  });

  it("ignores services with openclaw in environment values but not in ExecStart", async () => {
    // A custom monitoring service that happens to reference openclaw in an env var value
    const monitorUnit = [
      "[Unit]",
      "Description=System monitor",
      "",
      "[Service]",
      "ExecStart=/usr/local/bin/monitor-daemon",
      'Environment="MONITOR_TARGET=openclaw-gateway"',
      "Restart=always",
      "",
      "[Install]",
      "WantedBy=default.target",
    ].join("\n");

    fsMocks.readdir.mockResolvedValue(["system-monitor.service"]);
    fsMocks.readFile.mockResolvedValue(monitorUnit);

    const result = await findExtraGatewayServices({ HOME: "/home/user" });
    expect(result).toEqual([]);
  });

  it("detects openclaw gateway services by name prefix", async () => {
    const extraGatewayUnit = [
      "[Unit]",
      "Description=OpenClaw Gateway (rescue)",
      "",
      "[Service]",
      "ExecStart=/usr/local/bin/openclaw gateway run --port 19000",
      "Restart=always",
      "",
      "[Install]",
      "WantedBy=default.target",
    ].join("\n");

    fsMocks.readdir.mockResolvedValue(["openclaw-rescue.service"]);
    fsMocks.readFile.mockResolvedValue(extraGatewayUnit);

    const result = await findExtraGatewayServices({ HOME: "/home/user" });
    expect(result).toHaveLength(1);
    expect(result[0].marker).toBe("openclaw");
    expect(result[0].label).toBe("openclaw-rescue.service");
  });

  it("detects services by ExecStart containing openclaw binary", async () => {
    // Service with a non-openclaw name but ExecStart invokes the openclaw binary
    const gatewayUnit = [
      "[Unit]",
      "Description=My custom gateway",
      "",
      "[Service]",
      "ExecStart=/home/user/.local/bin/openclaw gateway run --port 19999",
      "Restart=always",
      "",
      "[Install]",
      "WantedBy=default.target",
    ].join("\n");

    fsMocks.readdir.mockResolvedValue(["my-custom-gw.service"]);
    fsMocks.readFile.mockResolvedValue(gatewayUnit);

    const result = await findExtraGatewayServices({ HOME: "/home/user" });
    expect(result).toHaveLength(1);
    expect(result[0].marker).toBe("openclaw");
  });

  it("detects legacy clawdbot services by name", async () => {
    const legacyUnit = [
      "[Unit]",
      "Description=Clawdbot Gateway (legacy)",
      "",
      "[Service]",
      "ExecStart=/usr/local/bin/clawdbot gateway run",
      "Restart=always",
      "",
      "[Install]",
      "WantedBy=default.target",
    ].join("\n");

    fsMocks.readdir.mockResolvedValue(["clawdbot-gateway.service"]);
    fsMocks.readFile.mockResolvedValue(legacyUnit);

    const result = await findExtraGatewayServices({ HOME: "/home/user" });
    expect(result).toHaveLength(1);
    expect(result[0].marker).toBe("clawdbot");
    expect(result[0].legacy).toBe(true);
  });

  it("skips services with full OPENCLAW_SERVICE_MARKER env vars (recognized as real gateway)", async () => {
    // A service with the structured marker env vars is treated as a recognized
    // openclaw gateway service and should be skipped, not flagged as extra.
    const markedUnit = [
      "[Unit]",
      "Description=Custom gateway",
      "",
      "[Service]",
      "ExecStart=/opt/custom/run-gateway",
      'Environment="OPENCLAW_SERVICE_MARKER=openclaw"',
      'Environment="OPENCLAW_SERVICE_KIND=gateway"',
      "Restart=always",
      "",
      "[Install]",
      "WantedBy=default.target",
    ].join("\n");

    fsMocks.readdir.mockResolvedValue(["custom-gw.service"]);
    fsMocks.readFile.mockResolvedValue(markedUnit);

    const result = await findExtraGatewayServices({ HOME: "/home/user" });
    expect(result).toEqual([]);
  });

  it("skips the primary gateway service by name", async () => {
    const primaryUnit = [
      "[Unit]",
      "Description=OpenClaw Gateway",
      "",
      "[Service]",
      "ExecStart=/usr/local/bin/openclaw gateway run --port 18789",
      'Environment="OPENCLAW_SERVICE_MARKER=openclaw"',
      'Environment="OPENCLAW_SERVICE_KIND=gateway"',
      "Restart=always",
      "",
      "[Install]",
      "WantedBy=default.target",
    ].join("\n");

    fsMocks.readdir.mockResolvedValue(["openclaw-gateway.service"]);
    fsMocks.readFile.mockResolvedValue(primaryUnit);

    const result = await findExtraGatewayServices({ HOME: "/home/user" });
    // Primary gateway is ignored via isIgnoredSystemdName
    expect(result).toEqual([]);
  });

  it("ignores a completely unrelated service with no openclaw references", async () => {
    const unrelatedUnit = [
      "[Unit]",
      "Description=Nginx web server",
      "",
      "[Service]",
      "ExecStart=/usr/sbin/nginx -g 'daemon off;'",
      "Restart=always",
      "",
      "[Install]",
      "WantedBy=default.target",
    ].join("\n");

    fsMocks.readdir.mockResolvedValue(["nginx.service"]);
    fsMocks.readFile.mockResolvedValue(unrelatedUnit);

    const result = await findExtraGatewayServices({ HOME: "/home/user" });
    expect(result).toEqual([]);
  });
});

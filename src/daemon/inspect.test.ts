import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findExtraGatewayServices } from "./inspect.js";

const { execSchtasksMock, readdirMock, readFileMock } = vi.hoisted(() => ({
  execSchtasksMock: vi.fn(),
  readdirMock: vi.fn(),
  readFileMock: vi.fn(),
}));

vi.mock("./schtasks-exec.js", () => ({
  execSchtasks: (...args: unknown[]) => execSchtasksMock(...args),
}));

vi.mock("node:fs/promises", () => ({
  default: { readdir: readdirMock, readFile: readFileMock },
  readdir: readdirMock,
  readFile: readFileMock,
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

// Minimal plist bodies that contain "openclaw" (so detectMarker fires) but are NOT gateways.
const MAC_APP_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>Label</key><string>ai.openclaw.mac</string>
  <key>ProgramArguments</key>
  <array><string>/Applications/OpenClaw.app/Contents/MacOS/OpenClaw</string></array>
</dict></plist>`;

const NODE_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>Label</key><string>ai.openclaw.node</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/openclaw</string>
    <string>node</string><string>run</string>
  </array>
</dict></plist>`;

describe("findExtraGatewayServices (darwin)", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    Object.defineProperty(process, "platform", { configurable: true, value: "darwin" });
    readdirMock.mockReset();
    readFileMock.mockReset();
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: originalPlatform,
    });
  });

  it("does not flag ai.openclaw.mac (macOS menubar app) as a competing gateway", async () => {
    readdirMock.mockResolvedValue(["ai.openclaw.mac.plist"]);
    readFileMock.mockResolvedValue(MAC_APP_PLIST);

    const result = await findExtraGatewayServices({ HOME: "/Users/test" });
    expect(result).toEqual([]);
  });

  it("does not flag ai.openclaw.node (node host) as a competing gateway", async () => {
    readdirMock.mockResolvedValue(["ai.openclaw.node.plist"]);
    readFileMock.mockResolvedValue(NODE_PLIST);

    const result = await findExtraGatewayServices({ HOME: "/Users/test" });
    expect(result).toEqual([]);
  });
});

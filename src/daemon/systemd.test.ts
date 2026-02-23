import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

import { splitArgsPreservingQuotes } from "./arg-split.js";
import { parseSystemdExecStart } from "./systemd-unit.js";
import {
  installSystemdService,
  isSystemdUserServiceAvailable,
  parseSystemdShow,
  restartSystemdService,
  resolveSystemdUserUnitPath,
  stopSystemdService,
} from "./systemd.js";

describe("systemd availability", () => {
  beforeEach(() => {
    execFileMock.mockClear();
  });

  it("returns true when systemctl --user succeeds", async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, "", "");
    });
    await expect(isSystemdUserServiceAvailable()).resolves.toBe(true);
  });

  it("returns false when systemd user bus is unavailable", async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => {
      const err = new Error("Failed to connect to bus") as Error & {
        stderr?: string;
        code?: number;
      };
      err.stderr = "Failed to connect to bus";
      err.code = 1;
      cb(err, "", "");
    });
    await expect(isSystemdUserServiceAvailable()).resolves.toBe(false);
  });
});

describe("systemd runtime parsing", () => {
  it("parses active state details", () => {
    const output = [
      "ActiveState=inactive",
      "SubState=dead",
      "MainPID=0",
      "ExecMainStatus=2",
      "ExecMainCode=exited",
    ].join("\n");
    expect(parseSystemdShow(output)).toEqual({
      activeState: "inactive",
      subState: "dead",
      execMainStatus: 2,
      execMainCode: "exited",
    });
  });
});

describe("resolveSystemdUserUnitPath", () => {
  it.each([
    {
      name: "uses default service name when OPENCLAW_PROFILE is unset",
      env: { HOME: "/home/test" },
      expected: "/home/test/.config/systemd/user/openclaw-gateway.service",
    },
    {
      name: "uses profile-specific service name when OPENCLAW_PROFILE is set to a custom value",
      env: { HOME: "/home/test", OPENCLAW_PROFILE: "jbphoenix" },
      expected: "/home/test/.config/systemd/user/openclaw-gateway-jbphoenix.service",
    },
    {
      name: "prefers OPENCLAW_SYSTEMD_UNIT over OPENCLAW_PROFILE",
      env: {
        HOME: "/home/test",
        OPENCLAW_PROFILE: "jbphoenix",
        OPENCLAW_SYSTEMD_UNIT: "custom-unit",
      },
      expected: "/home/test/.config/systemd/user/custom-unit.service",
    },
    {
      name: "handles OPENCLAW_SYSTEMD_UNIT with .service suffix",
      env: {
        HOME: "/home/test",
        OPENCLAW_SYSTEMD_UNIT: "custom-unit.service",
      },
      expected: "/home/test/.config/systemd/user/custom-unit.service",
    },
    {
      name: "trims whitespace from OPENCLAW_SYSTEMD_UNIT",
      env: {
        HOME: "/home/test",
        OPENCLAW_SYSTEMD_UNIT: "  custom-unit  ",
      },
      expected: "/home/test/.config/systemd/user/custom-unit.service",
    },
  ])("$name", ({ env, expected }) => {
    expect(resolveSystemdUserUnitPath(env)).toBe(expected);
  });
});

describe("splitArgsPreservingQuotes", () => {
  it("splits on whitespace outside quotes", () => {
    expect(splitArgsPreservingQuotes('/usr/bin/openclaw gateway start --name "My Bot"')).toEqual([
      "/usr/bin/openclaw",
      "gateway",
      "start",
      "--name",
      "My Bot",
    ]);
  });

  it("supports systemd-style backslash escaping", () => {
    expect(
      splitArgsPreservingQuotes('openclaw --name "My \\"Bot\\"" --foo bar', {
        escapeMode: "backslash",
      }),
    ).toEqual(["openclaw", "--name", 'My "Bot"', "--foo", "bar"]);
  });

  it("supports schtasks-style escaped quotes while preserving other backslashes", () => {
    expect(
      splitArgsPreservingQuotes('openclaw --path "C:\\\\Program Files\\\\OpenClaw"', {
        escapeMode: "backslash-quote-only",
      }),
    ).toEqual(["openclaw", "--path", "C:\\\\Program Files\\\\OpenClaw"]);

    expect(
      splitArgsPreservingQuotes('openclaw --label "My \\"Quoted\\" Name"', {
        escapeMode: "backslash-quote-only",
      }),
    ).toEqual(["openclaw", "--label", 'My "Quoted" Name']);
  });
});

describe("parseSystemdExecStart", () => {
  it("preserves quoted arguments", () => {
    const execStart = '/usr/bin/openclaw gateway start --name "My Bot"';
    expect(parseSystemdExecStart(execStart)).toEqual([
      "/usr/bin/openclaw",
      "gateway",
      "start",
      "--name",
      "My Bot",
    ]);
  });
});

describe("systemd service control", () => {
  beforeEach(() => {
    execFileMock.mockClear();
  });

  it("stops the resolved user unit", async () => {
    execFileMock
      .mockImplementationOnce((_cmd, _args, _opts, cb) => cb(null, "", ""))
      .mockImplementationOnce((_cmd, args, _opts, cb) => {
        expect(args).toEqual(["--user", "stop", "openclaw-gateway.service"]);
        cb(null, "", "");
      });
    const write = vi.fn();
    const stdout = { write } as unknown as NodeJS.WritableStream;

    await stopSystemdService({ stdout, env: {} });

    expect(write).toHaveBeenCalledTimes(1);
    expect(String(write.mock.calls[0]?.[0])).toContain("Stopped systemd service");
  });

  it("restarts a profile-specific user unit", async () => {
    execFileMock
      .mockImplementationOnce((_cmd, _args, _opts, cb) => cb(null, "", ""))
      .mockImplementationOnce((_cmd, args, _opts, cb) => {
        expect(args).toEqual(["--user", "restart", "openclaw-gateway-work.service"]);
        cb(null, "", "");
      });
    const write = vi.fn();
    const stdout = { write } as unknown as NodeJS.WritableStream;

    await restartSystemdService({ stdout, env: { OPENCLAW_PROFILE: "work" } });

    expect(write).toHaveBeenCalledTimes(1);
    expect(String(write.mock.calls[0]?.[0])).toContain("Restarted systemd service");
  });

  it("surfaces stop failures with systemctl detail", async () => {
    execFileMock
      .mockImplementationOnce((_cmd, _args, _opts, cb) => cb(null, "", ""))
      .mockImplementationOnce((_cmd, _args, _opts, cb) => {
        const err = new Error("stop failed") as Error & { code?: number };
        err.code = 1;
        cb(err, "", "permission denied");
      });

    await expect(
      stopSystemdService({
        stdout: { write: vi.fn() } as unknown as NodeJS.WritableStream,
        env: {},
      }),
    ).rejects.toThrow("systemctl stop failed: permission denied");
  });
});

describe("installSystemdService preserves ExecStart wrapper (#24350)", () => {
  let tmpDir: string;

  beforeEach(async () => {
    execFileMock.mockClear();
    // All systemctl calls succeed.
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => cb(null, "", ""));
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "systemd-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  function unitPath() {
    return path.join(tmpDir, ".config", "systemd", "user", "openclaw-gateway.service");
  }

  const baseArgs = {
    programArguments: [
      "/usr/bin/node",
      "/home/user/.npm-global/lib/node_modules/openclaw/dist/entry.js",
      "gateway",
      "--port",
      "18789",
    ],
    description: "OpenClaw Gateway",
    environment: {},
  };

  it("preserves user ExecStart wrapper (e.g. proxychains4) on reinstall", async () => {
    const stdout = { write: vi.fn() } as unknown as NodeJS.WritableStream;
    const env = { HOME: tmpDir };

    // First install: creates the service file normally.
    await installSystemdService({ ...baseArgs, env, stdout });
    const firstContent = await fs.readFile(unitPath(), "utf8");
    const generatedExecStart =
      "ExecStart=/usr/bin/node /home/user/.npm-global/lib/node_modules/openclaw/dist/entry.js gateway --port 18789";
    expect(firstContent).toContain(generatedExecStart);

    // User customizes ExecStart with a proxychains4 wrapper.
    const wrappedExecStart =
      "ExecStart=/usr/bin/proxychains4 -f /home/user/proxy.conf /usr/bin/node /home/user/.npm-global/lib/node_modules/openclaw/dist/entry.js gateway --port 18789";
    const customized = firstContent.replace(/^ExecStart=.*/m, wrappedExecStart);
    await fs.writeFile(unitPath(), customized, "utf8");

    // Second install (simulates `openclaw update`): should preserve the wrapper.
    await installSystemdService({ ...baseArgs, env, stdout });
    const afterUpdate = await fs.readFile(unitPath(), "utf8");
    expect(afterUpdate).toContain(wrappedExecStart);
  });

  it("overwrites ExecStart when there is no user wrapper", async () => {
    const stdout = { write: vi.fn() } as unknown as NodeJS.WritableStream;
    const env = { HOME: tmpDir };

    // First install.
    await installSystemdService({ ...baseArgs, env, stdout });

    // Second install with same args: ExecStart should remain unchanged.
    await installSystemdService({ ...baseArgs, env, stdout });
    const content = await fs.readFile(unitPath(), "utf8");
    expect(content).toContain(
      "ExecStart=/usr/bin/node /home/user/.npm-global/lib/node_modules/openclaw/dist/entry.js gateway --port 18789",
    );
    expect(content).not.toContain("proxychains");
  });

  it("does not preserve wrapper when ExecStart is completely different", async () => {
    const stdout = { write: vi.fn() } as unknown as NodeJS.WritableStream;
    const env = { HOME: tmpDir };

    // First install.
    await installSystemdService({ ...baseArgs, env, stdout });

    // User replaces ExecStart entirely with something unrelated.
    const content = await fs.readFile(unitPath(), "utf8");
    const customized = content.replace(/^ExecStart=.*/m, "ExecStart=/usr/bin/something-else");
    await fs.writeFile(unitPath(), customized, "utf8");

    // Second install: should use the new generated ExecStart, not the user's.
    await installSystemdService({ ...baseArgs, env, stdout });
    const afterUpdate = await fs.readFile(unitPath(), "utf8");
    expect(afterUpdate).toContain(
      "ExecStart=/usr/bin/node /home/user/.npm-global/lib/node_modules/openclaw/dist/entry.js gateway --port 18789",
    );
    expect(afterUpdate).not.toContain("something-else");
  });
});

import { describe, expect, it } from "vitest";
import { buildSystemdUnit, renderExecStart } from "./systemd-unit.js";

describe("buildSystemdUnit", () => {
  it("quotes arguments with whitespace", () => {
    const unit = buildSystemdUnit({
      description: "OpenClaw Gateway",
      programArguments: ["/usr/bin/openclaw", "gateway", "--name", "My Bot"],
      environment: {},
    });
    const execStart = unit.split("\n").find((line) => line.startsWith("ExecStart="));
    expect(execStart).toBe('ExecStart=/usr/bin/openclaw gateway --name "My Bot"');
  });

  it("rejects environment values with line breaks", () => {
    expect(() =>
      buildSystemdUnit({
        description: "OpenClaw Gateway",
        programArguments: ["/usr/bin/openclaw", "gateway", "start"],
        environment: {
          INJECT: "ok\nExecStartPre=/bin/touch /tmp/oc15789_rce",
        },
      }),
    ).toThrow(/CR or LF/);
  });

  it("uses execStartOverride when provided", () => {
    const unit = buildSystemdUnit({
      description: "OpenClaw Gateway",
      programArguments: ["/usr/bin/node", "/home/user/openclaw/dist/entry.js", "gateway"],
      environment: {},
      execStartOverride:
        '/usr/bin/proxychains4 -f /home/user/proxy.conf /usr/bin/node "/home/user/openclaw/dist/entry.js" gateway',
    });
    const execStart = unit.split("\n").find((line) => line.startsWith("ExecStart="));
    expect(execStart).toBe(
      'ExecStart=/usr/bin/proxychains4 -f /home/user/proxy.conf /usr/bin/node "/home/user/openclaw/dist/entry.js" gateway',
    );
  });

  it("falls back to programArguments when execStartOverride is undefined", () => {
    const unit = buildSystemdUnit({
      description: "OpenClaw Gateway",
      programArguments: ["/usr/bin/node", "/home/user/openclaw/dist/entry.js", "gateway"],
      environment: {},
      execStartOverride: undefined,
    });
    const execStart = unit.split("\n").find((line) => line.startsWith("ExecStart="));
    expect(execStart).toBe("ExecStart=/usr/bin/node /home/user/openclaw/dist/entry.js gateway");
  });
});

describe("renderExecStart", () => {
  it("renders program arguments into a systemd ExecStart value", () => {
    expect(renderExecStart(["/usr/bin/node", "/home/user/entry.js", "gateway"])).toBe(
      "/usr/bin/node /home/user/entry.js gateway",
    );
  });

  it("quotes arguments with whitespace", () => {
    expect(renderExecStart(["/usr/bin/node", "/home/my user/entry.js"])).toBe(
      '/usr/bin/node "/home/my user/entry.js"',
    );
  });
});

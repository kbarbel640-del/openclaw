import { describe, expect, it } from "vitest";
import type { PortListener } from "./ports-types.js";
import {
  classifyPortListener,
  buildPortHints,
  formatPortListener,
  formatPortDiagnostics,
} from "./ports-format.js";

describe("classifyPortListener", () => {
  it("classifies openclaw as gateway", () => {
    expect(
      classifyPortListener({ commandLine: "openclaw gateway run" } as PortListener, 18789),
    ).toBe("gateway");
  });

  it("classifies ssh commands as ssh", () => {
    expect(
      classifyPortListener({ commandLine: "ssh -L 18789:localhost:18789" } as PortListener, 18789),
    ).toBe("ssh");
  });

  it("classifies unknown commands", () => {
    expect(classifyPortListener({ commandLine: "nginx" } as PortListener, 80)).toBe("unknown");
  });

  it("classifies empty command as unknown", () => {
    expect(classifyPortListener({} as PortListener, 80)).toBe("unknown");
  });
});

describe("buildPortHints", () => {
  it("returns empty for no listeners", () => {
    expect(buildPortHints([], 80)).toEqual([]);
  });

  it("includes gateway hint", () => {
    const listeners = [{ commandLine: "openclaw gateway" } as PortListener];
    const hints = buildPortHints(listeners, 80);
    expect(hints.some((h) => h.includes("Gateway"))).toBe(true);
  });

  it("includes ssh hint", () => {
    const listeners = [{ commandLine: "ssh -L 80" } as PortListener];
    const hints = buildPortHints(listeners, 80);
    expect(hints.some((h) => h.includes("SSH tunnel"))).toBe(true);
  });

  it("includes multiple listener warning", () => {
    const listeners = [
      { commandLine: "openclaw gateway" } as PortListener,
      { commandLine: "ssh -L 80" } as PortListener,
    ];
    const hints = buildPortHints(listeners, 80);
    expect(hints.some((h) => h.includes("Multiple"))).toBe(true);
  });
});

describe("formatPortListener", () => {
  it("formats with all fields", () => {
    const result = formatPortListener({
      pid: 1234,
      user: "root",
      commandLine: "openclaw gateway run",
      address: "0.0.0.0:18789",
    } as PortListener);
    expect(result).toContain("pid 1234");
    expect(result).toContain("root");
    expect(result).toContain("openclaw gateway run");
    expect(result).toContain("0.0.0.0:18789");
  });

  it("handles missing fields", () => {
    const result = formatPortListener({} as PortListener);
    expect(result).toContain("pid ?");
    expect(result).toContain("unknown");
  });
});

describe("formatPortDiagnostics", () => {
  it("reports free port", () => {
    const lines = formatPortDiagnostics({ port: 80, status: "free" } as unknown);
    expect(lines[0]).toContain("free");
  });

  it("reports busy port with details", () => {
    const lines = formatPortDiagnostics({
      port: 80,
      status: "busy",
      listeners: [{ pid: 1, commandLine: "nginx" }],
      hints: ["Another process"],
    } as unknown);
    expect(lines[0]).toContain("already in use");
    expect(lines.length).toBeGreaterThan(1);
  });
});

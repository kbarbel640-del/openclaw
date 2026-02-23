import { describe, expect, it } from "vitest";
import { buildNodeCommandNotAllowedHint, isNodeCommandAllowed } from "./node-command-policy.js";

describe("buildNodeCommandNotAllowedHint", () => {
  it("returns platform-specific hint for system.notify on linux", () => {
    const msg = buildNodeCommandNotAllowedHint(
      "system.notify",
      "command not declared by node",
      "linux",
    );
    expect(msg).toContain("not supported on linux");
    expect(msg).toContain("macos, ios");
    expect(msg).toContain("openclaw message send");
  });

  it("returns platform-specific hint for system.notify on windows", () => {
    const msg = buildNodeCommandNotAllowedHint(
      "system.notify",
      "command not declared by node",
      "windows",
    );
    expect(msg).toContain("not supported on windows");
  });

  it("returns generic message for non-platform-specific commands", () => {
    const msg = buildNodeCommandNotAllowedHint("system.run", "command not allowlisted", "linux");
    expect(msg).toBe("node command not allowed: command not allowlisted (system.run)");
  });

  it("returns generic message when command is platform-specific but on supported platform", () => {
    const msg = buildNodeCommandNotAllowedHint(
      "system.notify",
      "command not declared by node",
      "macos",
    );
    expect(msg).toBe("node command not allowed: command not declared by node (system.notify)");
  });
});

describe("isNodeCommandAllowed", () => {
  it("rejects empty command", () => {
    const result = isNodeCommandAllowed({
      command: "",
      declaredCommands: ["system.run"],
      allowlist: new Set(["system.run"]),
    });
    expect(result).toEqual({ ok: false, reason: "command required" });
  });

  it("rejects command not in allowlist", () => {
    const result = isNodeCommandAllowed({
      command: "system.notify",
      declaredCommands: ["system.notify"],
      allowlist: new Set(["system.run"]),
    });
    expect(result).toEqual({ ok: false, reason: "command not allowlisted" });
  });

  it("rejects command not declared by node", () => {
    const result = isNodeCommandAllowed({
      command: "system.notify",
      declaredCommands: ["system.run"],
      allowlist: new Set(["system.notify"]),
    });
    expect(result).toEqual({ ok: false, reason: "command not declared by node" });
  });

  it("allows valid command", () => {
    const result = isNodeCommandAllowed({
      command: "system.run",
      declaredCommands: ["system.run"],
      allowlist: new Set(["system.run"]),
    });
    expect(result).toEqual({ ok: true });
  });
});

import { describe, expect, it } from "vitest";
import {
  looksLikePathArg,
  translateSandboxPath,
  validateCwd,
  validatePathLikeArgs,
} from "./path-guards.js";

describe("cliport path guards", () => {
  it("translates sandbox /workspace paths to host workspace paths", () => {
    const translated = translateSandboxPath({
      sandboxPath: "/workspace/data/report.txt",
      sandboxAgentRoot: "/workspace",
      workspaceRoot: "/srv/workspace",
    });

    expect(translated).toBe("/srv/workspace/data/report.txt");
  });

  it("translates sandbox /agent paths to host workspace paths", () => {
    const translated = translateSandboxPath({
      sandboxPath: "/agent/data/report.txt",
      sandboxAgentRoot: "/agent",
      workspaceRoot: "/srv/workspace",
    });

    expect(translated).toBe("/srv/workspace/data/report.txt");
  });

  it("accepts legacy /agent cwd when sandbox roots include /workspace + /agent", () => {
    const resolved = validateCwd({
      sandboxCwd: "/agent/data",
      sandboxRoots: ["/workspace", "/agent"],
      workspaceRoot: "/srv/workspace",
    });
    expect(resolved.hostCwd).toBe("/srv/workspace/data");
  });

  it("rejects cwd in masked directories", () => {
    expect(() =>
      validateCwd({
        sandboxCwd: "/agent/memory/private",
        sandboxAgentRoot: "/agent",
        workspaceRoot: "/srv/workspace",
        maskedPaths: ["memory/private", "memory/users", "config"],
      }),
    ).toThrowError(/masked path/);
  });

  it("rejects path-like args that traverse into masked directories", () => {
    expect(() =>
      validatePathLikeArgs({
        args: ["../../memory/private/finances.md"],
        hostCwd: "/srv/workspace/data",
        workspaceRoot: "/srv/workspace",
        maskedPaths: ["memory/private", "memory/users", "config"],
      }),
    ).toThrowError(/escapes workspace|masked directory/);
  });

  it("detects path-like args conservatively", () => {
    expect(looksLikePathArg("docs/readme.md")).toBe(true);
    expect(looksLikePathArg("./script.sh")).toBe(true);
    expect(looksLikePathArg("gmail:search")).toBe(false);
  });

  it("rejects ~/secret tilde path argument", () => {
    expect(() =>
      validatePathLikeArgs({
        args: ["~/secret"],
        hostCwd: "/srv/workspace/data",
        workspaceRoot: "/srv/workspace",
      }),
    ).toThrowError(/tilde paths are not allowed/);
  });

  it("rejects bare ~ tilde argument", () => {
    expect(() =>
      validatePathLikeArgs({
        args: ["~"],
        hostCwd: "/srv/workspace/data",
        workspaceRoot: "/srv/workspace",
      }),
    ).toThrowError(/tilde paths are not allowed/);
  });

  it("rejects --output=~/escape flag-value with tilde", () => {
    expect(() =>
      validatePathLikeArgs({
        args: ["--output=~/escape"],
        hostCwd: "/srv/workspace/data",
        workspaceRoot: "/srv/workspace",
      }),
    ).toThrowError(/tilde paths are not allowed/);
  });
});

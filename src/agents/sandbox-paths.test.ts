import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveSandboxPath } from "./sandbox-paths.js";

describe("resolveSandboxPath", () => {
  const root = "/home/user/.openclaw/workspace-one";

  it("allows paths within root", () => {
    const result = resolveSandboxPath({
      filePath: "AGENTS.md",
      cwd: root,
      root,
    });
    expect(result.resolved).toBe(path.join(root, "AGENTS.md"));
    expect(result.relative).toBe("AGENTS.md");
  });

  it("rejects paths outside root without allowedPaths", () => {
    expect(() =>
      resolveSandboxPath({
        filePath: "/home/user/.openclaw/workspace-two/MEMORY.md",
        cwd: root,
        root,
      }),
    ).toThrow("Path escapes sandbox root");
  });

  it("allows paths within bind mount host paths via allowedPaths", () => {
    const result = resolveSandboxPath({
      filePath: "/home/user/.openclaw/workspace-two/MEMORY.md",
      cwd: root,
      root,
      allowedPaths: ["/home/user/.openclaw/workspace-two"],
    });
    expect(result.resolved).toBe("/home/user/.openclaw/workspace-two/MEMORY.md");
    expect(result.relative).toBe("MEMORY.md");
  });

  it("allows paths that exactly match an allowed path root", () => {
    const result = resolveSandboxPath({
      filePath: "/home/user/.openclaw/workspace-two",
      cwd: root,
      root,
      allowedPaths: ["/home/user/.openclaw/workspace-two"],
    });
    expect(result.resolved).toBe("/home/user/.openclaw/workspace-two");
    expect(result.relative).toBe("");
  });

  it("rejects paths outside both root and allowedPaths", () => {
    expect(() =>
      resolveSandboxPath({
        filePath: "/etc/passwd",
        cwd: root,
        root,
        allowedPaths: ["/home/user/.openclaw/workspace-two"],
      }),
    ).toThrow("Path escapes sandbox root");
  });

  it("rejects path traversal through allowed paths", () => {
    expect(() =>
      resolveSandboxPath({
        filePath: "/home/user/.openclaw/workspace-two/../../../etc/passwd",
        cwd: root,
        root,
        allowedPaths: ["/home/user/.openclaw/workspace-two"],
      }),
    ).toThrow("Path escapes sandbox root");
  });
});

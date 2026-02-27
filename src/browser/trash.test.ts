import { describe, expect, it, vi } from "vitest";

vi.mock("../process/exec.js", () => ({
  runExec: vi.fn(),
}));

vi.mock("../infra/secure-random.js", () => ({
  generateSecureToken: vi.fn(() => "abc123"),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    default: {
      ...actual.default,
      mkdirSync: vi.fn(),
      renameSync: vi.fn(),
      existsSync: vi.fn(() => false),
    },
  };
});

import fs from "node:fs";
import { runExec } from "../process/exec.js";
import { movePathToTrash } from "./trash.js";

describe("movePathToTrash", () => {
  it("uses trash command first", async () => {
    vi.mocked(runExec).mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 } as never);
    const result = await movePathToTrash("/tmp/test-file");
    expect(result).toBe("/tmp/test-file");
    expect(runExec).toHaveBeenCalledWith("trash", ["/tmp/test-file"], { timeoutMs: 10_000 });
  });

  it("falls back to gio trash on Linux", async () => {
    vi.mocked(runExec).mockRejectedValueOnce(new Error("trash not found"));
    vi.mocked(runExec).mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 } as never);
    const result = await movePathToTrash("/tmp/test-file");
    expect(result).toBe("/tmp/test-file");
    expect(runExec).toHaveBeenCalledWith("gio", ["trash", "/tmp/test-file"], { timeoutMs: 10_000 });
  });

  it("falls back to trash-put on Linux", async () => {
    vi.mocked(runExec).mockRejectedValueOnce(new Error("trash not found"));
    vi.mocked(runExec).mockRejectedValueOnce(new Error("gio not found"));
    vi.mocked(runExec).mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 } as never);
    const result = await movePathToTrash("/tmp/test-file");
    expect(result).toBe("/tmp/test-file");
    expect(runExec).toHaveBeenCalledWith("trash-put", ["/tmp/test-file"], { timeoutMs: 10_000 });
  });

  it("falls back to manual rename when all commands fail", async () => {
    vi.mocked(runExec).mockRejectedValue(new Error("not found"));
    const result = await movePathToTrash("/tmp/test-file");
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.renameSync).toHaveBeenCalled();
    expect(result).toContain(".Trash");
  });
});

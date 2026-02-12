import { describe, expect, it, vi } from "vitest";

const mkdirMock = vi.fn();
const writeFileMock = vi.fn();
const renameMock = vi.fn();
const readFileMock = vi.fn();
const unlinkMock = vi.fn();
const readdirMock = vi.fn();

vi.mock("node:fs/promises", () => {
  const api = {
    mkdir: (...args: unknown[]) => mkdirMock(...args),
    writeFile: (...args: unknown[]) => writeFileMock(...args),
    rename: (...args: unknown[]) => renameMock(...args),
    readFile: (...args: unknown[]) => readFileMock(...args),
    unlink: (...args: unknown[]) => unlinkMock(...args),
    readdir: (...args: unknown[]) => readdirMock(...args),
  };
  // Our code imports `fs` as the default export, so ensure default has the methods.
  return { default: api, ...api };
});

describe("delegation-storage", () => {
  it("does not log ENOENT when saving delegation record", async () => {
    const { saveDelegationRecord } = await import("./delegation-storage.js");
    const err = new Error("missing") as NodeJS.ErrnoException;
    err.code = "ENOENT";

    mkdirMock.mockResolvedValueOnce(undefined);
    writeFileMock.mockResolvedValueOnce(undefined);
    renameMock.mockRejectedValueOnce(err);

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      saveDelegationRecord({
        id: "test",
        direction: "downward",
        state: "created",
        priority: "normal",
        fromAgentId: "main",
        fromSessionKey: "s1",
        fromRole: "orchestrator",
        toAgentId: "worker",
        toSessionKey: "s2",
        toRole: "worker",
        task: "do it",
        interactions: [],
        createdAt: Date.now(),
      }),
    ).resolves.toBeUndefined();

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

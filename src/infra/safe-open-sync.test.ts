import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { openVerifiedFileSync } from "./safe-open-sync.js";

type TestIoFs = NonNullable<Parameters<typeof openVerifiedFileSync>[0]["ioFs"]>;

function createStats(params: {
  dev: number | bigint;
  ino: number | bigint;
  nlink?: number;
  size?: number;
  file?: boolean;
  symlink?: boolean;
}): fs.Stats {
  return {
    dev: params.dev,
    ino: params.ino,
    nlink: params.nlink ?? 1,
    size: params.size ?? 16,
    isFile: () => params.file ?? true,
    isSymbolicLink: () => params.symlink ?? false,
  } as unknown as fs.Stats;
}

function createIoFs(params: { realPath?: string; lstat: fs.Stats; fstat: fs.Stats }): {
  ioFs: TestIoFs;
  mocks: {
    lstatSync: ReturnType<typeof vi.fn>;
    realpathSync: ReturnType<typeof vi.fn>;
    openSync: ReturnType<typeof vi.fn>;
    fstatSync: ReturnType<typeof vi.fn>;
    closeSync: ReturnType<typeof vi.fn>;
  };
} {
  const realPath = params.realPath ?? "C:/tmp/demo.json";
  const lstatSync = vi.fn(() => params.lstat);
  const realpathSync = vi.fn(() => realPath);
  const openSync = vi.fn(() => 42);
  const fstatSync = vi.fn(() => params.fstat);
  const closeSync = vi.fn(() => undefined);

  const ioFs = {
    constants: { O_RDONLY: 0, O_NOFOLLOW: 0 },
    lstatSync,
    realpathSync,
    openSync,
    fstatSync,
    closeSync,
  } as unknown as TestIoFs;

  return {
    ioFs,
    mocks: {
      lstatSync,
      realpathSync,
      openSync,
      fstatSync,
      closeSync,
    },
  };
}

describe("openVerifiedFileSync", () => {
  it("rejects identity mismatch on non-windows", () => {
    const preOpen = createStats({ dev: 1, ino: 100 });
    const opened = createStats({ dev: 2, ino: 200 });
    const { ioFs, mocks } = createIoFs({ lstat: preOpen, fstat: opened });

    const result = openVerifiedFileSync({
      filePath: "C:/tmp/demo.json",
      ioFs,
      platform: "linux",
    });

    expect(result).toEqual({ ok: false, reason: "validation" });
    expect(mocks.openSync).toHaveBeenCalledTimes(1);
    expect(mocks.closeSync).toHaveBeenCalledWith(42);
  });

  it("allows win32 identity mismatch for regular non-hardlinked files", () => {
    const preOpen = createStats({ dev: 1, ino: 100, nlink: 1 });
    const opened = createStats({ dev: 2, ino: 200, nlink: 1 });
    const { ioFs, mocks } = createIoFs({ lstat: preOpen, fstat: opened });

    const result = openVerifiedFileSync({
      filePath: "C:/tmp/demo.json",
      ioFs,
      platform: "win32",
      rejectHardlinks: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected open result");
    }
    expect(result.path).toBe("C:/tmp/demo.json");
    expect(result.fd).toBe(42);
    expect(mocks.closeSync).not.toHaveBeenCalled();
  });

  it("still rejects win32 files when hardlink guard fails", () => {
    const preOpen = createStats({ dev: 1, ino: 100, nlink: 1 });
    const opened = createStats({ dev: 2, ino: 200, nlink: 2 });
    const { ioFs, mocks } = createIoFs({ lstat: preOpen, fstat: opened });

    const result = openVerifiedFileSync({
      filePath: "C:/tmp/demo.json",
      ioFs,
      platform: "win32",
      rejectHardlinks: true,
    });

    expect(result).toEqual({ ok: false, reason: "validation" });
    expect(mocks.closeSync).toHaveBeenCalledWith(42);
  });
});

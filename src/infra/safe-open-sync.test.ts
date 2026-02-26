import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { openVerifiedFileSync } from "./safe-open-sync.js";

type MockFs = {
  constants: { O_RDONLY: number; O_NOFOLLOW?: number };
  lstatSync: ReturnType<typeof vi.fn>;
  realpathSync: ReturnType<typeof vi.fn>;
  openSync: ReturnType<typeof vi.fn>;
  fstatSync: ReturnType<typeof vi.fn>;
  closeSync: ReturnType<typeof vi.fn>;
};

function makeFileStats(params: {
  dev: number;
  ino: number;
  nlink: number;
  size?: number;
}): fs.Stats {
  return {
    dev: params.dev,
    ino: params.ino,
    nlink: params.nlink,
    size: params.size ?? 1,
    isFile: () => true,
  } as fs.Stats;
}

describe("openVerifiedFileSync", () => {
  it("ignores hardlink guard on win32", () => {
    const pre = makeFileStats({ dev: 1, ino: 10, nlink: 2 });
    const post = makeFileStats({ dev: 1, ino: 10, nlink: 2 });
    const ioFs: MockFs = {
      constants: { O_RDONLY: fs.constants.O_RDONLY, O_NOFOLLOW: fs.constants.O_NOFOLLOW },
      lstatSync: vi.fn(() => pre),
      realpathSync: vi.fn((filePath: string) => filePath),
      openSync: vi.fn(() => 11),
      fstatSync: vi.fn(() => post),
      closeSync: vi.fn(),
    };

    const opened = openVerifiedFileSync({
      filePath: "/tmp/plugin.json",
      rejectHardlinks: true,
      platform: "win32",
      ioFs: ioFs as unknown as typeof fs,
    });

    expect(opened.ok).toBe(true);
    expect(ioFs.openSync).toHaveBeenCalledTimes(1);
  });

  it("keeps hardlink guard on non-win32", () => {
    const pre = makeFileStats({ dev: 1, ino: 10, nlink: 2 });
    const ioFs: MockFs = {
      constants: { O_RDONLY: fs.constants.O_RDONLY, O_NOFOLLOW: fs.constants.O_NOFOLLOW },
      lstatSync: vi.fn(() => pre),
      realpathSync: vi.fn((filePath: string) => filePath),
      openSync: vi.fn(() => 11),
      fstatSync: vi.fn(() => pre),
      closeSync: vi.fn(),
    };

    const opened = openVerifiedFileSync({
      filePath: "/tmp/plugin.json",
      rejectHardlinks: true,
      platform: "linux",
      ioFs: ioFs as unknown as typeof fs,
    });

    expect(opened.ok).toBe(false);
    if (!opened.ok) {
      expect(opened.reason).toBe("validation");
    }
    expect(ioFs.openSync).not.toHaveBeenCalled();
  });
});

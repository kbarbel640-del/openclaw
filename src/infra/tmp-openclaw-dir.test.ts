import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { POSIX_OPENCLAW_TMP_DIR, resolvePreferredOpenClawTmpDir } from "./tmp-openclaw-dir.js";

type TmpDirOptions = NonNullable<Parameters<typeof resolvePreferredOpenClawTmpDir>[0]>;

function fallbackTmp(uid = 501) {
  return path.join("/var/fallback", `openclaw-${uid}`);
}

function nodeErrorWithCode(code: string) {
  const err = new Error(code) as Error & { code?: string };
  err.code = code;
  return err;
}

function secureDirStat(uid = 501) {
  return {
    isDirectory: () => true,
    isSymbolicLink: () => false,
    uid,
    mode: 0o40700,
  };
}

function resolveWithMocks(params: {
  lstatSync: NonNullable<TmpDirOptions["lstatSync"]>;
  fallbackLstatSync?: NonNullable<TmpDirOptions["lstatSync"]>;
  accessSync?: NonNullable<TmpDirOptions["accessSync"]>;
  uid?: number;
  tmpdirPath?: string;
}) {
  const uid = params.uid ?? 501;
  const fallbackPath = fallbackTmp(uid);
  const accessSync = params.accessSync ?? vi.fn();
  const wrappedLstatSync = vi.fn((target: string) => {
    if (target === POSIX_OPENCLAW_TMP_DIR) {
      return params.lstatSync(target);
    }
    if (target === fallbackPath) {
      if (params.fallbackLstatSync) {
        return params.fallbackLstatSync(target);
      }
      return secureDirStat(uid);
    }
    return secureDirStat(uid);
  }) as NonNullable<TmpDirOptions["lstatSync"]>;
  const mkdirSync = vi.fn();
  const getuid = vi.fn(() => uid);
  const tmpdir = vi.fn(() => params.tmpdirPath ?? "/var/fallback");
  const resolved = resolvePreferredOpenClawTmpDir({
    accessSync,
    lstatSync: wrappedLstatSync,
    mkdirSync,
    getuid,
    tmpdir,
  });
  return { resolved, accessSync, lstatSync: wrappedLstatSync, mkdirSync, tmpdir };
}

describe("resolvePreferredOpenClawTmpDir", () => {
  it("prefers /tmp/openclaw when it already exists and is writable", () => {
    const lstatSync: NonNullable<TmpDirOptions["lstatSync"]> = vi.fn(() => ({
      isDirectory: () => true,
      isSymbolicLink: () => false,
      uid: 501,
      mode: 0o40700,
    }));
    const { resolved, accessSync, tmpdir } = resolveWithMocks({ lstatSync });

    expect(lstatSync).toHaveBeenCalledTimes(1);
    expect(accessSync).toHaveBeenCalledTimes(1);
    expect(resolved).toBe(POSIX_OPENCLAW_TMP_DIR);
    expect(tmpdir).not.toHaveBeenCalled();
  });

  it("prefers /tmp/openclaw when it does not exist but /tmp is writable", () => {
    const lstatSyncMock = vi
      .fn<NonNullable<TmpDirOptions["lstatSync"]>>()
      .mockImplementationOnce(() => {
        throw nodeErrorWithCode("ENOENT");
      })
      .mockImplementationOnce(() => secureDirStat(501));

    const { resolved, accessSync, mkdirSync, tmpdir } = resolveWithMocks({
      lstatSync: lstatSyncMock,
    });

    expect(resolved).toBe(POSIX_OPENCLAW_TMP_DIR);
    expect(accessSync).toHaveBeenCalledWith("/tmp", expect.any(Number));
    expect(mkdirSync).toHaveBeenCalledWith(POSIX_OPENCLAW_TMP_DIR, expect.any(Object));
    expect(tmpdir).not.toHaveBeenCalled();
  });

  it("falls back to os.tmpdir()/openclaw when /tmp/openclaw is not a directory", () => {
    const lstatSync = vi.fn(() => ({
      isDirectory: () => false,
      isSymbolicLink: () => false,
      uid: 501,
      mode: 0o100644,
    })) as unknown as ReturnType<typeof vi.fn> & NonNullable<TmpDirOptions["lstatSync"]>;
    const { resolved, tmpdir } = resolveWithMocks({ lstatSync });

    expect(resolved).toBe(fallbackTmp());
    expect(tmpdir).toHaveBeenCalled();
  });

  it("falls back to os.tmpdir()/openclaw when /tmp is not writable", () => {
    const accessSync = vi.fn((target: string) => {
      if (target === "/tmp") {
        throw new Error("read-only");
      }
    });
    const lstatSync = vi.fn(() => {
      throw nodeErrorWithCode("ENOENT");
    });
    const { resolved, tmpdir } = resolveWithMocks({
      accessSync,
      lstatSync,
    });

    expect(resolved).toBe(fallbackTmp());
    expect(tmpdir).toHaveBeenCalled();
  });

  it("falls back when /tmp/openclaw is a symlink", () => {
    const lstatSync = vi.fn(() => ({
      isDirectory: () => true,
      isSymbolicLink: () => true,
      uid: 501,
      mode: 0o120777,
    }));

    const { resolved, tmpdir } = resolveWithMocks({ lstatSync });

    expect(resolved).toBe(fallbackTmp());
    expect(tmpdir).toHaveBeenCalled();
  });

  it("falls back when /tmp/openclaw is not owned by the current user", () => {
    const lstatSync = vi.fn(() => ({
      isDirectory: () => true,
      isSymbolicLink: () => false,
      uid: 0,
      mode: 0o40700,
    }));

    const { resolved, tmpdir } = resolveWithMocks({ lstatSync });

    expect(resolved).toBe(fallbackTmp());
    expect(tmpdir).toHaveBeenCalled();
  });

  it("falls back when /tmp/openclaw is group/other writable", () => {
    const lstatSync = vi.fn(() => ({
      isDirectory: () => true,
      isSymbolicLink: () => false,
      uid: 501,
      mode: 0o40777,
    }));
    const { resolved, tmpdir } = resolveWithMocks({ lstatSync });

    expect(resolved).toBe(fallbackTmp());
    expect(tmpdir).toHaveBeenCalled();
  });

  it("throws when fallback path is a symlink", () => {
    const lstatSync = vi.fn(() => ({
      isDirectory: () => true,
      isSymbolicLink: () => true,
      uid: 501,
      mode: 0o120777,
    }));
    const fallbackLstatSync = vi.fn(() => ({
      isDirectory: () => true,
      isSymbolicLink: () => true,
      uid: 501,
      mode: 0o120777,
    }));

    expect(() =>
      resolveWithMocks({
        lstatSync,
        fallbackLstatSync,
      }),
    ).toThrow(/Unsafe fallback OpenClaw temp dir/);
  });

  it("creates fallback directory when missing, then validates ownership and mode", () => {
    const lstatSync = vi.fn(() => ({
      isDirectory: () => true,
      isSymbolicLink: () => true,
      uid: 501,
      mode: 0o120777,
    }));
    const fallbackLstatSync = vi
      .fn<NonNullable<TmpDirOptions["lstatSync"]>>()
      .mockImplementationOnce(() => {
        throw nodeErrorWithCode("ENOENT");
      })
      .mockImplementationOnce(() => secureDirStat(501));

    const { resolved, mkdirSync } = resolveWithMocks({
      lstatSync,
      fallbackLstatSync,
    });

    expect(resolved).toBe(fallbackTmp());
    expect(mkdirSync).toHaveBeenCalledWith(fallbackTmp(), { recursive: true, mode: 0o700 });
  });
});

describe("resolvePreferredOpenClawTmpDir chmod fix", () => {
  it("fixes /tmp/openclaw permissions when directory exists with wrong mode", () => {
    // First call returns invalid (0775), then after chmod returns valid
    const chmodSync = vi.fn();
    const lstatSync = vi
      .fn<NonNullable<TmpDirOptions["lstatSync"]>>()
      .mockImplementationOnce(() => ({
        isDirectory: () => true,
        isSymbolicLink: () => false,
        uid: 501,
        mode: 0o40775, // group-writable - invalid
      }))
      .mockImplementationOnce(() => ({
        isDirectory: () => true,
        isSymbolicLink: () => false,
        uid: 501,
        mode: 0o40700, // fixed - now valid
      }));
    const accessSync = vi.fn();
    const mkdirSync = vi.fn();
    const getuid = vi.fn(() => 501);
    const tmpdir = vi.fn(() => "/var/fallback");

    const resolved = resolvePreferredOpenClawTmpDir({
      accessSync,
      lstatSync,
      mkdirSync,
      getuid,
      tmpdir,
      // @ts-expect-error - test-only option
      chmodSync,
    });

    expect(resolved).toBe(POSIX_OPENCLAW_TMP_DIR);
    expect(chmodSync).toHaveBeenCalledWith(POSIX_OPENCLAW_TMP_DIR, 0o700);
  });

  it("fixes fallback dir permissions when directory exists with wrong mode", () => {
    const chmodSync = vi.fn();
    // /tmp/openclaw doesnt exist (ENOENT), then mkdir succeeds but results in invalid state,
    // so it falls back to user-specific directory which has wrong permissions
    const lstatSync = vi
      .fn<NonNullable<TmpDirOptions["lstatSync"]>>()
      // First check /tmp/openclaw - ENOENT (missing)
      .mockImplementationOnce(() => {
        throw nodeErrorWithCode("ENOENT");
      })
      // After mkdir, check /tmp/openclaw again - return invalid to trigger fallback
      .mockImplementationOnce(() => ({
        isDirectory: () => false,
        isSymbolicLink: () => false,
        uid: 501,
        mode: 0o100644,
      }))
      // Check fallback - invalid (0775) - needs chmod
      .mockImplementationOnce(() => ({
        isDirectory: () => true,
        isSymbolicLink: () => false,
        uid: 501,
        mode: 0o40775,
      }))
      // After chmod - valid (0700)
      .mockImplementationOnce(() => ({
        isDirectory: () => true,
        isSymbolicLink: () => false,
        uid: 501,
        mode: 0o40700,
      }));
    const accessSync = vi.fn();
    const mkdirSync = vi.fn();
    const getuid = vi.fn(() => 501);
    const tmpdir = vi.fn(() => "/var/fallback");

    const resolved = resolvePreferredOpenClawTmpDir({
      accessSync,
      lstatSync,
      mkdirSync,
      getuid,
      tmpdir,
      chmodSync,
    });

    expect(resolved).toBe(fallbackTmp());
    expect(chmodSync).toHaveBeenCalledWith(fallbackTmp(), 0o700);
  });
});

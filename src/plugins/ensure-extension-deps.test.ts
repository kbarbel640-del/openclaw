import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectAvailablePackageManagerSync,
  ensureExtensionDepsSync,
  hasMissingDependenciesSync,
  resetPackageManagerCache,
} from "./ensure-extension-deps.js";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

const mockedSpawnSync = vi.mocked(spawnSync);

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ext-deps-test-"));
  resetPackageManagerCache();
  mockedSpawnSync.mockReset();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("hasMissingDependenciesSync", () => {
  it("returns false when no package.json exists", () => {
    expect(hasMissingDependenciesSync(tmpDir)).toBe(false);
  });

  it("returns false when package.json has no dependencies", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "test" }));
    expect(hasMissingDependenciesSync(tmpDir)).toBe(false);
  });

  it("returns false when dependencies is empty", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "test", dependencies: {} }),
    );
    expect(hasMissingDependenciesSync(tmpDir)).toBe(false);
  });

  it("returns true when a dependency is missing from node_modules", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "test", dependencies: { "some-pkg": "^1.0.0" } }),
    );
    expect(hasMissingDependenciesSync(tmpDir)).toBe(true);
  });

  it("returns false when all dependencies are present", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "test", dependencies: { "some-pkg": "^1.0.0" } }),
    );
    fs.mkdirSync(path.join(tmpDir, "node_modules", "some-pkg"), { recursive: true });
    expect(hasMissingDependenciesSync(tmpDir)).toBe(false);
  });

  it("handles scoped packages correctly", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "test", dependencies: { "@scope/pkg": "^1.0.0" } }),
    );
    // Missing
    expect(hasMissingDependenciesSync(tmpDir)).toBe(true);

    // Present
    fs.mkdirSync(path.join(tmpDir, "node_modules", "@scope", "pkg"), { recursive: true });
    expect(hasMissingDependenciesSync(tmpDir)).toBe(false);
  });

  it("ignores devDependencies and peerDependencies", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({
        name: "test",
        devDependencies: { "dev-only": "^1.0.0" },
        peerDependencies: { "peer-only": "^1.0.0" },
      }),
    );
    expect(hasMissingDependenciesSync(tmpDir)).toBe(false);
  });

  it("returns false for malformed package.json", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), "not json");
    expect(hasMissingDependenciesSync(tmpDir)).toBe(false);
  });
});

describe("detectAvailablePackageManagerSync", () => {
  it("returns npm when npm is available", () => {
    mockedSpawnSync.mockReturnValue({ status: 0 } as ReturnType<typeof spawnSync>);
    const result = detectAvailablePackageManagerSync();
    expect(result).not.toBeNull();
    expect(result!.command).toBe("npm");
    expect(mockedSpawnSync).toHaveBeenCalledWith("npm", ["--version"], expect.any(Object));
  });

  it("falls back to pnpm when npm is unavailable", () => {
    mockedSpawnSync.mockImplementation((cmd) => {
      if (cmd === "npm") {
        return { status: 1 } as ReturnType<typeof spawnSync>;
      }
      if (cmd === "pnpm") {
        return { status: 0 } as ReturnType<typeof spawnSync>;
      }
      return { status: 1 } as ReturnType<typeof spawnSync>;
    });
    const result = detectAvailablePackageManagerSync();
    expect(result).not.toBeNull();
    expect(result!.command).toBe("pnpm");
  });

  it("returns null when no PM is available", () => {
    mockedSpawnSync.mockReturnValue({ status: 1 } as ReturnType<typeof spawnSync>);
    const result = detectAvailablePackageManagerSync();
    expect(result).toBeNull();
  });

  it("caches the result across calls", () => {
    mockedSpawnSync.mockReturnValue({ status: 0 } as ReturnType<typeof spawnSync>);
    detectAvailablePackageManagerSync();
    detectAvailablePackageManagerSync();
    // Only probed once (the first matching PM)
    expect(mockedSpawnSync).toHaveBeenCalledTimes(1);
  });

  it("handles spawnSync throwing an error", () => {
    mockedSpawnSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    const result = detectAvailablePackageManagerSync();
    expect(result).toBeNull();
  });
});

describe("ensureExtensionDepsSync", () => {
  const logger = { info: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    logger.info.mockReset();
    logger.error.mockReset();
  });

  it("returns ok when no dependencies are missing", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "test" }));
    const result = ensureExtensionDepsSync({ packageDir: tmpDir, pluginId: "test", logger });
    expect(result).toEqual({ ok: true });
    // No spawn calls for install
    expect(mockedSpawnSync).not.toHaveBeenCalled();
  });

  it("installs dependencies and returns ok on success", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "test", dependencies: { "some-pkg": "^1.0.0" } }),
    );

    // PM detection + install
    mockedSpawnSync.mockImplementation((cmd, args) => {
      if (args?.[0] === "--version") {
        return { status: 0 } as ReturnType<typeof spawnSync>;
      }
      // Install call
      return {
        status: 0,
        stderr: Buffer.from(""),
        stdout: Buffer.from(""),
      } as ReturnType<typeof spawnSync>;
    });

    const result = ensureExtensionDepsSync({ packageDir: tmpDir, pluginId: "test", logger });
    expect(result).toEqual({ ok: true });
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("installing dependencies with npm"),
    );
  });

  it("returns error when install fails", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "test", dependencies: { "some-pkg": "^1.0.0" } }),
    );

    mockedSpawnSync.mockImplementation((_cmd, args) => {
      if (args?.[0] === "--version") {
        return { status: 0 } as ReturnType<typeof spawnSync>;
      }
      return {
        status: 1,
        stderr: Buffer.from("ERR! network timeout"),
        stdout: Buffer.from(""),
      } as ReturnType<typeof spawnSync>;
    });

    const result = ensureExtensionDepsSync({ packageDir: tmpDir, pluginId: "test", logger });
    expect(result).toEqual({ ok: false, error: "npm install failed: ERR! network timeout" });
  });

  it("returns error when no package manager is found", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "test", dependencies: { "some-pkg": "^1.0.0" } }),
    );

    mockedSpawnSync.mockReturnValue({ status: 1 } as ReturnType<typeof spawnSync>);

    const result = ensureExtensionDepsSync({ packageDir: tmpDir, pluginId: "test", logger });
    expect(result).toEqual({
      ok: false,
      error: "no package manager found on PATH (need npm, pnpm, yarn, or bun)",
    });
  });
});

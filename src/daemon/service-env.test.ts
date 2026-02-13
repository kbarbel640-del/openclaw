import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildMinimalServicePath,
  buildNodeServiceEnvironment,
  buildServiceEnvironment,
  getMinimalServicePathParts,
  getMinimalServicePathPartsFromEnv,
} from "./service-env.js";

/** Make statSync report the given dirs as existing directories. */
function mockExistingDirs(dirs: string[]) {
  const dirSet = new Set(dirs);
  vi.spyOn(fs, "statSync").mockImplementation((p: fs.PathLike) => {
    if (dirSet.has(String(p))) {
      return { isDirectory: () => true } as fs.Stats;
    }
    return undefined as unknown as fs.Stats;
  });
}

/** Make statSync report ALL dirs as existing. */
function mockAllDirsExist() {
  vi.spyOn(fs, "statSync").mockImplementation(() => ({ isDirectory: () => true }) as fs.Stats);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getMinimalServicePathParts - Linux user directories", () => {
  it("includes user bin directories when they exist on disk", () => {
    const allDirs = [
      "/home/testuser/.local/bin",
      "/home/testuser/.npm-global/bin",
      "/home/testuser/bin",
      "/home/testuser/.nvm/current/bin",
      "/home/testuser/.fnm/current/bin",
      "/home/testuser/.volta/bin",
      "/home/testuser/.asdf/shims",
      "/home/testuser/.local/share/pnpm",
      "/home/testuser/.bun/bin",
      "/usr/local/bin",
      "/usr/bin",
      "/bin",
    ];
    mockExistingDirs(allDirs);

    const result = getMinimalServicePathParts({
      platform: "linux",
      home: "/home/testuser",
    });

    expect(result).toContain("/home/testuser/.local/bin");
    expect(result).toContain("/home/testuser/.npm-global/bin");
    expect(result).toContain("/home/testuser/bin");
    expect(result).toContain("/home/testuser/.nvm/current/bin");
    expect(result).toContain("/home/testuser/.fnm/current/bin");
    expect(result).toContain("/home/testuser/.volta/bin");
    expect(result).toContain("/home/testuser/.asdf/shims");
    expect(result).toContain("/home/testuser/.local/share/pnpm");
    expect(result).toContain("/home/testuser/.bun/bin");
  });

  it("excludes nonexistent directories from PATH (#15316)", () => {
    mockExistingDirs(["/home/testuser/.local/bin", "/usr/local/bin", "/usr/bin", "/bin"]);

    const result = getMinimalServicePathParts({
      platform: "linux",
      home: "/home/testuser",
    });

    expect(result).toContain("/home/testuser/.local/bin");
    expect(result).toContain("/usr/local/bin");
    expect(result).not.toContain("/home/testuser/.nvm/current/bin");
    expect(result).not.toContain("/home/testuser/.fnm/current/bin");
    expect(result).not.toContain("/home/testuser/.npm-global/bin");
    expect(result).not.toContain("/home/testuser/.volta/bin");
  });

  it("excludes user bin directories when HOME is undefined on Linux", () => {
    mockExistingDirs(["/usr/local/bin", "/usr/bin", "/bin"]);

    const result = getMinimalServicePathParts({
      platform: "linux",
      home: undefined,
    });

    expect(result).toEqual(["/usr/local/bin", "/usr/bin", "/bin"]);
    expect(result.some((p) => p.includes(".local"))).toBe(false);
    expect(result.some((p) => p.includes(".npm-global"))).toBe(false);
    expect(result.some((p) => p.includes(".nvm"))).toBe(false);
  });

  it("places user directories before system directories on Linux", () => {
    mockExistingDirs(["/home/testuser/.local/bin", "/usr/local/bin", "/usr/bin", "/bin"]);

    const result = getMinimalServicePathParts({
      platform: "linux",
      home: "/home/testuser",
    });

    const userDirIndex = result.indexOf("/home/testuser/.local/bin");
    const systemDirIndex = result.indexOf("/usr/bin");

    expect(userDirIndex).toBeGreaterThan(-1);
    expect(systemDirIndex).toBeGreaterThan(-1);
    expect(userDirIndex).toBeLessThan(systemDirIndex);
  });

  it("places extraDirs before user directories on Linux", () => {
    mockExistingDirs([
      "/custom/bin",
      "/home/testuser/.local/bin",
      "/usr/local/bin",
      "/usr/bin",
      "/bin",
    ]);

    const result = getMinimalServicePathParts({
      platform: "linux",
      home: "/home/testuser",
      extraDirs: ["/custom/bin"],
    });

    const extraDirIndex = result.indexOf("/custom/bin");
    const userDirIndex = result.indexOf("/home/testuser/.local/bin");

    expect(extraDirIndex).toBeGreaterThan(-1);
    expect(userDirIndex).toBeGreaterThan(-1);
    expect(extraDirIndex).toBeLessThan(userDirIndex);
  });

  it("includes env-configured bin roots when they exist on disk", () => {
    mockExistingDirs([
      "/opt/pnpm",
      "/opt/npm/bin",
      "/opt/bun/bin",
      "/opt/volta/bin",
      "/opt/asdf/shims",
      "/opt/nvm/current/bin",
      "/opt/fnm/current/bin",
      "/home/testuser/.local/bin",
      "/usr/local/bin",
      "/usr/bin",
      "/bin",
    ]);

    const result = getMinimalServicePathPartsFromEnv({
      platform: "linux",
      env: {
        HOME: "/home/testuser",
        PNPM_HOME: "/opt/pnpm",
        NPM_CONFIG_PREFIX: "/opt/npm",
        BUN_INSTALL: "/opt/bun",
        VOLTA_HOME: "/opt/volta",
        ASDF_DATA_DIR: "/opt/asdf",
        NVM_DIR: "/opt/nvm",
        FNM_DIR: "/opt/fnm",
      },
    });

    expect(result).toContain("/opt/pnpm");
    expect(result).toContain("/opt/npm/bin");
    expect(result).toContain("/opt/bun/bin");
    expect(result).toContain("/opt/volta/bin");
    expect(result).toContain("/opt/asdf/shims");
    expect(result).toContain("/opt/nvm/current/bin");
    expect(result).toContain("/opt/fnm/current/bin");
  });

  it("does not include Linux user directories on macOS", () => {
    mockExistingDirs(["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"]);

    const result = getMinimalServicePathParts({
      platform: "darwin",
      home: "/Users/testuser",
    });

    expect(result.some((p) => p.includes(".npm-global"))).toBe(false);
    expect(result.some((p) => p.includes(".nvm"))).toBe(false);
    expect(result).toContain("/opt/homebrew/bin");
    expect(result).toContain("/usr/local/bin");
  });

  it("does not include Linux user directories on Windows", () => {
    const result = getMinimalServicePathParts({
      platform: "win32",
      home: "C:\\Users\\testuser",
    });

    expect(result).toEqual([]);
  });
});

describe("buildMinimalServicePath", () => {
  const splitPath = (value: string, platform: NodeJS.Platform) =>
    value.split(platform === "win32" ? path.win32.delimiter : path.posix.delimiter);

  it("includes Homebrew + system dirs on macOS", () => {
    mockExistingDirs(["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"]);

    const result = buildMinimalServicePath({ platform: "darwin" });
    const parts = splitPath(result, "darwin");
    expect(parts).toContain("/opt/homebrew/bin");
    expect(parts).toContain("/usr/local/bin");
    expect(parts).toContain("/usr/bin");
    expect(parts).toContain("/bin");
  });

  it("returns PATH as-is on Windows", () => {
    const result = buildMinimalServicePath({
      env: { PATH: "C:\\\\Windows\\\\System32" },
      platform: "win32",
    });
    expect(result).toBe("C:\\\\Windows\\\\System32");
  });

  it("includes Linux user directories when they exist on disk", () => {
    mockExistingDirs([
      "/home/alice/.local/bin",
      "/home/alice/.npm-global/bin",
      "/home/alice/.nvm/current/bin",
      "/usr/local/bin",
      "/usr/bin",
      "/bin",
    ]);

    const result = buildMinimalServicePath({
      platform: "linux",
      env: { HOME: "/home/alice" },
    });
    const parts = splitPath(result, "linux");

    expect(parts).toContain("/home/alice/.local/bin");
    expect(parts).toContain("/home/alice/.npm-global/bin");
    expect(parts).toContain("/home/alice/.nvm/current/bin");
    expect(parts).toContain("/usr/local/bin");
    expect(parts).toContain("/usr/bin");
    expect(parts).toContain("/bin");
  });

  it("excludes Linux user directories when HOME is not in env", () => {
    mockExistingDirs(["/usr/local/bin", "/usr/bin", "/bin"]);

    const result = buildMinimalServicePath({
      platform: "linux",
      env: {},
    });
    const parts = splitPath(result, "linux");

    expect(parts).toEqual(["/usr/local/bin", "/usr/bin", "/bin"]);
    expect(parts.some((p) => p.includes("home"))).toBe(false);
  });

  it("ensures user directories come before system directories on Linux", () => {
    mockExistingDirs(["/home/bob/.local/bin", "/usr/local/bin", "/usr/bin", "/bin"]);

    const result = buildMinimalServicePath({
      platform: "linux",
      env: { HOME: "/home/bob" },
    });
    const parts = splitPath(result, "linux");

    const firstUserDirIdx = parts.indexOf("/home/bob/.local/bin");
    const firstSystemDirIdx = parts.indexOf("/usr/local/bin");

    expect(firstUserDirIdx).toBeLessThan(firstSystemDirIdx);
  });

  it("includes extra directories when provided and they exist", () => {
    mockExistingDirs(["/custom/tools", "/usr/local/bin", "/usr/bin", "/bin"]);

    const result = buildMinimalServicePath({
      platform: "linux",
      extraDirs: ["/custom/tools"],
      env: {},
    });
    expect(splitPath(result, "linux")).toContain("/custom/tools");
  });

  it("deduplicates directories", () => {
    mockExistingDirs(["/usr/local/bin", "/usr/bin", "/bin"]);

    const result = buildMinimalServicePath({
      platform: "linux",
      extraDirs: ["/usr/bin"],
      env: {},
    });
    const parts = splitPath(result, "linux");
    const unique = [...new Set(parts)];
    expect(parts.length).toBe(unique.length);
  });
});

describe("buildServiceEnvironment", () => {
  it("sets minimal PATH and gateway vars", () => {
    mockAllDirsExist();

    const env = buildServiceEnvironment({
      env: { HOME: "/home/user" },
      port: 18789,
      token: "secret",
    });
    expect(env.HOME).toBe("/home/user");
    if (process.platform === "win32") {
      expect(env.PATH).toBe("");
    } else {
      expect(env.PATH).toContain("/usr/bin");
    }
    expect(env.OPENCLAW_GATEWAY_PORT).toBe("18789");
    expect(env.OPENCLAW_GATEWAY_TOKEN).toBe("secret");
    expect(env.OPENCLAW_SERVICE_MARKER).toBe("openclaw");
    expect(env.OPENCLAW_SERVICE_KIND).toBe("gateway");
    expect(typeof env.OPENCLAW_SERVICE_VERSION).toBe("string");
    expect(env.OPENCLAW_SYSTEMD_UNIT).toBe("openclaw-gateway.service");
    if (process.platform === "darwin") {
      expect(env.OPENCLAW_LAUNCHD_LABEL).toBe("ai.openclaw.gateway");
    }
  });

  it("uses profile-specific unit and label", () => {
    mockAllDirsExist();

    const env = buildServiceEnvironment({
      env: { HOME: "/home/user", OPENCLAW_PROFILE: "work" },
      port: 18789,
    });
    expect(env.OPENCLAW_SYSTEMD_UNIT).toBe("openclaw-gateway-work.service");
    if (process.platform === "darwin") {
      expect(env.OPENCLAW_LAUNCHD_LABEL).toBe("ai.openclaw.work");
    }
  });
});

describe("buildNodeServiceEnvironment", () => {
  it("passes through HOME for node services", () => {
    mockAllDirsExist();

    const env = buildNodeServiceEnvironment({
      env: { HOME: "/home/user" },
    });
    expect(env.HOME).toBe("/home/user");
  });
});

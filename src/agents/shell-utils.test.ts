import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { captureEnv } from "../test-utils/env.js";
import { getShellConfig, resolvePowerShellPath, resolveShellFromPath } from "./shell-utils.js";

const isWin = process.platform === "win32";

function createTempCommandDir(
  tempDirs: string[],
  files: Array<{ name: string; executable?: boolean }>,
): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-shell-"));
  tempDirs.push(dir);
  for (const file of files) {
    const filePath = path.join(dir, file.name);
    fs.writeFileSync(filePath, "");
    fs.chmodSync(filePath, file.executable === false ? 0o644 : 0o755);
  }
  return dir;
}

describe("getShellConfig", () => {
  let envSnapshot: ReturnType<typeof captureEnv>;
  const tempDirs: string[] = [];

  beforeEach(() => {
    envSnapshot = captureEnv(["SHELL", "PATH"]);
    if (!isWin) {
      process.env.SHELL = "/usr/bin/fish";
    }
  });

  afterEach(() => {
    envSnapshot.restore();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  if (isWin) {
    it("uses PowerShell on Windows", () => {
      const { shell } = getShellConfig();
      expect(shell.toLowerCase()).toContain("powershell");
    });
    return;
  }

  it("prefers bash when fish is default and bash is on PATH", () => {
    const binDir = createTempCommandDir(tempDirs, [{ name: "bash" }]);
    process.env.PATH = binDir;
    const { shell } = getShellConfig();
    expect(shell).toBe(path.join(binDir, "bash"));
  });

  it("falls back to sh when fish is default and bash is missing", () => {
    const binDir = createTempCommandDir(tempDirs, [{ name: "sh" }]);
    process.env.PATH = binDir;
    const { shell } = getShellConfig();
    expect(shell).toBe(path.join(binDir, "sh"));
  });

  it("falls back to env shell when fish is default and no sh is available", () => {
    process.env.PATH = "";
    const { shell } = getShellConfig();
    expect(shell).toBe("/usr/bin/fish");
  });

  it("uses sh when SHELL is unset", () => {
    delete process.env.SHELL;
    process.env.PATH = "";
    const { shell } = getShellConfig();
    expect(shell).toBe("sh");
  });
});

describe("resolveShellFromPath", () => {
  let envSnapshot: ReturnType<typeof captureEnv>;
  const tempDirs: string[] = [];

  beforeEach(() => {
    envSnapshot = captureEnv(["PATH"]);
  });

  afterEach(() => {
    envSnapshot.restore();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns undefined when PATH is empty", () => {
    process.env.PATH = "";
    expect(resolveShellFromPath("bash")).toBeUndefined();
  });

  if (isWin) {
    return;
  }

  it("returns the first executable match from PATH", () => {
    const notExecutable = createTempCommandDir(tempDirs, [{ name: "bash", executable: false }]);
    const executable = createTempCommandDir(tempDirs, [{ name: "bash", executable: true }]);
    process.env.PATH = [notExecutable, executable].join(path.delimiter);
    expect(resolveShellFromPath("bash")).toBe(path.join(executable, "bash"));
  });

  it("returns undefined when command does not exist", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-shell-empty-"));
    tempDirs.push(dir);
    process.env.PATH = dir;
    expect(resolveShellFromPath("bash")).toBeUndefined();
  });
});

if (isWin) {
  describe("resolvePowerShellPath", () => {
    let envSnapshot: ReturnType<typeof captureEnv>;
    const tempDirs: string[] = [];

    beforeEach(() => {
      envSnapshot = captureEnv([
        "ProgramFiles",
        "PROGRAMFILES",
        "ProgramW6432",
        "SystemRoot",
        "WINDIR",
        "PATH",
      ]);
    });

    afterEach(() => {
      envSnapshot.restore();
      for (const dir of tempDirs.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it("prefers PowerShell 7 over PS 5.1 when installed in ProgramFiles", () => {
      const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-pfiles-"));
      tempDirs.push(tempBase);
      const pwsh7Dir = path.join(tempBase, "PowerShell", "7");
      fs.mkdirSync(pwsh7Dir, { recursive: true });
      const pwsh7Path = path.join(pwsh7Dir, "pwsh.exe");
      fs.writeFileSync(pwsh7Path, "");

      process.env.ProgramFiles = tempBase;
      delete process.env.ProgramW6432;
      process.env.PATH = "";

      expect(resolvePowerShellPath()).toBe(pwsh7Path);
    });

    it("falls back to PS 5.1 when PowerShell 7 is not present", () => {
      const tempPf = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-pfiles-"));
      tempDirs.push(tempPf);
      // No pwsh.exe in ProgramFiles
      process.env.ProgramFiles = tempPf;
      delete process.env.ProgramW6432;
      process.env.PATH = "";

      const sysRoot = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-sysroot-"));
      tempDirs.push(sysRoot);
      const ps51Dir = path.join(sysRoot, "System32", "WindowsPowerShell", "v1.0");
      fs.mkdirSync(ps51Dir, { recursive: true });
      const ps51Path = path.join(ps51Dir, "powershell.exe");
      fs.writeFileSync(ps51Path, "");
      process.env.SystemRoot = sysRoot;
      delete process.env.WINDIR;

      expect(resolvePowerShellPath()).toBe(ps51Path);
    });

    it("finds pwsh via PATH when not in standard install location", () => {
      const tempPf = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-pfiles-"));
      tempDirs.push(tempPf);
      process.env.ProgramFiles = tempPf;
      delete process.env.ProgramW6432;

      const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-bin-"));
      tempDirs.push(binDir);
      const pwshPath = path.join(binDir, "pwsh");
      fs.writeFileSync(pwshPath, "");
      // On Windows, accessSync with X_OK passes for all files; simulate via PATH
      process.env.PATH = binDir;
      delete process.env.SystemRoot;
      delete process.env.WINDIR;

      expect(resolvePowerShellPath()).toBe(pwshPath);
    });
  });
}

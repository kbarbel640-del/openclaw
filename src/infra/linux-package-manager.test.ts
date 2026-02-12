import { describe, expect, it } from "vitest";
import {
  buildLinuxInstallCommand,
  detectLinuxPackageManager,
  resolveLinuxPackageName,
} from "./linux-package-manager.js";

describe("detectLinuxPackageManager", () => {
  it("returns undefined on non-linux platforms", () => {
    expect(
      detectLinuxPackageManager({ platform: "darwin", checkBinary: () => true }),
    ).toBeUndefined();
    expect(
      detectLinuxPackageManager({ platform: "win32", checkBinary: () => true }),
    ).toBeUndefined();
  });

  it("returns apt-get when available on linux", () => {
    const available = new Set(["apt-get"]);
    expect(
      detectLinuxPackageManager({ platform: "linux", checkBinary: (b) => available.has(b) }),
    ).toBe("apt-get");
  });

  it("returns apk when only apk is available", () => {
    const available = new Set(["apk"]);
    expect(
      detectLinuxPackageManager({ platform: "linux", checkBinary: (b) => available.has(b) }),
    ).toBe("apk");
  });

  it("prefers apt-get over apk when both are available", () => {
    const available = new Set(["apt-get", "apk"]);
    expect(
      detectLinuxPackageManager({ platform: "linux", checkBinary: (b) => available.has(b) }),
    ).toBe("apt-get");
  });

  it("returns dnf when apt-get and apk are absent", () => {
    const available = new Set(["dnf"]);
    expect(
      detectLinuxPackageManager({ platform: "linux", checkBinary: (b) => available.has(b) }),
    ).toBe("dnf");
  });

  it("returns undefined when no package manager is found on linux", () => {
    expect(
      detectLinuxPackageManager({ platform: "linux", checkBinary: () => false }),
    ).toBeUndefined();
  });
});

describe("buildLinuxInstallCommand", () => {
  it("builds apt-get command", () => {
    expect(buildLinuxInstallCommand("apt-get", "ffmpeg")).toEqual([
      "apt-get",
      "install",
      "-y",
      "ffmpeg",
    ]);
  });

  it("builds apk command", () => {
    expect(buildLinuxInstallCommand("apk", "ffmpeg")).toEqual([
      "apk",
      "add",
      "--no-cache",
      "ffmpeg",
    ]);
  });

  it("builds dnf command", () => {
    expect(buildLinuxInstallCommand("dnf", "ffmpeg")).toEqual(["dnf", "install", "-y", "ffmpeg"]);
  });

  it("builds yum command", () => {
    expect(buildLinuxInstallCommand("yum", "ffmpeg")).toEqual(["yum", "install", "-y", "ffmpeg"]);
  });

  it("builds pacman command", () => {
    expect(buildLinuxInstallCommand("pacman", "ffmpeg")).toEqual([
      "pacman",
      "-S",
      "--noconfirm",
      "ffmpeg",
    ]);
  });
});

describe("resolveLinuxPackageName", () => {
  it("returns simple formula name as-is", () => {
    expect(resolveLinuxPackageName("apt-get", "ffmpeg")).toBe("ffmpeg");
  });

  it("returns undefined for tap formulas without explicit mapping", () => {
    expect(resolveLinuxPackageName("apt-get", "steipete/tap/summarize")).toBeUndefined();
  });

  it("uses explicit apt field when provided", () => {
    expect(resolveLinuxPackageName("apt-get", "some-formula", { apt: "custom-apt-pkg" })).toBe(
      "custom-apt-pkg",
    );
  });

  it("uses explicit apk field for apk manager", () => {
    expect(resolveLinuxPackageName("apk", "some-formula", { apk: "custom-apk-pkg" })).toBe(
      "custom-apk-pkg",
    );
  });

  it("falls back to apt field for apk when no apk field is set", () => {
    expect(resolveLinuxPackageName("apk", "some-formula", { apt: "custom-apt-pkg" })).toBe(
      "custom-apt-pkg",
    );
  });

  it("uses explicit apt field even for tap formulas", () => {
    expect(resolveLinuxPackageName("apt-get", "steipete/tap/summarize", { apt: "summarize" })).toBe(
      "summarize",
    );
  });

  it("prefers apk field over apt field for apk manager", () => {
    expect(
      resolveLinuxPackageName("apk", "some-formula", { apt: "apt-name", apk: "apk-name" }),
    ).toBe("apk-name");
  });

  it("uses apt field for dnf, yum, and pacman", () => {
    expect(resolveLinuxPackageName("dnf", "myformula", { apt: "my-pkg" })).toBe("my-pkg");
    expect(resolveLinuxPackageName("yum", "myformula", { apt: "my-pkg" })).toBe("my-pkg");
    expect(resolveLinuxPackageName("pacman", "myformula", { apt: "my-pkg" })).toBe("my-pkg");
  });
});

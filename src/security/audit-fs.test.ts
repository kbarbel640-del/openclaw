import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  formatOctal,
  formatPermissionDetail,
  formatPermissionRemediation,
  inspectPathPermissions,
  isGroupReadable,
  isGroupWritable,
  isWorldReadable,
  isWorldWritable,
  modeBits,
  safeStat,
  type PermissionCheck,
} from "./audit-fs.js";

describe("audit-fs", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "audit-fs-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("safeStat", () => {
    it("returns file stats for existing file", async () => {
      const filePath = path.join(tempDir, "test.txt");
      await fs.writeFile(filePath, "test");

      const result = await safeStat(filePath);

      expect(result.ok).toBe(true);
      expect(result.isSymlink).toBe(false);
      expect(result.isDir).toBe(false);
      expect(result.mode).toBeTypeOf("number");
      expect(result.error).toBeUndefined();
    });

    it("returns directory stats for existing directory", async () => {
      const dirPath = path.join(tempDir, "subdir");
      await fs.mkdir(dirPath);

      const result = await safeStat(dirPath);

      expect(result.ok).toBe(true);
      expect(result.isSymlink).toBe(false);
      expect(result.isDir).toBe(true);
    });

    it("detects symlinks", async () => {
      const targetPath = path.join(tempDir, "target.txt");
      const linkPath = path.join(tempDir, "link.txt");
      await fs.writeFile(targetPath, "target");
      await fs.symlink(targetPath, linkPath);

      const result = await safeStat(linkPath);

      expect(result.ok).toBe(true);
      expect(result.isSymlink).toBe(true);
    });

    it("returns error for non-existent path", async () => {
      const result = await safeStat(path.join(tempDir, "nonexistent"));

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.mode).toBeNull();
    });
  });

  describe("inspectPathPermissions", () => {
    it("returns permission info for existing file", async () => {
      const filePath = path.join(tempDir, "test.txt");
      await fs.writeFile(filePath, "test");
      await fs.chmod(filePath, 0o644);

      const result = await inspectPathPermissions(filePath);

      expect(result.ok).toBe(true);
      expect(result.source).toBe("posix");
      expect(result.bits).toBe(0o644);
      expect(result.worldWritable).toBe(false);
      expect(result.groupWritable).toBe(false);
      expect(result.worldReadable).toBe(true);
      expect(result.groupReadable).toBe(true);
    });

    it("detects world-writable files", async () => {
      const filePath = path.join(tempDir, "world-writable.txt");
      await fs.writeFile(filePath, "test");
      await fs.chmod(filePath, 0o666);

      const result = await inspectPathPermissions(filePath);

      expect(result.worldWritable).toBe(true);
    });

    it("detects group-writable files", async () => {
      const filePath = path.join(tempDir, "group-writable.txt");
      await fs.writeFile(filePath, "test");
      await fs.chmod(filePath, 0o664);

      const result = await inspectPathPermissions(filePath);

      expect(result.groupWritable).toBe(true);
      expect(result.worldWritable).toBe(false);
    });

    it("returns error for non-existent path", async () => {
      const result = await inspectPathPermissions(path.join(tempDir, "nonexistent"));

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("uses win32 ACL inspection when platform is win32", async () => {
      const filePath = path.join(tempDir, "test.txt");
      await fs.writeFile(filePath, "test");

      // Mock successful Windows ACL inspection with typical output
      const mockExec = async () => ({
        stdout: `${filePath} NT AUTHORITY\\SYSTEM:(F)\n    BUILTIN\\Administrators:(F)\n    testuser:(F)`,
        stderr: "",
        error: null,
      });

      const result = await inspectPathPermissions(filePath, {
        platform: "win32",
        exec: mockExec,
      });

      expect(result.source).toBe("windows-acl");
      expect(result.ok).toBe(true);
    });
  });

  describe("modeBits", () => {
    it("extracts permission bits from mode", () => {
      expect(modeBits(0o100644)).toBe(0o644);
      expect(modeBits(0o100755)).toBe(0o755);
      expect(modeBits(0o40755)).toBe(0o755);
    });

    it("returns null for null input", () => {
      expect(modeBits(null)).toBeNull();
    });
  });

  describe("formatOctal", () => {
    it("formats bits as octal string", () => {
      expect(formatOctal(0o644)).toBe("644");
      expect(formatOctal(0o755)).toBe("755");
      expect(formatOctal(0o600)).toBe("600");
    });

    it("pads to 3 digits", () => {
      expect(formatOctal(0o7)).toBe("007");
      expect(formatOctal(0o77)).toBe("077");
    });

    it("returns unknown for null", () => {
      expect(formatOctal(null)).toBe("unknown");
    });
  });

  describe("permission bit checks", () => {
    it("isWorldWritable", () => {
      expect(isWorldWritable(0o666)).toBe(true);
      expect(isWorldWritable(0o664)).toBe(false);
      expect(isWorldWritable(0o644)).toBe(false);
      expect(isWorldWritable(0o002)).toBe(true);
      expect(isWorldWritable(null)).toBe(false);
    });

    it("isGroupWritable", () => {
      expect(isGroupWritable(0o664)).toBe(true);
      expect(isGroupWritable(0o644)).toBe(false);
      expect(isGroupWritable(0o020)).toBe(true);
      expect(isGroupWritable(null)).toBe(false);
    });

    it("isWorldReadable", () => {
      expect(isWorldReadable(0o644)).toBe(true);
      expect(isWorldReadable(0o640)).toBe(false);
      expect(isWorldReadable(0o004)).toBe(true);
      expect(isWorldReadable(null)).toBe(false);
    });

    it("isGroupReadable", () => {
      expect(isGroupReadable(0o640)).toBe(true);
      expect(isGroupReadable(0o600)).toBe(false);
      expect(isGroupReadable(0o040)).toBe(true);
      expect(isGroupReadable(null)).toBe(false);
    });
  });

  describe("formatPermissionDetail", () => {
    it("formats POSIX permission detail", () => {
      const perms: PermissionCheck = {
        ok: true,
        isSymlink: false,
        isDir: false,
        mode: 0o100644,
        bits: 0o644,
        source: "posix",
        worldWritable: false,
        groupWritable: false,
        worldReadable: true,
        groupReadable: true,
      };

      const result = formatPermissionDetail("/test/path", perms);

      expect(result).toBe("/test/path mode=644");
    });

    it("formats Windows ACL detail", () => {
      const perms: PermissionCheck = {
        ok: true,
        isSymlink: false,
        isDir: false,
        mode: null,
        bits: null,
        source: "windows-acl",
        worldWritable: false,
        groupWritable: false,
        worldReadable: false,
        groupReadable: false,
        aclSummary: "owner-only",
      };

      const result = formatPermissionDetail("C:\\test\\path", perms);

      expect(result).toBe("C:\\test\\path acl=owner-only");
    });
  });

  describe("formatPermissionRemediation", () => {
    it("formats chmod command for POSIX", () => {
      const perms: PermissionCheck = {
        ok: true,
        isSymlink: false,
        isDir: false,
        mode: 0o100666,
        bits: 0o666,
        source: "posix",
        worldWritable: true,
        groupWritable: true,
        worldReadable: true,
        groupReadable: true,
      };

      const result = formatPermissionRemediation({
        targetPath: "/test/file.txt",
        perms,
        isDir: false,
        posixMode: 0o600,
      });

      expect(result).toBe("chmod 600 /test/file.txt");
    });

    it("formats icacls command for Windows", () => {
      const perms: PermissionCheck = {
        ok: true,
        isSymlink: false,
        isDir: false,
        mode: null,
        bits: null,
        source: "windows-acl",
        worldWritable: true,
        groupWritable: false,
        worldReadable: true,
        groupReadable: false,
      };

      const result = formatPermissionRemediation({
        targetPath: "C:\\test\\file.txt",
        perms,
        isDir: false,
        posixMode: 0o600,
        env: { USERNAME: "testuser" },
      });

      // Should contain icacls command
      expect(result).toContain("icacls");
      expect(result).toContain("C:\\test\\file.txt");
    });
  });
});

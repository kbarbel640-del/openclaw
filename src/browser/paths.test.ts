import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveExistingPathsWithinRoot } from "./paths.js";

async function createFixtureRoot(): Promise<{ baseDir: string; uploadsDir: string }> {
  const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-browser-paths-"));
  const uploadsDir = path.join(baseDir, "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  return { baseDir, uploadsDir };
}

describe("resolveExistingPathsWithinRoot", () => {
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(
      Array.from(cleanupDirs).map(async (dir) => {
        await fs.rm(dir, { recursive: true, force: true });
      }),
    );
    cleanupDirs.clear();
  });

  it("accepts existing files under the upload root", async () => {
    const { baseDir, uploadsDir } = await createFixtureRoot();
    cleanupDirs.add(baseDir);

    const nestedDir = path.join(uploadsDir, "nested");
    await fs.mkdir(nestedDir, { recursive: true });
    const filePath = path.join(nestedDir, "ok.txt");
    await fs.writeFile(filePath, "ok", "utf8");

    const result = await resolveExistingPathsWithinRoot({
      rootDir: uploadsDir,
      requestedPaths: [filePath],
      scopeLabel: "uploads directory",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.paths).toEqual([await fs.realpath(filePath)]);
    }
  });

  it("rejects traversal outside the upload root", async () => {
    const { baseDir, uploadsDir } = await createFixtureRoot();
    cleanupDirs.add(baseDir);

    const outsidePath = path.join(baseDir, "outside.txt");
    await fs.writeFile(outsidePath, "nope", "utf8");

    const result = await resolveExistingPathsWithinRoot({
      rootDir: uploadsDir,
      requestedPaths: ["../outside.txt"],
      scopeLabel: "uploads directory",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("must stay within uploads directory");
    }
  });

  it("keeps lexical in-root paths when files do not exist yet", async () => {
    const { baseDir, uploadsDir } = await createFixtureRoot();
    cleanupDirs.add(baseDir);

    const result = await resolveExistingPathsWithinRoot({
      rootDir: uploadsDir,
      requestedPaths: ["missing.txt"],
      scopeLabel: "uploads directory",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Paths are resolved to their real (symlink-free) form
      const realUploadsDir = await fs.realpath(uploadsDir);
      expect(result.paths).toEqual([path.join(realUploadsDir, "missing.txt")]);
    }
  });

  it.runIf(process.platform !== "win32")(
    "rejects symlink escapes outside upload root",
    async () => {
      const { baseDir, uploadsDir } = await createFixtureRoot();
      cleanupDirs.add(baseDir);

      const outsidePath = path.join(baseDir, "secret.txt");
      await fs.writeFile(outsidePath, "secret", "utf8");
      const symlinkPath = path.join(uploadsDir, "leak.txt");
      await fs.symlink(outsidePath, symlinkPath);

      const result = await resolveExistingPathsWithinRoot({
        rootDir: uploadsDir,
        requestedPaths: ["leak.txt"],
        scopeLabel: "uploads directory",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("must stay within uploads directory");
      }
    },
  );

  it.runIf(process.platform !== "win32")(
    "accepts paths through parent directory symlinks",
    async () => {
      const { baseDir, uploadsDir } = await createFixtureRoot();
      cleanupDirs.add(baseDir);

      const filePath = path.join(uploadsDir, "doc.txt");
      await fs.writeFile(filePath, "hello", "utf8");

      // Create a symlink to the parent dir (simulates macOS /tmp -> /private/tmp)
      const symlinkDir = path.join(baseDir, "link-to-base");
      await fs.symlink(baseDir, symlinkDir);
      cleanupDirs.add(symlinkDir);
      const symlinkUploadsDir = path.join(symlinkDir, "uploads");

      // Root uses symlinked path; file path also goes through symlink
      const result = await resolveExistingPathsWithinRoot({
        rootDir: symlinkUploadsDir,
        requestedPaths: [path.join(symlinkUploadsDir, "doc.txt")],
        scopeLabel: "uploads directory",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.paths).toEqual([await fs.realpath(filePath)]);
      }
    },
  );

  it.runIf(process.platform !== "win32")(
    "accepts real paths when root uses a symlinked directory",
    async () => {
      const { baseDir, uploadsDir } = await createFixtureRoot();
      cleanupDirs.add(baseDir);

      const filePath = path.join(uploadsDir, "doc.txt");
      await fs.writeFile(filePath, "hello", "utf8");

      // Create a symlink to the parent dir
      const symlinkDir = path.join(baseDir, "link-to-base");
      await fs.symlink(baseDir, symlinkDir);
      cleanupDirs.add(symlinkDir);
      const symlinkUploadsDir = path.join(symlinkDir, "uploads");

      // Root uses symlinked path, but request uses the real (resolved) path
      const realFilePath = await fs.realpath(filePath);
      const result = await resolveExistingPathsWithinRoot({
        rootDir: symlinkUploadsDir,
        requestedPaths: [realFilePath],
        scopeLabel: "uploads directory",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.paths).toEqual([realFilePath]);
      }
    },
  );
});

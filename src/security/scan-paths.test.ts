import path from "node:path";
import { describe, expect, it } from "vitest";
import { isPathInside } from "./scan-paths.js";

describe("isPathInside", () => {
  it("keeps POSIX behavior (case-sensitive)", () => {
    // NOTE: This is a pure string/path operation test; it does not touch the filesystem.
    expect(isPathInside("/home/user/project", "/home/user/project/cache")).toBe(true);
    expect(isPathInside("/home/user/project", "/home/user/other")).toBe(false);

    // Case-sensitive on POSIX
    expect(isPathInside("/Home/User", "/home/user/file")).toBe(false);
  });

  it("treats win32 drive-letter casing as inside", () => {
    // Only meaningful on Windows, but we validate the helper is robust to casing.
    // If this suite runs on non-win32, current implementation will not enter the
    // win32 branch; keep the assertion conditional.
    if (process.platform !== "win32") {
      return;
    }

    expect(isPathInside("C:/Home/User/Project", "c:/home/user/project/cache")).toBe(true);
    expect(isPathInside("c:/home/user/project", "C:/home/user/other")).toBe(false);
  });

  it("handles extended-length \\\\?\\ paths on win32", () => {
    if (process.platform !== "win32") {
      return;
    }

    expect(isPathInside("C:/home/user/project", "\\\\?\\C:\\home\\user\\project\\cache")).toBe(
      true,
    );
  });

  it("handles extended-length UNC paths on win32", () => {
    if (process.platform !== "win32") {
      return;
    }

    expect(
      isPathInside("\\\\server\\share\\root", "\\\\?\\UNC\\server\\share\\root\\sub\\file.txt"),
    ).toBe(true);
  });

  it("does not confuse win32 relative results with absolute", () => {
    if (process.platform !== "win32") {
      return;
    }

    const base = "C:/a/b";
    const inside = "C:/a/b/c";
    const rel = path.win32.relative(
      path.win32.resolve(base).toLowerCase(),
      path.win32.resolve(inside).toLowerCase(),
    );
    expect(path.win32.isAbsolute(rel)).toBe(false);
    expect(isPathInside(base, inside)).toBe(true);
  });
});

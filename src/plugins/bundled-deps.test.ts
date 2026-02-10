import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type RootPackageJson = {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

describe("bundled extension deps", () => {
  it("declares LanceDB dependency needed by bundled memory-lancedb", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(here, "../..");
    const pkgPath = path.join(repoRoot, "package.json");

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as RootPackageJson;
    const declared =
      pkg.dependencies?.["@lancedb/lancedb"] ?? pkg.optionalDependencies?.["@lancedb/lancedb"];

    expect(declared, "package.json must declare @lancedb/lancedb for memory-lancedb").toBeTruthy();
  });
});

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { verifyPluginSdkRuntimeExports } from "../scripts/release-check.ts";

const tempDirs: string[] = [];

async function withTempModule(source: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-release-check-"));
  tempDirs.push(dir);
  const file = path.join(dir, "plugin-sdk-index.mjs");
  await fs.writeFile(file, source, "utf8");
  return file;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("verifyPluginSdkRuntimeExports", () => {
  it("accepts required plugin-sdk runtime exports", async () => {
    const modulePath = await withTempModule(
      "export function isDangerousNameMatchingEnabled() { return true; }\n",
    );

    await expect(verifyPluginSdkRuntimeExports(modulePath)).resolves.toEqual({
      missing: [],
      modulePath,
    });
  });

  it("reports missing plugin-sdk runtime exports", async () => {
    const modulePath = await withTempModule("export const somethingElse = true;\n");

    await expect(verifyPluginSdkRuntimeExports(modulePath)).resolves.toEqual({
      missing: ["isDangerousNameMatchingEnabled"],
      modulePath,
    });
  });
});

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

async function collectShellScripts(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectShellScripts(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".sh")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("bundled skill shell scripts", () => {
  it("are executable on unix platforms", async () => {
    if (process.platform === "win32") {
      return;
    }

    const skillsDir = fileURLToPath(new URL("../../skills", import.meta.url));
    const scripts = await collectShellScripts(skillsDir);
    expect(scripts.length).toBeGreaterThan(0);

    const nonExecutable: string[] = [];
    for (const scriptPath of scripts) {
      const stat = await fs.stat(scriptPath);
      if ((stat.mode & 0o111) === 0) {
        nonExecutable.push(path.relative(skillsDir, scriptPath));
      }
    }

    expect(nonExecutable).toEqual([]);
  });
});

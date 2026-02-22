import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { withEnvAsync } from "../test-utils/env.js";
import { discoverOpenClawPlugins } from "./discovery.js";

const tempDirs: string[] = [];

function makeTempDir() {
  const dir = path.join(os.tmpdir(), `openclaw-plugins-${randomUUID()}`);
  fs.mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

async function withStateDir<T>(stateDir: string, fn: () => Promise<T>) {
  return await withEnvAsync(
    {
      OPENCLAW_STATE_DIR: stateDir,
      CLAWDBOT_STATE_DIR: undefined,
      OPENCLAW_BUNDLED_PLUGINS_DIR: "/nonexistent/bundled/plugins",
    },
    fn,
  );
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failures
    }
  }
});

describe("plugin discovery archive/disabled folder filtering", () => {
  it("ignores archived and disabled extension directories", async () => {
    const stateDir = makeTempDir();
    const globalExt = path.join(stateDir, "extensions");

    const archivedDirs = [
      "feishu.disabled.20260222-120000",
      "feishu.20260222-120000.bak",
      "feishu.backup-20260222",
    ];
    for (const dirName of archivedDirs) {
      const dir = path.join(globalExt, dirName);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "index.ts"), "export default function () {}", "utf-8");
    }

    const activeDir = path.join(globalExt, "feishu-active");
    fs.mkdirSync(activeDir, { recursive: true });
    fs.writeFileSync(path.join(activeDir, "index.ts"), "export default function () {}", "utf-8");

    const { candidates } = await withStateDir(stateDir, async () => {
      return discoverOpenClawPlugins({});
    });

    const roots = candidates.map((candidate) => path.basename(candidate.rootDir));
    expect(roots).toContain("feishu-active");
    expect(roots).not.toContain("feishu.disabled.20260222-120000");
    expect(roots).not.toContain("feishu.20260222-120000.bak");
    expect(roots).not.toContain("feishu.backup-20260222");
  });
});

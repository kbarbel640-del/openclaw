import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withTempHome } from "./home-env.test-harness.js";
import { createConfigIO } from "./io.js";

async function waitForPersistedPartition(configPath: string, expectedKey: string): Promise<void> {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const raw = await fs.readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw) as {
      agents?: { defaults?: { promptCachePartition?: string } };
    };
    if (parsed.agents?.defaults?.promptCachePartition === expectedKey) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("timed out waiting for promptCachePartition persistence");
}

describe("config io prompt cache partition autofill", () => {
  it("auto-generates and persists agents.defaults.promptCachePartition", async () => {
    await withTempHome("openclaw-prompt-cache-partition-", async (home) => {
      const configPath = path.join(home, ".openclaw", "openclaw.json");
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify({}), "utf-8");

      const io = createConfigIO({
        env: {} as NodeJS.ProcessEnv,
        homedir: () => home,
        logger: { warn: () => {}, error: () => {} },
      });
      const cfg = io.loadConfig();
      const key = cfg.agents?.defaults?.promptCachePartition;

      expect(key).toMatch(/^[a-f0-9]{32}$/);
      await waitForPersistedPartition(configPath, key ?? "");

      const cfgReloaded = io.loadConfig();
      expect(cfgReloaded.agents?.defaults?.promptCachePartition).toBe(key);
    });
  });
});

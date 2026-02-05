import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { OpenClawConfig } from "../../config/config.js";
import { resolveStateDir } from "../../config/paths.js";
import type { GraspReport } from "./types.js";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function resolveCacheDir(): string {
  return path.join(resolveStateDir(), "cache", "grasp");
}

export function computeCacheKey(config: OpenClawConfig, agentId?: string): string {
  // Create a hash of the config + agent ID
  const content = JSON.stringify({
    agents: config.agents,
    tools: config.tools,
    gateway: config.gateway,
    channels: config.channels,
    agentId,
  });
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export async function getCachedReport(cacheKey: string): Promise<GraspReport | null> {
  const cacheFile = path.join(resolveCacheDir(), `${cacheKey}.json`);

  try {
    const stat = await fs.stat(cacheFile);
    const age = Date.now() - stat.mtimeMs;

    if (age > CACHE_TTL_MS) {
      // Cache expired
      await fs.unlink(cacheFile).catch(() => {});
      return null;
    }

    const content = await fs.readFile(cacheFile, "utf-8");
    const report = JSON.parse(content) as GraspReport;
    report.cached = true;
    report.cacheKey = cacheKey;
    return report;
  } catch {
    return null;
  }
}

export async function setCachedReport(cacheKey: string, report: GraspReport): Promise<void> {
  const cacheDir = resolveCacheDir();
  const cacheFile = path.join(cacheDir, `${cacheKey}.json`);

  try {
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(cacheFile, JSON.stringify(report, null, 2));
  } catch {
    // Ignore cache write failures
  }
}

export async function clearCache(): Promise<void> {
  const cacheDir = resolveCacheDir();
  try {
    await fs.rm(cacheDir, { recursive: true, force: true });
  } catch {
    // Ignore
  }
}

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readTierMap, resolveTierForContext, updateTierMap } from "./tiers.js";

async function createWorkspace(prefix: string): Promise<string> {
  const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await fs.mkdir(path.join(workspaceDir, "config"), { recursive: true });
  return workspaceDir;
}

describe("resolveTierForContext fail-closed fallback", () => {
  it("defaults autonomous requests to external tier", async () => {
    const workspaceDir = await createWorkspace("saint-tier-fallback-");
    try {
      const resolved = await resolveTierForContext({
        workspaceDir,
        sessionKey: "agent:main",
      });
      expect(resolved.tierName).toBe("external");
      expect(resolved.source).toBe("external");
      expect(resolved.contactSlug).toBe("external-unknown");
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });
});

describe("updateTierMap", () => {
  it("serializes concurrent updates without dropping entries", async () => {
    const workspaceDir = await createWorkspace("saint-tier-map-");
    try {
      await Promise.all(
        Array.from({ length: 24 }, (_, index) =>
          updateTierMap({
            workspaceDir,
            relativePath: "config/subagent-tiers.json",
            update: (current) => {
              current[`session-${index}`] = "manager";
            },
          }),
        ),
      );

      const map = await readTierMap(workspaceDir, "config/subagent-tiers.json");
      expect(Object.keys(map)).toHaveLength(24);
      for (let index = 0; index < 24; index += 1) {
        expect(map[`session-${index}`]).toBe("manager");
      }
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });
});

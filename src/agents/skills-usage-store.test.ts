import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_STATE_DIR = process.env.OPENCLAW_STATE_DIR;
const tempDirs: string[] = [];

async function withTempStateDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-skills-usage-"));
  tempDirs.push(dir);
  process.env.OPENCLAW_STATE_DIR = dir;
  vi.resetModules();
  return dir;
}

afterEach(async () => {
  if (ORIGINAL_STATE_DIR === undefined) {
    delete process.env.OPENCLAW_STATE_DIR;
  } else {
    process.env.OPENCLAW_STATE_DIR = ORIGINAL_STATE_DIR;
  }
  vi.resetModules();
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe.sequential("skills-usage-store", () => {
  it("registers skills and increments command/mapped counters", async () => {
    await withTempStateDir();
    const mod = await import("./skills-usage-store.js");
    await mod.registerSkillsUsageEntries(["skill-a", "skill-b"]);
    await mod.incrementSkillCommandUsage("skill-a");
    await mod.incrementMappedToolUsage(["skill-a", "skill-b"]);

    const store = await mod.loadSkillsUsageStore();
    const skillA = store.skills["skill-a"];
    const skillB = store.skills["skill-b"];
    expect(skillA?.commandCalls).toBe(1);
    expect(skillA?.mappedToolCalls).toBe(1);
    expect(skillA?.totalCalls).toBe(2);
    expect(skillB?.commandCalls).toBe(0);
    expect(skillB?.mappedToolCalls).toBe(1);
    expect(skillB?.totalCalls).toBe(1);
    expect(store.meta.unmappedToolCalls).toBe(0);
    expect(store.meta.mappedByRunContext).toBe(0);
    expect(store.meta.mappedByStaticDispatch).toBe(0);
  });

  it("increments unmapped tool counters", async () => {
    await withTempStateDir();
    const mod = await import("./skills-usage-store.js");
    await mod.incrementUnmappedToolUsage();
    await mod.incrementUnmappedToolUsage(2);
    await mod.incrementMappedByRunContextUsage(3);
    await mod.incrementMappedByStaticDispatchUsage(4);
    const store = await mod.loadSkillsUsageStore();
    expect(store.meta.unmappedToolCalls).toBe(3);
    expect(store.meta.mappedByRunContext).toBe(3);
    expect(store.meta.mappedByStaticDispatch).toBe(4);
  });

  it("falls back to .bak when primary file is invalid", async () => {
    const stateDir = await withTempStateDir();
    const mod = await import("./skills-usage-store.js");
    const storePath = mod.resolveSkillsUsageStorePath();
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.writeFile(storePath, "{not-json", "utf-8");
    await fs.writeFile(
      `${storePath}.bak`,
      JSON.stringify({
        version: 1,
        updatedAt: "2026-02-26T00:00:00.000Z",
        skills: {
          backupSkill: {
            firstSeenAt: "2026-02-26T00:00:00.000Z",
            lastSeenAt: "2026-02-26T00:00:00.000Z",
            commandCalls: 1,
            mappedToolCalls: 2,
            totalCalls: 3,
          },
        },
      }),
      "utf-8",
    );

    const loaded = await mod.loadSkillsUsageStore();
    expect(loaded.skills.backupSkill?.totalCalls).toBe(3);
    expect(loaded.meta.unmappedToolCalls).toBe(0);
    expect(loaded.meta.mappedByRunContext).toBe(0);
    expect(loaded.meta.mappedByStaticDispatch).toBe(0);
    expect(path.dirname(storePath)).toContain(path.basename(stateDir));
  });
});

import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { resolveAllowRecursiveSpawn, resolveMaxSpawnDepth } from "./recursive-spawn-config.js";

describe("resolveAllowRecursiveSpawn", () => {
  it("returns false by default", () => {
    expect(resolveAllowRecursiveSpawn({}, "main")).toBe(false);
  });

  it("returns global default when set", () => {
    const cfg: OpenClawConfig = {
      agents: { defaults: { subagents: { allowRecursiveSpawn: true } } },
    };
    expect(resolveAllowRecursiveSpawn(cfg, "main")).toBe(true);
  });

  it("per-agent overrides global", () => {
    const cfg: OpenClawConfig = {
      agents: {
        defaults: { subagents: { allowRecursiveSpawn: false } },
        list: [{ id: "main", subagents: { allowRecursiveSpawn: true } }],
      },
    };
    expect(resolveAllowRecursiveSpawn(cfg, "main")).toBe(true);
  });

  it("returns false when agent not found", () => {
    const cfg: OpenClawConfig = {
      agents: { list: [{ id: "other", subagents: { allowRecursiveSpawn: true } }] },
    };
    expect(resolveAllowRecursiveSpawn(cfg, "main")).toBe(false);
  });
});

describe("resolveMaxSpawnDepth", () => {
  it("returns 3 by default", () => {
    expect(resolveMaxSpawnDepth({}, "main")).toBe(3);
  });

  it("returns global default when set", () => {
    const cfg: OpenClawConfig = {
      agents: { defaults: { subagents: { maxDepth: 5 } } },
    };
    expect(resolveMaxSpawnDepth(cfg, "main")).toBe(5);
  });

  it("per-agent overrides global", () => {
    const cfg: OpenClawConfig = {
      agents: {
        defaults: { subagents: { maxDepth: 5 } },
        list: [{ id: "main", subagents: { maxDepth: 2 } }],
      },
    };
    expect(resolveMaxSpawnDepth(cfg, "main")).toBe(2);
  });

  it("clamps to 1-10 range", () => {
    const cfg1: OpenClawConfig = {
      agents: { defaults: { subagents: { maxDepth: 0 } } },
    };
    expect(resolveMaxSpawnDepth(cfg1, "main")).toBe(1);

    const cfg2: OpenClawConfig = {
      agents: { defaults: { subagents: { maxDepth: 99 } } },
    };
    expect(resolveMaxSpawnDepth(cfg2, "main")).toBe(10);
  });
});

import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { applyPersonaToBootstrapFiles, resolvePersonaKey } from "./persona.js";
import type { WorkspaceBootstrapFile } from "./workspace.js";

describe("persona", () => {
  it("resolves per-agent persona over defaults", () => {
    const cfg: OpenClawConfig = {
      agents: {
        defaults: { persona: "default-persona" },
        list: [{ id: "main", persona: "agent-persona" }],
      },
    };

    expect(resolvePersonaKey(cfg, "main")).toBe("agent-persona");
    expect(resolvePersonaKey(cfg, "other")).toBe("default-persona");
  });

  it("replaces SOUL.md injected content when persona file exists", async () => {
    const files: WorkspaceBootstrapFile[] = [
      { name: "AGENTS.md", path: "/ws/AGENTS.md", content: "agents", missing: false },
      { name: "SOUL.md", path: "/ws/SOUL.md", content: "original soul", missing: false },
    ];

    const next = await applyPersonaToBootstrapFiles({
      files,
      workspaceDir: "/ws",
      cfg: { agents: { defaults: { persona: "staff-engineer" } } } as unknown as OpenClawConfig,
      agentId: "main",
      readFile: async (filePath) => {
        expect(filePath.replace(/\\\\/g, "/")).toContain("/ws/personas/staff-engineer.md");
        return "# Persona\n\nDirect, pragmatic.\n";
      },
    });

    expect(next[1].name).toBe("SOUL.md");
    expect(next[1].content).toContain("Direct, pragmatic.");
  });

  it("does nothing when persona file is missing", async () => {
    const files: WorkspaceBootstrapFile[] = [
      { name: "SOUL.md", path: "/ws/SOUL.md", content: "original soul", missing: false },
    ];

    const next = await applyPersonaToBootstrapFiles({
      files,
      workspaceDir: "/ws",
      cfg: { agents: { defaults: { persona: "missing" } } } as unknown as OpenClawConfig,
      agentId: "main",
      readFile: async () => {
        throw new Error("ENOENT");
      },
    });

    expect(next).toEqual(files);
  });
});

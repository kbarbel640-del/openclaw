import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listSkillCommandsForAgents, resolveSkillCommandInvocation } from "./skill-commands.js";

async function writeSkill(params: {
  workspaceDir: string;
  dirName: string;
  name: string;
  description: string;
}) {
  const { workspaceDir, dirName, name, description } = params;
  const skillDir = path.join(workspaceDir, "skills", dirName);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(
    path.join(skillDir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`,
    "utf-8",
  );
}

describe("resolveSkillCommandInvocation", () => {
  it("matches skill commands and parses args", () => {
    const invocation = resolveSkillCommandInvocation({
      commandBodyNormalized: "/demo_skill do the thing",
      skillCommands: [{ name: "demo_skill", skillName: "demo-skill", description: "Demo" }],
    });
    expect(invocation?.command.skillName).toBe("demo-skill");
    expect(invocation?.args).toBe("do the thing");
  });

  it("supports /skill with name argument", () => {
    const invocation = resolveSkillCommandInvocation({
      commandBodyNormalized: "/skill demo_skill do the thing",
      skillCommands: [{ name: "demo_skill", skillName: "demo-skill", description: "Demo" }],
    });
    expect(invocation?.command.name).toBe("demo_skill");
    expect(invocation?.args).toBe("do the thing");
  });

  it("normalizes /skill lookup names", () => {
    const invocation = resolveSkillCommandInvocation({
      commandBodyNormalized: "/skill demo-skill",
      skillCommands: [{ name: "demo_skill", skillName: "demo-skill", description: "Demo" }],
    });
    expect(invocation?.command.name).toBe("demo_skill");
    expect(invocation?.args).toBeUndefined();
  });

  it("returns null for unknown commands", () => {
    const invocation = resolveSkillCommandInvocation({
      commandBodyNormalized: "/unknown arg",
      skillCommands: [{ name: "demo_skill", skillName: "demo-skill", description: "Demo" }],
    });
    expect(invocation).toBeNull();
  });
});

describe("listSkillCommandsForAgents", () => {
  it("merges command names across agents and de-duplicates", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-skills-"));
    const mainWorkspace = path.join(baseDir, "main");
    const researchWorkspace = path.join(baseDir, "research");
    await writeSkill({
      workspaceDir: mainWorkspace,
      dirName: "demo",
      name: "demo-skill",
      description: "Demo skill",
    });
    await writeSkill({
      workspaceDir: researchWorkspace,
      dirName: "demo2",
      name: "demo-skill",
      description: "Demo skill 2",
    });
    await writeSkill({
      workspaceDir: researchWorkspace,
      dirName: "extra",
      name: "extra-skill",
      description: "Extra skill",
    });

    const commands = listSkillCommandsForAgents({
      cfg: {
        agents: {
          list: [
            { id: "main", workspace: mainWorkspace },
            { id: "research", workspace: researchWorkspace },
          ],
        },
      },
    });
    const names = commands.map((entry) => entry.name);
    expect(names).toContain("demo_skill");
    expect(names).toContain("demo_skill_2");
    expect(names).toContain("extra_skill");
  });
});

describe("listSkillCommandsForAgents - shared bundled skills dedup (#14721)", () => {
  it("deduplicates bundled skills shared across agents with different workspaces", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-skills-bundled-"));

    // Create a shared "bundled" skills directory with a skill
    const sharedSkillsDir = path.join(baseDir, "bundled-skills");
    const bundledSkillDir = path.join(sharedSkillsDir, "weather");
    await fs.mkdir(bundledSkillDir, { recursive: true });
    await fs.writeFile(
      path.join(bundledSkillDir, "SKILL.md"),
      "---\nname: weather\ndescription: Check weather\n---\n\n# Weather\n",
      "utf-8",
    );
    const bundledSkillDir2 = path.join(sharedSkillsDir, "search");
    await fs.mkdir(bundledSkillDir2, { recursive: true });
    await fs.writeFile(
      path.join(bundledSkillDir2, "SKILL.md"),
      "---\nname: search\ndescription: Web search\n---\n\n# Search\n",
      "utf-8",
    );

    // Create two distinct workspace directories (no local skills)
    const workspaceA = path.join(baseDir, "workspace-a");
    const workspaceB = path.join(baseDir, "workspace-b");
    await fs.mkdir(workspaceA, { recursive: true });
    await fs.mkdir(workspaceB, { recursive: true });

    // Point bundled skills dir to our shared directory
    const origEnv = process.env.OPENCLAW_BUNDLED_SKILLS_DIR;
    process.env.OPENCLAW_BUNDLED_SKILLS_DIR = sharedSkillsDir;
    try {
      const commands = listSkillCommandsForAgents({
        cfg: {
          agents: {
            list: [
              { id: "agent-a", workspace: workspaceA },
              { id: "agent-b", workspace: workspaceB },
            ],
          },
        },
      });
      const names = commands.map((entry) => entry.name);
      // Each bundled skill should appear exactly once — no _2 suffixes
      expect(names).toContain("weather");
      expect(names).toContain("search");
      expect(names).not.toContain("weather_2");
      expect(names).not.toContain("search_2");
      expect(commands.length).toBe(2);
    } finally {
      if (origEnv === undefined) {
        delete process.env.OPENCLAW_BUNDLED_SKILLS_DIR;
      } else {
        process.env.OPENCLAW_BUNDLED_SKILLS_DIR = origEnv;
      }
    }
  });

  it("still registers workspace-specific skills even when bundled skills are shared", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-skills-mixed-"));

    // Shared bundled skill
    const sharedSkillsDir = path.join(baseDir, "bundled-skills");
    const bundledSkillDir = path.join(sharedSkillsDir, "weather");
    await fs.mkdir(bundledSkillDir, { recursive: true });
    await fs.writeFile(
      path.join(bundledSkillDir, "SKILL.md"),
      "---\nname: weather\ndescription: Check weather\n---\n\n# Weather\n",
      "utf-8",
    );

    // Workspace A has no local skills
    const workspaceA = path.join(baseDir, "workspace-a");
    await fs.mkdir(workspaceA, { recursive: true });

    // Workspace B has a unique local skill
    const workspaceB = path.join(baseDir, "workspace-b");
    await writeSkill({
      workspaceDir: workspaceB,
      dirName: "deploy",
      name: "deploy",
      description: "Deploy to production",
    });

    const origEnv = process.env.OPENCLAW_BUNDLED_SKILLS_DIR;
    process.env.OPENCLAW_BUNDLED_SKILLS_DIR = sharedSkillsDir;
    try {
      const commands = listSkillCommandsForAgents({
        cfg: {
          agents: {
            list: [
              { id: "agent-a", workspace: workspaceA },
              { id: "agent-b", workspace: workspaceB },
            ],
          },
        },
      });
      const names = commands.map((entry) => entry.name);
      // Bundled skill appears once
      expect(names).toContain("weather");
      expect(names).not.toContain("weather_2");
      // Workspace-specific skill also appears
      expect(names).toContain("deploy");
      expect(commands.length).toBe(2);
    } finally {
      if (origEnv === undefined) {
        delete process.env.OPENCLAW_BUNDLED_SKILLS_DIR;
      } else {
        process.env.OPENCLAW_BUNDLED_SKILLS_DIR = origEnv;
      }
    }
  });

  it("still _2-suffixes genuinely different workspace skills with the same name", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-skills-diff-"));

    // No bundled skills
    const emptyBundled = path.join(baseDir, "empty-bundled");
    await fs.mkdir(emptyBundled, { recursive: true });

    const workspaceA = path.join(baseDir, "workspace-a");
    const workspaceB = path.join(baseDir, "workspace-b");

    // Both workspaces define a "report" skill but from different files
    await writeSkill({
      workspaceDir: workspaceA,
      dirName: "report",
      name: "report",
      description: "Generate report A",
    });
    await writeSkill({
      workspaceDir: workspaceB,
      dirName: "report",
      name: "report",
      description: "Generate report B",
    });

    const origEnv = process.env.OPENCLAW_BUNDLED_SKILLS_DIR;
    process.env.OPENCLAW_BUNDLED_SKILLS_DIR = emptyBundled;
    try {
      const commands = listSkillCommandsForAgents({
        cfg: {
          agents: {
            list: [
              { id: "agent-a", workspace: workspaceA },
              { id: "agent-b", workspace: workspaceB },
            ],
          },
        },
      });
      const names = commands.map((entry) => entry.name);
      // Different files → both should register, second gets _2
      expect(names).toContain("report");
      expect(names).toContain("report_2");
    } finally {
      if (origEnv === undefined) {
        delete process.env.OPENCLAW_BUNDLED_SKILLS_DIR;
      } else {
        process.env.OPENCLAW_BUNDLED_SKILLS_DIR = origEnv;
      }
    }
  });
});

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

  it("handles multi-line arguments correctly", () => {
    const multiLineCommand = "/hive_scout FEEDBACK BELOW:\nBYOK model - customers provide their own API keys...\nEmail notifications...";
    const invocation = resolveSkillCommandInvocation({
      commandBodyNormalized: multiLineCommand,
      skillCommands: [{ name: "hive_scout", skillName: "hive-scout", description: "Scout feedback" }],
    });
    expect(invocation?.command.name).toBe("hive_scout");
    expect(invocation?.args).toBe("FEEDBACK BELOW:\nBYOK model - customers provide their own API keys...\nEmail notifications...");
  });

  it("handles multi-line with /skill syntax", () => {
    const multiLineCommand = "/skill demo_tool Here is some feedback:\nLine 2 of feedback\nLine 3 of feedback";
    const invocation = resolveSkillCommandInvocation({
      commandBodyNormalized: multiLineCommand,
      skillCommands: [{ name: "demo_tool", skillName: "demo-tool", description: "Demo" }],
    });
    expect(invocation?.command.name).toBe("demo_tool");
    expect(invocation?.args).toBe("Here is some feedback:\nLine 2 of feedback\nLine 3 of feedback");
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

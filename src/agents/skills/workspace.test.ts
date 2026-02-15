import type { Skill } from "@mariozechner/pi-coding-agent";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readSkillContentsByName } from "./workspace.js";

describe("readSkillContentsByName", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeSkill(name: string, content: string): Skill {
    const skillDir = path.join(tmpDir, name);
    fs.mkdirSync(skillDir, { recursive: true });
    const filePath = path.join(skillDir, "SKILL.md");
    fs.writeFileSync(filePath, content, "utf-8");
    return {
      name,
      description: `${name} skill`,
      filePath,
      baseDir: skillDir,
    } as Skill;
  }

  it("reads matching skills case-insensitively", () => {
    const gog = makeSkill("gog", "# GOG\nUse gog gmail get");
    const other = makeSkill("other-skill", "# Other\nOther docs");

    const results = readSkillContentsByName({
      skillNames: ["GOG", "Other-Skill"],
      resolvedSkills: [gog, other],
    });

    expect(results).toHaveLength(2);
    expect(results[0]!.name).toBe("gog");
    expect(results[0]!.content).toBe("# GOG\nUse gog gmail get");
    expect(results[1]!.name).toBe("other-skill");
    expect(results[1]!.content).toBe("# Other\nOther docs");
  });

  it("skips non-matching skill names", () => {
    const gog = makeSkill("gog", "# GOG");

    const results = readSkillContentsByName({
      skillNames: ["nonexistent"],
      resolvedSkills: [gog],
    });

    expect(results).toEqual([]);
  });

  it("returns empty array for empty inputs", () => {
    expect(readSkillContentsByName({ skillNames: [], resolvedSkills: [] })).toEqual([]);
    expect(readSkillContentsByName({ skillNames: ["gog"], resolvedSkills: undefined })).toEqual([]);
    expect(readSkillContentsByName({ skillNames: [], resolvedSkills: undefined })).toEqual([]);
  });

  it("silently skips unreadable files", () => {
    const skill: Skill = {
      name: "broken",
      description: "broken skill",
      filePath: path.join(tmpDir, "nonexistent", "SKILL.md"),
      baseDir: path.join(tmpDir, "nonexistent"),
    } as Skill;

    const results = readSkillContentsByName({
      skillNames: ["broken"],
      resolvedSkills: [skill],
    });

    expect(results).toEqual([]);
  });

  it("skips skills with empty content", () => {
    const empty = makeSkill("empty", "   ");

    const results = readSkillContentsByName({
      skillNames: ["empty"],
      resolvedSkills: [empty],
    });

    expect(results).toEqual([]);
  });
});

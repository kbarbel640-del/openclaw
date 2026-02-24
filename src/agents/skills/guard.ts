import type { Skill } from "@mariozechner/pi-coding-agent";
import type { SkillFirstGuardConfig, SkillFirstGuardSkill } from "../pi-tools.before-tool-call.js";
import type { SkillEntry, SkillSnapshot } from "./types.js";

function normalizeGuardSkillKey(skill: SkillFirstGuardSkill): string {
  const name = skill.name?.trim().toLowerCase() ?? "";
  const filePath = skill.path.trim().toLowerCase();
  return `${name}|${filePath}`;
}

function toGuardSkillsFromResolved(skills: Skill[]): SkillFirstGuardSkill[] {
  return skills
    .map((skill) => ({
      name: skill.name,
      path: skill.filePath,
    }))
    .filter((skill) => skill.path.trim().length > 0);
}

function toGuardSkillsFromEntries(entries: SkillEntry[]): SkillFirstGuardSkill[] {
  return entries
    .map((entry) => ({
      name: entry.skill.name,
      path: entry.skill.filePath,
    }))
    .filter((skill) => skill.path.trim().length > 0);
}

export function buildSkillFirstGuardConfigForRun(params: {
  skillsSnapshot?: SkillSnapshot;
  entries?: SkillEntry[];
}): SkillFirstGuardConfig | undefined {
  const fromSnapshot =
    params.skillsSnapshot?.resolvedSkills && params.skillsSnapshot.resolvedSkills.length > 0
      ? toGuardSkillsFromResolved(params.skillsSnapshot.resolvedSkills)
      : [];
  const fromEntries =
    params.entries && params.entries.length > 0 ? toGuardSkillsFromEntries(params.entries) : [];
  const merged = [...fromSnapshot, ...fromEntries];
  if (merged.length === 0) {
    return undefined;
  }
  const deduped: SkillFirstGuardSkill[] = [];
  const seen = new Set<string>();
  for (const skill of merged) {
    const key = normalizeGuardSkillKey(skill);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(skill);
  }
  if (deduped.length === 0) {
    return undefined;
  }
  return {
    enabled: true,
    requireReadBeforeMutatingTools: true,
    skills: deduped,
  };
}

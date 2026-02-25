/**
 * Sophie Photography Skill Loader
 *
 * Loads, parses, and selects photography-specific SKILL.md files.
 * Each skill provides domain knowledge for a category of photography
 * (wedding, portrait, backlit, etc.) that Sophie uses as additional
 * context during editing.
 *
 * Skills are auto-selected based on the current SceneClassification,
 * providing the VLM with relevant domain expertise for the photo
 * being edited.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

/**
 * Parsed photography skill.
 */
export interface PhotographySkill {
  /** Skill name (from frontmatter) */
  name: string;
  /** Human-readable description */
  description: string;
  /** Trigger conditions for auto-selection */
  triggers: SkillTriggers;
  /** Full markdown body (the domain knowledge) */
  body: string;
  /** Source file path */
  filePath: string;
}

export interface SkillTriggers {
  /** Scenario keys that activate this skill */
  scenarios?: string[];
  /** Subject types that activate this skill */
  subjects?: string[];
  /** TimeOfDay values that activate this skill */
  timeOfDay?: string[];
  /** Lighting values that activate this skill */
  lighting?: string[];
  /** Freeform keywords */
  keywords?: string[];
}

/**
 * A classification context used for skill matching.
 * Maps to SceneClassification dimensions.
 */
export interface SkillMatchContext {
  timeOfDay?: string;
  location?: string;
  lighting?: string;
  subject?: string;
  special?: string | null;
}

/** Loaded skills cache */
let loadedSkills: PhotographySkill[] | null = null;

/**
 * Get the default skills directory path.
 */
export function getSkillsDir(): string {
  // Resolve relative to this file's location in the extension
  const extensionRoot = path.resolve(
    import.meta.dirname ?? path.join(process.cwd(), "extensions", "sophie", "src"),
    "..",
  );
  return path.join(extensionRoot, "skills");
}

/**
 * Load all photography skills from the skills directory.
 * Results are cached — call `resetSkillCache()` to reload.
 */
export async function loadSkills(skillsDir?: string): Promise<PhotographySkill[]> {
  if (loadedSkills) return loadedSkills;

  const dir = skillsDir ?? getSkillsDir();
  const skills: PhotographySkill[] = [];

  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillPath = path.join(dir, entry.name, "SKILL.md");
      if (!fs.existsSync(skillPath)) continue;

      try {
        const content = await fsp.readFile(skillPath, "utf-8");
        const skill = parseSkillFile(content, skillPath);
        if (skill) {
          skills.push(skill);
        }
      } catch (err) {
        console.warn(`[SkillLoader] Failed to parse ${skillPath}:`, err);
      }
    }
  } catch {
    console.warn(`[SkillLoader] Skills directory not found: ${dir}`);
  }

  loadedSkills = skills;
  console.log(`[SkillLoader] Loaded ${skills.length} photography skills`);
  return skills;
}

/**
 * Load skills synchronously (for use in constructors).
 */
export function loadSkillsSync(skillsDir?: string): PhotographySkill[] {
  if (loadedSkills) return loadedSkills;

  const dir = skillsDir ?? getSkillsDir();
  const skills: PhotographySkill[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillPath = path.join(dir, entry.name, "SKILL.md");
      if (!fs.existsSync(skillPath)) continue;

      try {
        const content = fs.readFileSync(skillPath, "utf-8");
        const skill = parseSkillFile(content, skillPath);
        if (skill) skills.push(skill);
      } catch {
        // skip unparseable skills
      }
    }
  } catch {
    // skills dir doesn't exist yet
  }

  loadedSkills = skills;
  return skills;
}

/**
 * Reset the loaded skills cache.
 */
export function resetSkillCache(): void {
  loadedSkills = null;
}

/**
 * Select the best matching skill(s) for a given scene classification.
 * Returns skills ranked by match quality (best first).
 */
export function selectSkills(
  context: SkillMatchContext,
  skills?: PhotographySkill[],
): PhotographySkill[] {
  const allSkills = skills ?? loadedSkills ?? [];
  if (allSkills.length === 0) return [];

  const scored = allSkills.map((skill) => ({
    skill,
    score: computeMatchScore(skill.triggers, context),
  }));

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.skill);
}

/**
 * Build a VLM context string from selected skills.
 * Combines the most relevant skill(s) into a concise prompt section.
 */
export function buildSkillContext(
  context: SkillMatchContext,
  skills?: PhotographySkill[],
  maxSkills = 2,
): string | null {
  const selected = selectSkills(context, skills).slice(0, maxSkills);
  if (selected.length === 0) return null;

  const parts: string[] = [];
  parts.push("## Photography Domain Knowledge\n");

  for (const skill of selected) {
    // Extract just the key sections (Sophie Guidance + Common Pitfalls)
    const guidance = extractSection(skill.body, "Sophie Guidance");
    const pitfalls = extractSection(skill.body, "Common Pitfalls");

    parts.push(`### ${skill.name}\n`);
    if (guidance) {
      parts.push(guidance);
      parts.push("");
    }
    if (pitfalls) {
      parts.push("**Watch out for:**");
      parts.push(pitfalls);
      parts.push("");
    }
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

/**
 * Parse a SKILL.md file into a PhotographySkill object.
 * Handles YAML frontmatter delimited by `---`.
 */
function parseSkillFile(content: string, filePath: string): PhotographySkill | null {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    // No frontmatter — treat entire content as body
    return {
      name: path.basename(path.dirname(filePath)),
      description: "",
      triggers: {},
      body: content,
      filePath,
    };
  }

  const frontmatter = fmMatch[1];
  const body = fmMatch[2].trim();

  // Simple YAML parser for our known structure
  const name = extractYamlString(frontmatter, "name") ?? path.basename(path.dirname(filePath));
  const description = extractYamlString(frontmatter, "description") ?? "";
  const triggers = extractTriggers(frontmatter);

  return { name, description, triggers, body, filePath };
}

/**
 * Extract a simple string value from YAML.
 */
function extractYamlString(yaml: string, key: string): string | null {
  const match = yaml.match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, "m"));
  return match?.[1] ?? null;
}

/**
 * Extract trigger arrays from YAML frontmatter.
 */
function extractTriggers(yaml: string): SkillTriggers {
  const triggers: SkillTriggers = {};

  const extractArray = (section: string): string[] => {
    const results: string[] = [];
    const lines = section.split("\n");
    for (const line of lines) {
      const itemMatch = line.match(/^\s+-\s+(.+)/);
      if (itemMatch) {
        results.push(itemMatch[1].trim());
      }
    }
    return results;
  };

  // Find each triggers subsection
  const triggersBlock = yaml.match(/triggers:\n([\s\S]*?)(?=\n\w|\n---|\s*$)/);
  if (!triggersBlock) return triggers;

  const block = triggersBlock[1];

  const sectionPattern = /\s+(\w+):\n((?:\s+-\s+.+\n?)*)/g;
  let match;
  while ((match = sectionPattern.exec(block)) !== null) {
    const key = match[1] as keyof SkillTriggers;
    const items = extractArray(match[2]);
    if (items.length > 0) {
      triggers[key] = items;
    }
  }

  return triggers;
}

/**
 * Compute a match score between a skill's triggers and a classification context.
 */
function computeMatchScore(triggers: SkillTriggers, context: SkillMatchContext): number {
  let score = 0;

  // Special/scenario matches are strongest
  if (triggers.scenarios && context.special) {
    if (triggers.scenarios.includes(context.special)) {
      score += 3;
    }
  }

  // Subject match
  if (triggers.subjects && context.subject) {
    if (triggers.subjects.includes(context.subject)) {
      score += 2;
    }
  }

  // Lighting match
  if (triggers.lighting && context.lighting) {
    if (triggers.lighting.includes(context.lighting)) {
      score += 2;
    }
  }

  // Time of day match
  if (triggers.timeOfDay && context.timeOfDay) {
    if (triggers.timeOfDay.includes(context.timeOfDay)) {
      score += 1.5;
    }
  }

  // Scenario keyword match against special
  if (triggers.scenarios && context.special) {
    for (const scenario of triggers.scenarios) {
      if (context.special.includes(scenario) || scenario.includes(context.special)) {
        score += 1;
      }
    }
  }

  return score;
}

/**
 * Extract a markdown section by heading.
 */
function extractSection(markdown: string, heading: string): string | null {
  const pattern = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |\\n---\\s*$|$)`);
  const match = markdown.match(pattern);
  return match?.[1]?.trim() ?? null;
}

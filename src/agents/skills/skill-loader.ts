import fs from "node:fs/promises";
import path from "node:path";
import yaml from "yaml";
import { type Skill, SkillMetadataSchema, type SkillResource } from "./skill-system-types.js";

export class SkillLoader {
  private skillsDir: string;

  constructor(skillsDir: string) {
    this.skillsDir = skillsDir;
  }

  async listSkills(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.skillsDir, { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch (error) {
      // If directory doesn't exist, return empty
      return [];
    }
  }

  async loadSkill(name: string): Promise<Skill | null> {
    const skillPath = path.join(this.skillsDir, name);
    const skillMdPath = path.join(skillPath, "SKILL.md");

    try {
      const content = await fs.readFile(skillMdPath, "utf-8");
      const { metadata, body } = this.parseFrontmatter(content);

      // Validate metadata
      const validMetadata = SkillMetadataSchema.parse(metadata);

      // Load resources list (lazy)
      const resources = await this.discoverResources(skillPath);

      return {
        metadata: validMetadata,
        instructions: body,
        resources,
        dirPath: skillPath,
      };
    } catch (error) {
      console.error(`Failed to load skill ${name}:`, error);
      return null;
    }
  }

  private parseFrontmatter(content: string): { metadata: any; body: string } {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
      return { metadata: {}, body: content };
    }
    const yamlContent = match[1];
    const body = match[2];
    return {
      metadata: yaml.parse(yamlContent),
      body: body.trim(),
    };
  }

  private async discoverResources(skillPath: string): Promise<SkillResource[]> {
    const resources: SkillResource[] = [];
    const subdirs = ["references", "examples", "scripts", "assets"];

    for (const type of subdirs) {
      const dir = path.join(skillPath, type);
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          // Ignore hidden files and .DS_Store
          if (file.startsWith(".")) continue;

          resources.push({
            path: path.join(type, file), // Relative path
            type: type as any,
          });
        }
      } catch (e) {
        // Directory doesn't exist, ignore
      }
    }
    return resources;
  }
}

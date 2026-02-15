import { z } from "zod";

export const SkillMetadataSchema = z.object({
  name: z.string().describe("Unique identifier for the skill (kebab-case)"),
  description: z.string().describe("Third-person description including specific trigger phrases"),
  version: z.string().optional(),
});

export type SkillMetadata = z.infer<typeof SkillMetadataSchema>;

export interface SkillResource {
  path: string;
  type: "reference" | "example" | "script" | "asset";
  content?: string; // Loaded lazily
}

export interface Skill {
  metadata: SkillMetadata;
  instructions: string; // The content of SKILL.md body
  resources: SkillResource[];
  dirPath: string;
}

export const SkillLoadSchema = z.object({
  name: z.string().describe("The name of the skill to load"),
});

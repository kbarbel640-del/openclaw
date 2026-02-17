import path from "node:path";
import { SkillLoader } from "../skills/skill-loader.js";
import { type AnyAgentTool, jsonResult, readStringParam } from "./common.js";

// Initialize loader with a fixed path for now (can be made configurable)
// Assuming running from project root or dist/
const SKILLS_DIR = path.resolve(process.cwd(), "src/skills");
const loader = new SkillLoader(SKILLS_DIR);

const SkillsListSchema = {
  type: "object",
  properties: {},
};

const SkillsLoadSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "The name of the skill to load" },
  },
  required: ["name"],
};

export function createSkillTools(): AnyAgentTool[] {
  return [
    {
      label: "Skill List",
      name: "skills_list",
      description: "List available procedural skills that can be loaded into context.",
      parameters: SkillsListSchema,
      execute: async () => {
        const skills = await loader.listSkills();
        return jsonResult({
          skills,
          message: `Found ${skills.length} skills. Use skills_load(name) to read one.`,
        });
      },
    },
    {
      label: "Skill Load",
      name: "skills_load",
      description: "Load a specific skill's instructions and metadata into the context.",
      parameters: SkillsLoadSchema,
      execute: async (_toolCallId, args) => {
        const params = args as Record<string, unknown>;
        const name = readStringParam(params, "name", { required: true });

        const skill = await loader.loadSkill(name);
        if (!skill) {
          throw new Error(`Skill '${name}' not found.`);
        }

        return jsonResult({
          skill: {
            name: skill.metadata.name,
            description: skill.metadata.description,
            instructions: skill.instructions,
            availableResources: skill.resources.map((r) => r.path),
          },
        });
      },
    },
  ];
}

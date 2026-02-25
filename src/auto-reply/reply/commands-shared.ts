/**
 * Command handlers for shared resource management
 * Handles /shared, /agents, /skills commands
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { resolveDefaultAgentWorkspaceDir } from "../../agents/workspace.js";
import { buildAgentSummaries } from "../../commands/agents.config.js";
import type { CommandHandler, CommandHandlerResult } from "./commands-types.js";

type SkillInfo = {
  name: string;
  hasSkillMd: boolean;
  description?: string;
};

function discoverSkills(workspacePath: string): SkillInfo[] {
  const skillsDir = path.join(workspacePath, "skills");
  const skills: SkillInfo[] = [];

  if (!fs.existsSync(skillsDir)) {
    return skills;
  }

  try {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(skillsDir, entry.name);
        const skillMdPath = path.join(skillPath, "SKILL.md");
        const hasSkillMd = fs.existsSync(skillMdPath);

        let description: string | undefined;
        if (hasSkillMd) {
          try {
            const content = fs.readFileSync(skillMdPath, "utf-8");
            const lines = content.split("\n").filter((l) => l.trim());
            const descLine = lines.find((l) => !l.startsWith("#") && l.trim().length > 0);
            if (descLine) {
              description = descLine.trim().slice(0, 80);
            }
          } catch {
            // Ignore read errors
          }
        }

        skills.push({ name: entry.name, hasSkillMd, description });
      }
    }
  } catch {
    // Ignore directory read errors
  }

  return skills.toSorted((a, b) => a.name.localeCompare(b.name));
}

function countAgents(workspacePath: string): number {
  const agentsDir = path.join(workspacePath, "agents");
  if (!fs.existsSync(agentsDir)) {
    return 0;
  }
  try {
    const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).length;
  } catch {
    return 0;
  }
}

function findSharedFiles(workspacePath: string): string[] {
  const sharedFileNames = ["SHARED.md", "TOOLS.md", "CONTACTS.md", "AGENTS-REGISTRY.md"];
  return sharedFileNames.filter((name) => fs.existsSync(path.join(workspacePath, name)));
}

export const handleSharedCommand: CommandHandler = async (params) => {
  const body = params.command.commandBodyNormalized;
  const sharedMatch = body.match(/^\/(shared)(?:\s+(\w+))?/i);

  if (!sharedMatch) {
    return { shouldContinue: true };
  }

  const view = sharedMatch[2]?.toLowerCase() || "overview";
  const workspacePath = resolveDefaultAgentWorkspaceDir(process.env) ?? process.cwd();

  const skills = discoverSkills(workspacePath);
  const agentCount = countAgents(workspacePath);
  const sharedFiles = findSharedFiles(workspacePath);

  let response: string;

  if (view === "skills") {
    if (skills.length === 0) {
      response = "📚 **No skills found** in workspace/skills/";
    } else {
      const skillLines = skills.map((s) => {
        const status = s.hasSkillMd ? "✓" : "○";
        const desc = s.description ? ` — ${s.description}` : "";
        return `${status} \`${s.name}\`${desc}`;
      });
      response = `📚 **Skills (${skills.length})**\n\n${skillLines.join("\n")}\n\n_✓ = has docs, ○ = no docs_`;
    }
  } else if (view === "agents") {
    try {
      const summaries = buildAgentSummaries(params.cfg);
      const agentLines = summaries.map((s) => {
        const emoji = s.identityEmoji || "🤖";
        const name = s.identityName || s.id;
        return `${emoji} **${name}** (\`${s.id}\`)`;
      });
      response = `👥 **Agents (${summaries.length})**\n\n${agentLines.join("\n")}`;
    } catch {
      response = `👥 **Agents:** ${agentCount} configured`;
    }
  } else if (view === "files") {
    if (sharedFiles.length === 0) {
      response = "📁 **No shared files found** (SHARED.md, TOOLS.md, etc.)";
    } else {
      response = `📁 **Shared Files**\n\n${sharedFiles.map((f) => `• ${f}`).join("\n")}`;
    }
  } else {
    // Overview
    const lines = [
      "🔗 **Shared Resources**",
      "",
      `📚 Skills: **${skills.length}**`,
      `👥 Agents: **${agentCount}**`,
      `📁 Shared files: ${sharedFiles.length > 0 ? sharedFiles.join(", ") : "none"}`,
      "",
      "_Use `/shared skills`, `/shared agents`, or `/shared files` for details._",
    ];
    response = lines.join("\n");
  }

  return {
    shouldContinue: false,
    reply: { text: response },
  };
};

export const handleAgentsCommand: CommandHandler = async (params) => {
  const body = params.command.commandBodyNormalized;
  const agentsMatch = body.match(/^\/(agents)(?:\s+(.+))?/i);

  if (!agentsMatch) {
    return { shouldContinue: true };
  }

  const specificAgent = agentsMatch[2]?.trim();

  try {
    const summaries = buildAgentSummaries(params.cfg);

    if (specificAgent) {
      const agent = summaries.find(
        (s) =>
          s.id.toLowerCase() === specificAgent.toLowerCase() ||
          s.identityName?.toLowerCase() === specificAgent.toLowerCase(),
      );
      if (!agent) {
        return {
          shouldContinue: false,
          reply: {
            text: `❌ Agent not found: \`${specificAgent}\`\n\nAvailable: ${summaries.map((s) => s.id).join(", ")}`,
          },
        };
      }
      const lines = [
        `${agent.identityEmoji || "🤖"} **${agent.identityName || agent.id}**`,
        "",
        `• ID: \`${agent.id}\``,
        `• Workspace: \`${agent.workspace}\``,
        agent.model ? `• Model: \`${agent.model}\`` : null,
        agent.routes?.length ? `• Routes: ${agent.routes.join(", ")}` : null,
      ].filter(Boolean);
      return {
        shouldContinue: false,
        reply: { text: lines.join("\n") },
      };
    }

    const agentLines = summaries.map((s) => {
      const emoji = s.identityEmoji || "🤖";
      const name = s.identityName || s.id;
      const isDefault = s.isDefault ? " _(default)_" : "";
      return `${emoji} **${name}**${isDefault} — \`${s.id}\``;
    });

    return {
      shouldContinue: false,
      reply: { text: `👥 **Agents (${summaries.length})**\n\n${agentLines.join("\n")}` },
    };
  } catch (error) {
    return {
      shouldContinue: false,
      reply: {
        text: `❌ Failed to list agents: ${error instanceof Error ? error.message : "unknown error"}`,
      },
    };
  }
};

export const handleSkillsCommand: CommandHandler = async (params) => {
  const body = params.command.commandBodyNormalized;
  const skillsMatch = body.match(/^\/(skills)(?:\s+(.+))?/i);

  if (!skillsMatch) {
    return { shouldContinue: true };
  }

  const specificSkill = skillsMatch[2]?.trim();
  const workspacePath = resolveDefaultAgentWorkspaceDir(process.env) ?? process.cwd();
  const skills = discoverSkills(workspacePath);

  if (specificSkill) {
    const skill = skills.find((s) => s.name.toLowerCase() === specificSkill.toLowerCase());
    if (!skill) {
      return {
        shouldContinue: false,
        reply: {
          text: `❌ Skill not found: \`${specificSkill}\`\n\nAvailable: ${skills.map((s) => s.name).join(", ")}`,
        },
      };
    }
    const skillPath = path.join(workspacePath, "skills", skill.name);
    const skillMdPath = path.join(skillPath, "SKILL.md");

    let details = `📚 **${skill.name}**\n\n`;
    details += `• Path: \`${skillPath}\`\n`;
    details += `• Docs: ${skill.hasSkillMd ? "✓ SKILL.md" : "○ none"}\n`;

    if (skill.hasSkillMd) {
      try {
        const content = fs.readFileSync(skillMdPath, "utf-8");
        const preview = content.slice(0, 500);
        details += `\n**Preview:**\n\`\`\`\n${preview}${content.length > 500 ? "..." : ""}\n\`\`\``;
      } catch {
        // Ignore
      }
    }

    return {
      shouldContinue: false,
      reply: { text: details },
    };
  }

  if (skills.length === 0) {
    return {
      shouldContinue: false,
      reply: { text: "📚 **No skills found** in workspace/skills/" },
    };
  }

  const skillLines = skills.map((s) => {
    const status = s.hasSkillMd ? "✓" : "○";
    const desc = s.description ? ` — ${s.description}` : "";
    return `${status} \`${s.name}\`${desc}`;
  });

  return {
    shouldContinue: false,
    reply: {
      text: `📚 **Skills (${skills.length})**\n\n${skillLines.join("\n")}\n\n_✓ = has docs, ○ = no docs_`,
    },
  };
};

export const handleSharedCommands: CommandHandler = async (params, allowTextCommands) => {
  // Try each handler in order
  let result: CommandHandlerResult | null;

  result = await handleSharedCommand(params, allowTextCommands);
  if (result && !result.shouldContinue) {
    return result;
  }

  result = await handleAgentsCommand(params, allowTextCommands);
  if (result && !result.shouldContinue) {
    return result;
  }

  result = await handleSkillsCommand(params, allowTextCommands);
  if (result && !result.shouldContinue) {
    return result;
  }

  return { shouldContinue: true };
};
